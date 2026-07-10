import { computed, onScopeDispose, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAnnouncements } from '@/composables/useAnnouncements';
import { registerAppResumeHandler } from '@/composables/useAppResume';
import { useNetworkStatus } from '@/composables/useNetworkStatus';
import { useSession } from '@/composables/useSession';
import { useToast } from '@/composables/useToast';
import {
  createAnnouncement,
  deleteAnnouncement,
  setAnnouncementLike,
  updateAnnouncement,
} from '@/services/announcements';
import { subscribeContentRealtimeEvents } from '@/services/realtime-events';
import { deleteUploadedImage } from '@/services/uploads';
import type { UploadedImage } from '@/composables/useImageUpload';
import type { AnnouncementRecord, AnnouncementSortOption } from '@/types';
import { isContentUnavailableError } from '@/services/issues-core';
import {
  markContentRealtimeReliable,
  markContentRealtimeUnreliable,
  markContentWentOffline,
  shouldRefreshContentAfterResume,
} from '@/services/content-read-cache';

export function useAnnouncementManagement() {
  const router = useRouter();
  const { initialized, isAdmin, isAllowedUser, loading: authLoading, roleLoading, user } = useSession();
  const { showToast } = useToast();
  const { isOnline } = useNetworkStatus();
  const sortOption = ref<AnnouncementSortOption>('latest');
  const announcementCacheScope = computed(() => [
    initialized.value ? 'ready' : 'booting',
    isAllowedUser.value ? 'allowed' : 'blocked',
    user.value?.uid ?? '',
    isAdmin.value ? 'admin' : 'user',
  ].join(':'));
  const {
    announcements,
    loading,
    loadingMore,
    updatedAt,
    error,
    hasMore,
    loadMoreAnnouncements,
    forceRefreshAnnouncements,
    patchAnnouncement,
    removeAnnouncement,
    refreshAnnouncements,
    resetAnnouncements,
  } = useAnnouncements({ cacheScope: announcementCacheScope, sortOption });
  const editingAnnouncement = ref<AnnouncementRecord | null>(null);
  const editorError = ref('');
  const editorOpen = ref(false);
  const liking = ref(false);
  const likingAnnouncementId = ref('');
  const saving = ref(false);
  const deleting = ref(false);
  const deletePendingAnnouncement = ref<AnnouncementRecord | null>(null);
  const sessionLoading = computed(() => authLoading.value || !initialized.value);
  let realtimeUnsubscribe: (() => void) | null = null;
  let realtimeRefreshTimer = 0;
  const unregisterResumeHandler = registerAppResumeHandler(() => {
    if (!initialized.value || !isAllowedUser.value) return;
    if (!shouldRefreshContentAfterResume(updatedAt.value)) return;
    void refreshAnnouncementList({ force: true });
  });

  function openAnnouncementDetails(announcement: AnnouncementRecord, initialTab: 'details' | 'comments' = 'details') {
    router.push({
      name: 'announcement-detail',
      params: { announcementId: announcement.id },
      query: initialTab === 'comments' ? { tab: 'comments' } : undefined,
    });
  }

  function openEditor(announcement: AnnouncementRecord | null) {
    editingAnnouncement.value = announcement;
    editorError.value = '';
    editorOpen.value = true;
  }

  function closeEditor() {
    if (saving.value) return;
    editorOpen.value = false;
  }

  async function handleSave(payload: { title: string; content: string; uploadedImages: UploadedImage[] }) {
    saving.value = true;
    editorError.value = '';
    try {
      if (editingAnnouncement.value) {
        await updateAnnouncement(editingAnnouncement.value.id, payload);
      } else {
        await createAnnouncement(payload);
      }
      await refreshAnnouncementList();
      editorOpen.value = false;
      showToast('公告已儲存。', 'success');
    } catch (caught) {
      await Promise.allSettled(payload.uploadedImages.map((image) => deleteUploadedImage(image.storagePath)));
      editorError.value = caught instanceof Error ? caught.message : '公告儲存失敗。';
      showToast(editorError.value, 'error');
    } finally {
      saving.value = false;
    }
  }

  function handleListDelete(announcement: AnnouncementRecord) {
    deletePendingAnnouncement.value = announcement;
  }

  function closeDeleteDialog() {
    if (deleting.value) return;
    deletePendingAnnouncement.value = null;
  }

  async function confirmDelete() {
    const announcement = deletePendingAnnouncement.value;
    if (!announcement) return;

    deleting.value = true;
    try {
      await deleteAnnouncement(announcement.id);
      removeAnnouncement(announcement.id);
      deletePendingAnnouncement.value = null;
      showToast('公告已刪除。', 'success');
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : '公告刪除失敗。', 'error');
    } finally {
      deleting.value = false;
    }
  }

  async function handleToggleLike(announcement: AnnouncementRecord | null) {
    if (!announcement) return;
    if (!isAllowedUser.value) {
      showToast('請先使用校內帳號登入後再按讚。', 'error');
      return;
    }
    if (liking.value) return;

    const previousLiked = announcement.currentUserLiked;
    const previousLikeCount = announcement.like_count;
    const nextLiked = !previousLiked;
    const nextLikeCount = Math.max(0, previousLikeCount + (nextLiked ? 1 : -1));
    liking.value = true;
    likingAnnouncementId.value = announcement.id;
    patchAnnouncement(announcement.id, (item) => ({
      ...item,
      currentUserLiked: nextLiked,
      like_count: nextLikeCount,
    }));
    try {
      const result = await setAnnouncementLike(announcement.id, nextLiked);
      patchAnnouncement(announcement.id, (item) => ({
        ...item,
        currentUserLiked: result.liked,
        like_count: result.like_count,
      }));
    } catch (caught) {
      patchAnnouncement(announcement.id, (item) => ({
        ...item,
        currentUserLiked: previousLiked,
        like_count: previousLikeCount,
      }));
      if (isContentUnavailableError(caught)) {
        handleAnnouncementUnavailable(announcement.id);
      }
      showToast(caught instanceof Error ? caught.message : '操作失敗，請稍後再試。', 'error');
    } finally {
      liking.value = false;
      likingAnnouncementId.value = '';
    }
  }

  function handleAnnouncementUnavailable(announcementId: string) {
    removeAnnouncement(announcementId);
  }

  async function refreshAnnouncementList(options: { force?: boolean } = {}) {
    if (options.force) {
      await forceRefreshAnnouncements();
      markContentRealtimeReliable();
      return;
    }
    await refreshAnnouncements();
  }

  function scheduleRealtimeRefresh() {
    window.clearTimeout(realtimeRefreshTimer);
    realtimeRefreshTimer = window.setTimeout(() => {
      void refreshAnnouncementList({ force: true });
    }, 300);
  }

  watch(
    [initialized, isAllowedUser],
    ([ready, allowed]) => {
      if (!ready) return;
      if (allowed) {
        void refreshAnnouncementList();
        return;
      }
      resetAnnouncements();
    },
    { immediate: true },
  );

  watch(
    [initialized, isAllowedUser, roleLoading, () => sortOption.value],
    ([ready, allowed, waitingForRole]) => {
      realtimeUnsubscribe?.();
      realtimeUnsubscribe = null;
      window.clearTimeout(realtimeRefreshTimer);
      if (!ready || !allowed || waitingForRole) return;

      realtimeUnsubscribe = subscribeContentRealtimeEvents(`announcements:${sortOption.value}`, (event) => {
        if (event.eventType === 'announcement_metrics_changed') {
          patchAnnouncement(event.targetId, (announcement) => ({
            ...announcement,
            comment_count: event.commentCount ?? announcement.comment_count,
            like_count: event.likeCount ?? announcement.like_count,
          }));
          return;
        }
        if (event.eventType !== 'announcement_changed') return;
        scheduleRealtimeRefresh();
      }, () => {
        markContentRealtimeUnreliable();
      });
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    realtimeUnsubscribe?.();
    unregisterResumeHandler();
    window.clearTimeout(realtimeRefreshTimer);
  });

  watch(isOnline, (online) => {
    if (!online) {
      markContentWentOffline();
      return;
    }
    if (!initialized.value || !isAllowedUser.value) return;
    if (shouldRefreshContentAfterResume(updatedAt.value)) void refreshAnnouncementList({ force: true });
  });

  return {
    announcements,
    sortOption,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMoreAnnouncements,
    refreshAnnouncements: () => refreshAnnouncementList({ force: true }),
    editingAnnouncement,
    editorError,
    editorOpen,
    liking,
    likingAnnouncementId,
    saving,
    deleting,
    deletePendingAnnouncement,
    sessionLoading,
    isAdmin,
    isAllowedUser,
    openAnnouncementDetails,
    openEditor,
    closeEditor,
    handleSave,
    handleListDelete,
    closeDeleteDialog,
    confirmDelete,
    handleToggleLike,
  };
}
