<template>
  <ContentCardCollection
    :empty="facilities.length === 0"
    empty-label="facility.noFacilityReportsYet"
    list-label="facility.facilityList"
    :loading="loading"
  >
    <template #loading>
      <ContentCardSkeleton
        :action-shapes="['pill']"
        :count="loadingCount"
        loading-label="facility.loadingFacility"
        supplement="summary"
      />
    </template>

    <FacilityTableRow
      v-for="facility in facilities"
      :key="facility.id"
      :facility="facility"
      :highlight-query="highlightQuery"
      :affecting="affectingFacilityId === facility.id"
      @open-details="emit('open-details', $event)"
      @toggle-affected="emit('toggle-affected', $event)"
      @manage-status="emit('manage-status', $event)"
      @delete="emit('delete', $event)"
    />
  </ContentCardCollection>
</template>

<script setup lang="ts">
import FacilityTableRow from '@/components/FacilityTableRow.vue';
import ContentCardCollection from '@/components/ui/organisms/ContentCardCollection.vue';
import ContentCardSkeleton from '@/components/ui/organisms/ContentCardSkeleton.vue';
import type { FacilitySummary } from '@/types';

withDefaults(defineProps<{
  affectingFacilityId?: string;
  facilities: FacilitySummary[];
  loading: boolean;
  loadingCount?: number;
  highlightQuery?: string;
}>(), {
  affectingFacilityId: '',
  highlightQuery: '',
  loadingCount: 2,
});
const emit = defineEmits<{
  'open-details': [facility: FacilitySummary];
  'toggle-affected': [facility: FacilitySummary];
  'manage-status': [facility: FacilitySummary];
  delete: [facility: FacilitySummary];
}>();
</script>
