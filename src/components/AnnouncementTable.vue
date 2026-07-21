<template>
  <ContentCardCollection
    :empty="announcements.length === 0"
    empty-label="announcement.noAnnouncementsYet"
    list-label="announcement.announcementList"
    :loading="loading"
  >
    <template #loading>
      <ContentCardSkeleton
        :action-shapes="['icon', 'pill']"
        :count="loadingCount"
        loading-label="announcement.announcementLoading"
        :show-admin="canManage"
      />
    </template>

    <AnnouncementTableRow
      v-for="announcement in announcements"
      :key="announcement.id"
      :announcement="announcement"
      :can-manage="canManage"
      :liking="likingAnnouncementId === announcement.id"
      @delete="emit('delete', $event)"
      @open="emit('open', $event)"
      @open-comments="emit('openComments', $event)"
      @toggle-like="emit('toggleLike', $event)"
    />
  </ContentCardCollection>
</template>

<script setup lang="ts">
import AnnouncementTableRow from './AnnouncementTableRow.vue';
import ContentCardCollection from '@/components/ui/organisms/ContentCardCollection.vue';
import ContentCardSkeleton from '@/components/ui/organisms/ContentCardSkeleton.vue';
import type { AnnouncementRecord } from '@/types';

withDefaults(defineProps<{
  announcements: AnnouncementRecord[];
  canManage?: boolean;
  likingAnnouncementId?: string;
  loading?: boolean;
  loadingCount?: number;
}>(), {
  canManage: false,
  likingAnnouncementId: '',
  loading: false,
  loadingCount: 2,
});

const emit = defineEmits<{
  delete: [announcement: AnnouncementRecord];
  open: [announcement: AnnouncementRecord];
  openComments: [announcement: AnnouncementRecord];
  toggleLike: [announcement: AnnouncementRecord];
}>();

</script>
