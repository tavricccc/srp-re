import { onScopeDispose, ref, watch } from 'vue';
import type { AnnouncementCommentRecord, DiscussionCommentRecord } from '@/types';
import {
  createAnnouncementComment,
  deleteAnnouncementComment,
  fetchAnnouncementComments,
} from '@/services/announcements';
import { useSession } from '@/composables/useSession';
import { useToast } from '@/composables/useToast';
import { formatRequestError, isAbortFailure, RequestFailure } from '@/lib/request';
import { useNetworkStatus } from '@/composables/useNetworkStatus';
import { isContentUnavailableError } from '@/services/issues-core';
import { subscribeContentRealtimeEvents } from '@/services/realtime-events';

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

  async function loadComments() {
    const id = announcementId();
    if (!id) {
      requestVersion += 1;
      requestController?.abort(new RequestFailure('公告留言載入已取消。', 'aborted'));
      clearCommentState();
      loading.value = false;
      error.value = '';
      return;
    }

    const currentVersion = ++requestVersion;
    loading.value = true;
    error.value = '';
    try {
      const page = await fetchAnnouncementComments(id, null, {
        signal: createRequestSignal(),
      });
      if (currentVersion !== requestVersion) return;
      comments.value = page.comments;
      cursor.value = page.cursor;
      hasMore.value = page.hasMore;
      loaded.value = true;
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
      window.clearTimeout(realtimeRefreshTimer);
      realtimeRefreshTimer = window.setTimeout(() => {
        void loadComments();
      }, 300);
    });
  }

  onScopeDispose(() => {
    realtimeUnsubscribe?.();
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

  async function loadMoreComments() {
    const id = announcementId();
    if (!id || !hasMore.value || !cursor.value || loadingMore.value) return;
    loadingMore.value = true;
    try {
      const page = await fetchAnnouncementComments(id, cursor.value, { signal: null });
      comments.value = [...comments.value, ...page.comments];
      cursor.value = page.cursor;
      hasMore.value = page.hasMore;
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
      await reloadLoadedComments({ targetCommentId: parentCommentId ?? result.comment.id });
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
      await reloadLoadedComments();
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
