import { onScopeDispose, ref, watch, type Ref } from 'vue';
import { registerAppResumeHandler } from '@/composables/useAppResume';
import { useSession } from '@/composables/useSession';
import { useToast } from '@/composables/useToast';
import { createComment, deleteComment, fetchComments } from '@/services/issues';
import type { CommentRecord, DiscussionCommentRecord } from '@/types';
import { formatRequestError, isAbortFailure, RequestFailure } from '@/lib/request';
import { useNetworkStatus } from '@/composables/useNetworkStatus';
import { isContentUnavailableError } from '@/services/issues-core';
import { subscribeContentRealtimeEvents } from '@/services/realtime-events';
import {
  createContentCacheKey,
  isContentCacheFresh,
  markContentRealtimeReliable,
  markContentRealtimeUnreliable,
  markContentWentOffline,
  shouldRefreshContentAfterResume,
} from '@/services/content-read-cache';

interface IssueCommentsSnapshot {
  comments: CommentRecord[];
  cursor: { id: string; createdAtMs: number } | null;
  hasMore: boolean;
  loaded: boolean;
  updatedAt: number;
}

const issueCommentsCache = new Map<string, IssueCommentsSnapshot>();

export function useIssueComments(issueId: Ref<string>, onContentUnavailable?: (issueId: string) => void) {
  const { isAdmin, user, roleLoading } = useSession();
  const { showToast } = useToast();
  const { isOnline } = useNetworkStatus();

  const comments = ref<CommentRecord[]>([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const hasMore = ref(false);
  const loaded = ref(false);
  const cursor = ref<{ id: string; createdAtMs: number } | null>(null);
  const error = ref('');
  const submitError = ref('');
  const isSubmitting = ref(false);
  const deletingId = ref('');
  let requestVersion = 0;
  let requestController: AbortController | null = null;
  let realtimeUnsubscribe: (() => void) | null = null;
  let realtimeRefreshTimer = 0;
  const ignoredRealtimeCommentIds = new Set<string>();

  function cacheKey(id = issueId.value) {
    return createContentCacheKey([
      'issue-comments-state',
      user.value?.uid ?? '',
      isAdmin.value ? 'admin' : 'user',
      id,
    ]);
  }

  function serviceCacheScope() {
    return createContentCacheKey([
      user.value?.uid ?? '',
      isAdmin.value ? 'admin' : 'user',
    ]);
  }

  function saveSnapshot(id = issueId.value) {
    if (!id) return;
    issueCommentsCache.set(cacheKey(id), {
      comments: comments.value,
      cursor: cursor.value,
      hasMore: hasMore.value,
      loaded: loaded.value,
      updatedAt: Date.now(),
    });
  }

  function hydrateSnapshot(id = issueId.value) {
    const cached = issueCommentsCache.get(cacheKey(id));
    if (!cached || !isContentCacheFresh(cached.updatedAt)) return false;
    comments.value = cached.comments;
    cursor.value = cached.cursor;
    hasMore.value = cached.hasMore;
    loaded.value = cached.loaded;
    loading.value = false;
    error.value = '';
    return true;
  }

  const unregisterResumeHandler = registerAppResumeHandler(() => {
    const cached = issueCommentsCache.get(cacheKey());
    if (!issueId.value || !shouldRefreshContentAfterResume(cached?.updatedAt ?? 0)) return;
    void loadComments(issueId.value, { force: true });
  });

  function clearCommentState() {
    comments.value = [];
    cursor.value = null;
    hasMore.value = false;
    loaded.value = false;
  }

  function createRequestSignal() {
    requestController?.abort(new RequestFailure('留言載入已取消。', 'aborted'));
    requestController = new AbortController();
    return requestController.signal;
  }

  async function loadComments(issueIdValue?: string | unknown, options: { force?: boolean } = {}) {
    const finalId = typeof issueIdValue === 'string' && issueIdValue ? issueIdValue : issueId.value;
    if (!finalId) {
      requestVersion += 1;
      requestController?.abort(new RequestFailure('留言載入已取消。', 'aborted'));
      clearCommentState();
      loading.value = false;
      error.value = '';
      return;
    }

    if (!options.force && hydrateSnapshot(finalId)) return;

    const currentVersion = ++requestVersion;
    loading.value = true;
    error.value = '';

    try {
      const page = await fetchComments(finalId, null, {
        cacheScope: serviceCacheScope(),
        forceRefresh: options.force === true,
        signal: createRequestSignal(),
      });
      if (currentVersion !== requestVersion) return;
      comments.value = page.comments;
      cursor.value = page.cursor;
      hasMore.value = page.hasMore;
      loaded.value = true;
      saveSnapshot(finalId);
      markContentRealtimeReliable();
    } catch (caught) {
      if (currentVersion === requestVersion && !isAbortFailure(caught)) {
        error.value = isOnline.value
          ? formatRequestError(caught, '留言載入失敗，請稍後再試。')
          : '目前已離線，請恢復網路連線後重新整理。';
        if (isContentUnavailableError(caught)) {
          onContentUnavailable?.(finalId);
        }
      }
    } finally {
      if (currentVersion === requestVersion) loading.value = false;
    }
  }

  function containsComment(commentItems: CommentRecord[], commentId: string) {
    return commentItems.some((comment) =>
      comment.id === commentId || comment.replies.some((reply) => reply.id === commentId)
    );
  }

  function insertLocalComment(comment: CommentRecord, parentCommentId: string | null) {
    if (!parentCommentId) {
      if (containsComment(comments.value, comment.id)) return true;
      comments.value = [...comments.value, { ...comment, replies: comment.replies ?? [] }];
      loaded.value = true;
      return true;
    }

    let inserted = false;
    comments.value = comments.value.map((item) => {
      if (item.id !== parentCommentId) return item;
      if (item.replies.some((reply) => reply.id === comment.id)) {
        inserted = true;
        return item;
      }
      inserted = true;
      return {
        ...item,
        replies: [...item.replies, { ...comment, parent_comment_id: parentCommentId, replies: [] }],
      };
    });
    return inserted;
  }

  function removeLocalComment(commentId: string) {
    let removed = false;
    const nextComments = comments.value
      .filter((comment) => {
        if (comment.id !== commentId) return true;
        removed = true;
        return false;
      })
      .map((comment) => {
        const replies = comment.replies.filter((reply) => {
          if (reply.id !== commentId) return true;
          removed = true;
          return false;
        });
        return replies.length === comment.replies.length ? comment : { ...comment, replies };
      });
    comments.value = nextComments;
    return removed;
  }

  async function reloadLoadedComments(options: { targetCommentId?: string } = {}) {
    const finalId = issueId.value;
    if (!finalId) return;

    const targetTopLevelCount = Math.max(comments.value.length, 1);
    const currentVersion = ++requestVersion;
    let nextCursor: typeof cursor.value = null;
    let nextHasMore: boolean;
    let nextComments: CommentRecord[] = [];

    loading.value = true;
    error.value = '';

    try {
      do {
        const page = await fetchComments(finalId, nextCursor, {
          cacheScope: serviceCacheScope(),
          forceRefresh: true,
          signal: nextCursor === null ? createRequestSignal() : null,
        });
        if (currentVersion !== requestVersion) return;
        nextComments = [...nextComments, ...page.comments];
        nextCursor = page.cursor;
        nextHasMore = page.hasMore;
      } while (
        nextHasMore
        && nextCursor
        && (
          nextComments.length < targetTopLevelCount
          || Boolean(options.targetCommentId && !containsComment(nextComments, options.targetCommentId))
        )
      );

      comments.value = nextComments;
      cursor.value = nextCursor;
      hasMore.value = nextHasMore;
      loaded.value = true;
      saveSnapshot(finalId);
    } catch (caught) {
      if (currentVersion === requestVersion && !isAbortFailure(caught)) {
        error.value = isOnline.value
          ? formatRequestError(caught, '留言載入失敗，請稍後再試。')
          : '目前已離線，請恢復網路連線後重新整理。';
      }
    } finally {
      if (currentVersion === requestVersion) loading.value = false;
    }
  }

  watch(issueId, (issueIdValue) => {
    clearCommentState();
    void loadComments(issueIdValue);
  }, { immediate: true });

  function scheduleRealtimeRefresh() {
    window.clearTimeout(realtimeRefreshTimer);
    realtimeRefreshTimer = window.setTimeout(() => {
      void loadComments(issueId.value, { force: true });
    }, 300);
  }

  watch([issueId, roleLoading], ([issueIdValue, waitingForRole]) => {
    realtimeUnsubscribe?.();
    realtimeUnsubscribe = null;
    window.clearTimeout(realtimeRefreshTimer);
    if (!issueIdValue || waitingForRole) return;

    realtimeUnsubscribe = subscribeContentRealtimeEvents(`issue-comments:${issueIdValue}`, (event) => {
      if (event.eventType !== 'issue_comment_changed') return;
      if (event.parentId !== issueIdValue) return;
      if (ignoredRealtimeCommentIds.delete(event.targetId)) return;
      scheduleRealtimeRefresh();
    }, () => {
      markContentRealtimeUnreliable();
    });
  }, { immediate: true });

  watch(isOnline, (online) => {
    if (!online) {
      markContentWentOffline();
      return;
    }
    const cached = issueCommentsCache.get(cacheKey());
    if (issueId.value && shouldRefreshContentAfterResume(cached?.updatedAt ?? 0)) {
      void loadComments(issueId.value, { force: true });
    }
  });

  onScopeDispose(() => {
    realtimeUnsubscribe?.();
    unregisterResumeHandler();
    window.clearTimeout(realtimeRefreshTimer);
    requestVersion += 1;
    requestController?.abort(new RequestFailure('留言載入已取消。', 'aborted'));
  });

  async function loadMoreComments() {
    if (!hasMore.value || !cursor.value || loadingMore.value) return;
    loadingMore.value = true;
    try {
      const page = await fetchComments(issueId.value, cursor.value, {
        cacheScope: serviceCacheScope(),
        signal: null,
      });
      comments.value = [...comments.value, ...page.comments];
      cursor.value = page.cursor;
      hasMore.value = page.hasMore;
      saveSnapshot();
    } catch (caught) {
      if (!isAbortFailure(caught)) {
        if (isContentUnavailableError(caught)) {
          onContentUnavailable?.(issueId.value);
          return;
        }
        showToast(
          isOnline.value ? '無法載入更多留言。' : '目前已離線，請恢復網路連線後再試。',
          'error',
        );
      }
    } finally {
      loadingMore.value = false;
    }
  }

  function canDeleteComment(comment: DiscussionCommentRecord) {
    return comment.author_uid === user.value?.uid || isAdmin.value;
  }

  async function submitComment(content: string, parentCommentId: string | null = null) {
    submitError.value = '';

    if (!user.value?.email || !user.value.displayName) {
      submitError.value = '請先使用完整的校內 Google 帳號登入。';
      showToast(submitError.value, 'error');
      return false;
    }

    if (content.trim().length === 0) {
      submitError.value = '留言內容不能空白。';
      showToast(submitError.value, 'error');
      return false;
    }

    isSubmitting.value = true;

    try {
      const comment = await createComment(
        issueId.value,
        { content },
        parentCommentId,
      );
      ignoredRealtimeCommentIds.add(comment.id);
      if (!insertLocalComment(comment, parentCommentId)) {
        await reloadLoadedComments({ targetCommentId: parentCommentId ?? comment.id });
      } else {
        saveSnapshot();
      }

      return true;
    } catch (caught) {
      submitError.value = caught instanceof Error ? caught.message : '送出失敗，請稍後再試。';
      showToast(submitError.value, 'error');
      if (isContentUnavailableError(caught)) {
        onContentUnavailable?.(issueId.value);
      }
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  async function deleteCommentById(commentId: string) {
    deletingId.value = commentId;
    submitError.value = '';

    try {
      await deleteComment(commentId);
      ignoredRealtimeCommentIds.add(commentId);
      if (!removeLocalComment(commentId)) {
        await reloadLoadedComments();
      } else {
        saveSnapshot();
      }
      showToast('留言已刪除。', 'success');
    } catch {
      submitError.value = '刪除失敗，請稍後再試。';
      showToast(submitError.value, 'error');
    } finally {
      deletingId.value = '';
    }
  }

  return {
    canDeleteComment,
    comments,
    deleteCommentById,
    deletingId,
    error,
    isSubmitting,
    hasMore,
    loaded,
    loadMoreComments,
    loadComments,
    loading,
    loadingMore,
    submitComment,
    submitError,
  };
}
