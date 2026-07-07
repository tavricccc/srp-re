import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAnnouncements } from '@/composables/useAnnouncements';
import { useAnnouncementListUpdatePrompt } from '@/composables/useContentUpdatePrompt';
import { useSession } from '@/composables/useSession';
import { useToast } from '@/composables/useToast';
import {
  createAnnouncement,
  deleteAnnouncement,
  setAnnouncementLike,
  updateAnnouncement,
} from '@/services/announcements';
import { deleteUploadedImage } from '@/services/uploads';
import type { UploadedImage } from '@/composables/useImageUpload';
import type { AnnouncementRecord, AnnouncementSortOption } from '@/types';
import { isContentUnavailableError } from '@/services/issues-core';

export function useAnnouncementManagement() {
  const router = useRouter();
  const { initialized, isAdmin, isAllowedUser, loading: authLoading } = useSession();
  const { showToast } = useToast();
  const sortOption = ref<AnnouncementSortOption>('latest');
  const {
    acknowledgeAnnouncementListUpdate,
    showAnnouncementUpdatePrompt,
  } = useAnnouncementListUpdatePrompt();
  const {
    announcements,
    loading,
    loadingMore,
    refreshing,
    error,
    hasMore,
    loadMoreAnnouncements,
    upsertAnnouncement,
    removeAnnouncement,
    refreshAnnouncements,
    resetAnnouncements,
  } = useAnnouncements({ sortOption });
  const editingAnnouncement = ref<AnnouncementRecord | null>(null);
  const editorError = ref('');
  const editorOpen = ref(false);
  const liking = ref(false);
  const likingAnnouncementId = ref('');
  const saving = ref(false);
  const deleting = ref(false);
  const deletePendingAnnouncement = ref<AnnouncementRecord | null>(null);
  const sessionLoading = computed(() => authLoading.value || !initialized.value);

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
        const announcement = await updateAnnouncement(editingAnnouncement.value.id, payload);
        upsertAnnouncement({
          ...announcement,
          currentUserLiked: editingAnnouncement.value.currentUserLiked,
          like_count: editingAnnouncement.value.like_count,
          comment_count: editingAnnouncement.value.comment_count,
        });
      } else {
        const announcement = await createAnnouncement(payload);
        upsertAnnouncement(announcement);
      }
      editorOpen.value = false;
      showToast('公告已儲存。', 'success');
    } catch (caught) {
      await Promise.allSettled(payload.uploadedImages.map((image) => deleteUploadedImage(image.storagePath)));
      editorError.value = caught instanceof Error ? caught.message : '公告儲存失敗。';
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
    liking.value = true;
    likingAnnouncementId.value = announcement.id;
    try {
      const result = await setAnnouncementLike(announcement.id, !announcement.currentUserLiked);
      announcements.value = announcements.value.map((item) =>
        item.id === announcement.id
          ? { ...item, currentUserLiked: result.liked, like_count: result.like_count }
          : item
      );
    } catch (caught) {
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

  async function refreshAnnouncementList() {
    await refreshAnnouncements();
    acknowledgeAnnouncementListUpdate();
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
      acknowledgeAnnouncementListUpdate();
    },
    { immediate: true },
  );

  return {
    announcements,
    sortOption,
    loading,
    loadingMore,
    refreshing,
    error,
    hasMore,
    loadMoreAnnouncements,
    showAnnouncementUpdatePrompt,
    refreshAnnouncements: refreshAnnouncementList,
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
