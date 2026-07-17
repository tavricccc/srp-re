<template>
  <ContentCardCollection
    :empty="announcements.length === 0"
    empty-label="announcement.noAnnouncementsYet"
    list-label="announcement.announcementList"
  >
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
import ContentCardCollection from '@/components/ui/ContentCardCollection.vue';
import type { AnnouncementRecord } from '@/types';

defineProps<{
  announcements: AnnouncementRecord[];
  canManage?: boolean;
  likingAnnouncementId?: string;
}>();

const emit = defineEmits<{
  delete: [announcement: AnnouncementRecord];
  open: [announcement: AnnouncementRecord];
  openComments: [announcement: AnnouncementRecord];
  toggleLike: [announcement: AnnouncementRecord];
}>();

</script>
