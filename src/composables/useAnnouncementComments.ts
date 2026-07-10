import { onScopeDispose, ref, watch } from 'vue';
import type { AnnouncementCommentRecord, DiscussionCommentRecord } from '@/types';
import {
  createAnnouncementComment,
  deleteAnnouncementComment,
  fetchAnnouncementComments,
} from '@/services/announcements';
import { registerAppResumeHandler } from '@/composables/useAppResume';
import { useSession } from '@/composables/useSession';
import { useToast } from '@/composables/useToast';
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

interface AnnouncementCommentsSnapshot {
  comments: AnnouncementCommentRecord[];
  cursor: { id: string; createdAtMs: number } | null;
  hasMore: boolean;
  loaded: boolean;
  updatedAt: number;
}

const announcementCommentsCache = new Map<string, AnnouncementCommentsSnapshot>();

export function useAnnouncementComments(
  announcementId: () => string | null,
  onCommentCountChanged?: (payload: { announcementId: string; commentCount: number }) => void,
  onContentUnavailable?: (announcementId: string) => void,
) {
  const { isAdmin, user, roleLoading } = useSession();
  const { showToast } = useToast();
  const { isOnline } = useNetworkStatus();
  const comments = ref<AnnouncementCommentRecord[]>([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const hasMore = ref(false);
  const loaded = ref(false);
  const cursor = ref<{ id: string; createdAtMs: number } | null>(null);
  const submitting = ref(false);
  const deletingId = ref('');
  const error = ref('');
  let requestVersion = 0;
  let requestController: AbortController | null = null;
  let realtimeUnsubscribe: (() => void) | null = null;
  let realtimeRefreshTimer = 0;
  const ignoredRealtimeCommentIds = new Set<string>();

  function cacheKey(id = announcementId() ?? '') {
    return createContentCacheKey([
      'announcement-comments-state',
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

  function saveSnapshot(id = announcementId() ?? '') {
    if (!id) return;
    announcementCommentsCache.set(cacheKey(id), {
      comments: comments.value,
      cursor: cursor.value,
      hasMore: hasMore.value,
      loaded: loaded.value,
      updatedAt: Date.now(),
    });
  }

  function hydrateSnapshot(id = announcementId() ?? '') {
    const cached = announcementCommentsCache.get(cacheKey(id));
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
    const id = announcementId();
    if (!id) return;
    const cached = announcementCommentsCache.get(cacheKey(id));
    if (shouldRefreshContentAfterResume(cached?.updatedAt ?? 0)) {
      void loadComments({ force: true });
    }
  });

  function clearCommentState() {
    comments.value = [];
    cursor.value = null;
    hasMore.value = false;
    loaded.value = false;
  }

  function createRequestSignal() {
    requestController?.abort(new RequestFailure('公告留言載入已取消。', 'aborted'));
    requestController = new AbortController();
    return requestController.signal;
  }

  function canDeleteComment(comment: DiscussionCommentRecord) {
    return isAdmin.value || comment.author_uid === user.value?.uid;
  }

  async function loadComments(options: { force?: boolean } = {}) {
    const id = announcementId();
    if (!id) {
      requestVersion += 1;
      requestController?.abort(new RequestFailure('公告留言載入已取消。', 'aborted'));
      clearCommentState();
      loading.value = false;
      error.value = '';
      return;
    }

    if (!options.force && hydrateSnapshot(id)) return;

    const currentVersion = ++requestVersion;
    loading.value = true;
    error.value = '';
    try {
      const page = await fetchAnnouncementComments(id, null, {
        cacheScope: serviceCacheScope(),
        forceRefresh: options.force === true,
        signal: createRequestSignal(),
      });
      if (currentVersion !== requestVersion) return;
      comments.value = page.comments;
      cursor.value = page.cursor;
      hasMore.value = page.hasMore;
      loaded.value = true;
      saveSnapshot(id);
      markContentRealtimeReliable();
    } catch (caught) {
      if (currentVersion === requestVersion && !isAbortFailure(caught)) {
        error.value = isOnline.value
          ? formatRequestError(caught, '公告留言載入失敗。')
          : '目前已離線，請恢復網路連線後重新整理。';
        if (isContentUnavailableError(caught)) {
          onContentUnavailable?.(id);
        }
      }
    } finally {
      if (currentVersion === requestVersion) loading.value = false;
    }
  }

  function containsComment(commentItems: AnnouncementCommentRecord[], commentId: string) {
    return commentItems.some((comment) =>
      comment.id === commentId || comment.replies.some((reply) => reply.id === commentId)
    );
  }

  function insertLocalComment(comment: AnnouncementCommentRecord, parentCommentId: string | null) {
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
    const id = announcementId();
    if (!id || roleLoading.value) return;

    const targetTopLevelCount = Math.max(comments.value.length, 1);
    const currentVersion = ++requestVersion;
    let nextCursor: typeof cursor.value = null;
    let nextHasMore: boolean;
    let nextComments: AnnouncementCommentRecord[] = [];

    loading.value = true;
    error.value = '';

    try {
      do {
        const page = await fetchAnnouncementComments(id, nextCursor, {
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
      saveSnapshot(id);
    } catch (caught) {
      if (currentVersion === requestVersion && !isAbortFailure(caught)) {
        error.value = isOnline.value
          ? formatRequestError(caught, '公告留言載入失敗。')
          : '目前已離線，請恢復網路連線後重新整理。';
      }
    } finally {
      if (currentVersion === requestVersion) loading.value = false;
    }
  }

  function subscribeCurrentAnnouncementComments() {
    realtimeUnsubscribe?.();
    realtimeUnsubscribe = null;
    window.clearTimeout(realtimeRefreshTimer);

    const id = announcementId();
    if (!id) return;

    realtimeUnsubscribe = subscribeContentRealtimeEvents(`announcement-comments:${id}`, (event) => {
      if (event.eventType !== 'announcement_comment_changed') return;
      if (event.parentId !== id) return;
      if (ignoredRealtimeCommentIds.delete(event.targetId)) return;
      window.clearTimeout(realtimeRefreshTimer);
      realtimeRefreshTimer = window.setTimeout(() => {
        void loadComments({ force: true });
      }, 300);
    }, () => {
      markContentRealtimeUnreliable();
    });
  }

  onScopeDispose(() => {
    realtimeUnsubscribe?.();
    unregisterResumeHandler();
    window.clearTimeout(realtimeRefreshTimer);
    requestVersion += 1;
    requestController?.abort(new RequestFailure('公告留言載入已取消。', 'aborted'));
  });

  watch(roleLoading, (waitingForRole) => {
    if (waitingForRole) {
      realtimeUnsubscribe?.();
      realtimeUnsubscribe = null;
      window.clearTimeout(realtimeRefreshTimer);
      return;
    }
    subscribeCurrentAnnouncementComments();
  });

  watch(isOnline, (online) => {
    if (!online) {
      markContentWentOffline();
      return;
    }
    const id = announcementId();
    if (!id) return;
    const cached = announcementCommentsCache.get(cacheKey(id));
    if (shouldRefreshContentAfterResume(cached?.updatedAt ?? 0)) {
      void loadComments({ force: true });
    }
  });

  async function loadMoreComments() {
    const id = announcementId();
    if (!id || !hasMore.value || !cursor.value || loadingMore.value) return;
    loadingMore.value = true;
    try {
      const page = await fetchAnnouncementComments(id, cursor.value, {
        cacheScope: serviceCacheScope(),
        signal: null,
      });
      comments.value = [...comments.value, ...page.comments];
      cursor.value = page.cursor;
      hasMore.value = page.hasMore;
      saveSnapshot(id);
    } catch (caught) {
      if (!isAbortFailure(caught)) {
        if (isContentUnavailableError(caught)) {
          onContentUnavailable?.(id);
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

  async function submitComment(content: string, parentCommentId: string | null = null) {
    const id = announcementId();
    if (!id) return false;

    submitting.value = true;
    error.value = '';
    try {
      const result = await createAnnouncementComment(id, content, parentCommentId);
      ignoredRealtimeCommentIds.add(result.comment.id);
      if (!insertLocalComment(result.comment, parentCommentId)) {
        await reloadLoadedComments({ targetCommentId: parentCommentId ?? result.comment.id });
      } else {
        saveSnapshot(id);
      }
      onCommentCountChanged?.({ announcementId: id, commentCount: result.comment_count });
      return true;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : '留言送出失敗。';
      showToast(error.value, 'error');
      if (isContentUnavailableError(caught)) {
        onContentUnavailable?.(id);
      }
      return false;
    } finally {
      submitting.value = false;
    }
  }

  async function deleteComment(commentId: string) {
    deletingId.value = commentId;
    error.value = '';
    try {
      const result = await deleteAnnouncementComment(commentId);
      ignoredRealtimeCommentIds.add(commentId);
      if (!removeLocalComment(commentId)) {
        await reloadLoadedComments();
      } else {
        saveSnapshot(result.announcement_id);
      }
      onCommentCountChanged?.({
        announcementId: result.announcement_id,
        commentCount: result.comment_count,
      });
      showToast('留言已刪除。', 'success');
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : '留言刪除失敗。';
      showToast(error.value, 'error');
    } finally {
      deletingId.value = '';
    }
  }

  return {
    canDeleteComment,
    comments,
    deletingId,
    error,
    loadComments,
    loadMoreComments,
    hasMore,
    loaded,
    loading,
    loadingMore,
    submitComment,
    submitting,
    deleteComment,
    subscribeCurrentAnnouncementComments,
  };
}
