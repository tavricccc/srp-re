<template>
  <ContentCardShell
    :author-uid="announcement.author_uid"
    status-class="bg-ink-100/70 text-ink-700 dark:bg-ink-800 dark:text-ink-300"
    status-label="announcement.announcement"
    :time-label="dateLabel"
    :title="announcement.title"
    :long-press-enabled="canManage"
    @long-press="adminMenuRef?.open()"
    @open="emit('open', announcement)"
  >
    <template v-if="canManage" #admin>
      <CompactActionMenu ref="adminMenuRef" title="announcement.manageAnnouncement" @delete="emit('delete', announcement)" />
    </template>

    <template #actions>
      <AppButton
        variant="toolbar"
        class="h-8 w-8 rounded-full p-0"
        :title="t('comments.viewComments')"
        :aria-label="t('comments.viewComments')"
        @click.stop="emit('openComments', announcement)"
      >
        <AppIcon name="comment" />
      </AppButton>
      <AppButton
        :variant="announcement.currentUserLiked ? 'icon-pill-filled' : 'icon-pill'"
        class="!h-8 !gap-1 !px-2.5 text-xs"
        :disabled="liking"
        :title="t(announcement.currentUserLiked ? 'announcement.removeLike' : 'announcement.like')"
        :aria-label="t(announcement.currentUserLiked ? 'announcement.removeLike' : 'announcement.like')"
        @click.stop="emit('toggleLike', announcement)"
      >
        <AppIcon name="thumbs-up" />
        <span class="text-sm font-semibold leading-none tabular-nums">{{ announcement.like_count }}</span>
      </AppButton>
    </template>
  </ContentCardShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { AnnouncementRecord } from '@/types';
import CompactActionMenu from '@/components/CompactActionMenu.vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import ContentCardShell from '@/components/ui/organisms/ContentCardShell.vue';
import { formatDateOnly } from '@/lib/format';
import { useI18n } from '@/i18n';

const props = defineProps<{
  announcement: AnnouncementRecord;
  canManage?: boolean;
  liking?: boolean;
}>();
const { t } = useI18n();
const adminMenuRef = ref<InstanceType<typeof CompactActionMenu> | null>(null);

const emit = defineEmits<{
  delete: [announcement: AnnouncementRecord];
  open: [announcement: AnnouncementRecord];
  openComments: [announcement: AnnouncementRecord];
  toggleLike: [announcement: AnnouncementRecord];
}>();

const dateLabel = computed(() => formatDateOnly(props.announcement.published_at));
</script>
