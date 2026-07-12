<template>
  <div class="mt-auto flex shrink-0 flex-wrap items-center gap-2 border-t border-ink-100 pt-3 dark:border-ink-800" :class="compact ? 'px-1' : ''">
    <DetailActionButton
      :active="announcement.currentUserLiked"
      :disabled="liking"
      :label="String(announcement.like_count)"
      :compact="compact"
      :title="announcement.currentUserLiked ? '取消讚' : '讚'"
      :aria-label="announcement.currentUserLiked ? '取消讚' : '讚'"
      @click="emit('toggleLike')"
    >
      <AppIcon name="thumbs-up" />
    </DetailActionButton>

    <DetailActionButton
      label="分享"
      :compact="compact"
      title="複製分享連結"
      aria-label="複製分享連結"
      @click="emit('share')"
    >
      <AppIcon name="share" />
    </DetailActionButton>

    <DetailActionButton
      v-if="canManage"
      danger
      label="刪除"
      :compact="compact"
      title="刪除公告"
      aria-label="刪除公告"
      @click="emit('delete')"
    >
      <AppIcon name="trash" />
    </DetailActionButton>
  </div>
</template>

<script setup lang="ts">
import DetailActionButton from '@/components/ui/DetailActionButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import type { AnnouncementRecord } from '@/types';

defineProps<{
  announcement: AnnouncementRecord;
  canManage: boolean;
  compact?: boolean;
  liking: boolean;
}>();

const emit = defineEmits<{
  delete: [];
  share: [];
  toggleLike: [];
}>();
</script>
