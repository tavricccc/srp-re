<template>
  <ContentDetailPagePanel
    :author-name="facility.author_name"
    :author-photo-url="facility.author_photo_url"
    :author-secondary="facility.location"
    :author-uid="facility.author_uid"
    back-label="facility.backToFacilityList"
    :content="facility.content"
    details-label="facility.facilityDetails"
    :notice-content="facility.result_content"
    :notice-fallback-alt="t('facility.resultImage', { title: facility.title })"
    notice-title="issue.result"
    notice-markdown
    :show-comments="false"
    :title="facility.title"
    @back="emit('back')"
  >
    <template #header>
      <span class="tag border-ink-200 bg-ink-100/50 dark:border-ink-800 dark:bg-ink-950/50">{{ t('facility.facility') }}</span>
      <span class="tag font-semibold shadow-note" :class="statusClass">{{ statusLabel }}</span>
    </template>

    <template #actions="{ compact }">
      <FacilityDetailActions
        :affecting="affecting"
        :closed="closed"
        :compact="compact"
        :facility="facility"
        :next-status-action-label="nextStatusActionLabel"
        :operation-time-items="operationTimeItems"
        @delete="emit('delete')"
        @manage-status="emit('manageStatus')"
        @share="emit('share')"
        @toggle-affected="emit('toggleAffected')"
      />
    </template>
  </ContentDetailPagePanel>
</template>

<script setup lang="ts">
import FacilityDetailActions from '@/components/FacilityDetailActions.vue';
import ContentDetailPagePanel from '@/components/ContentDetailPagePanel.vue';
import type { FacilityRecord, OperationTimeListItem } from '@/types';
import { useI18n } from '@/i18n';

const { t } = useI18n();

defineProps<{
  affecting: boolean;
  closed: boolean;
  facility: FacilityRecord;
  nextStatusActionLabel: string;
  operationTimeItems: OperationTimeListItem[];
  statusClass: string;
  statusLabel: string;
}>();

const emit = defineEmits<{
  back: [];
  delete: [];
  manageStatus: [];
  share: [];
  toggleAffected: [];
}>();
</script>
