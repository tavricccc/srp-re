<template>
  <DetailActionGroup
    :compact="compact"
    delete-title="facility.deleteFacilityReport"
    :operation-time-items="operationTimeItems"
    :show-delete="facility.canManageFacility || (facility.isOwnFacility && facility.status === 'pending')"
    @delete="emit('delete')"
    @share="emit('share')"
  >
    <template #primary>
      <DetailActionButton
        :active="facility.currentUserAffected"
        :disabled="facility.isOwnFacility || closed || affecting"
        :label="t('facility.affectedCount', { count: facility.affected_count })"
        :compact="compact"
        :title="facility.isOwnFacility ? 'facility.theAuthorIsAutomaticallyIncludedInTheAffectedCount' : 'facility.iAlsoEncountered'"
        :aria-label="facility.isOwnFacility ? 'facility.theAuthorHasAutomaticallyBeenIncludedInTheNumberOfEncounters' : 'facility.iAlsoEncounteredItWhenSwitching'"
        @click="emit('toggleAffected')"
      >
        <AppIcon name="hand" />
      </DetailActionButton>
    </template>

    <DetailActionButton
      v-if="facility.canManageFacility && !closed"
      :label="nextStatusActionLabel"
      :compact="compact"
      :title="nextStatusActionLabel"
      :aria-label="nextStatusActionLabel"
      @click="emit('manageStatus')"
    >
      <AppIcon name="edit" />
    </DetailActionButton>
  </DetailActionGroup>
</template>

<script setup lang="ts">
import DetailActionButton from '@/components/ui/DetailActionButton.vue';
import DetailActionGroup from '@/components/ui/DetailActionGroup.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import type { FacilityRecord, OperationTimeListItem } from '@/types';
import { useI18n } from '@/i18n';

const { t } = useI18n();

defineProps<{
  affecting: boolean;
  closed: boolean;
  compact?: boolean;
  facility: FacilityRecord;
  nextStatusActionLabel: string;
  operationTimeItems: OperationTimeListItem[];
}>();

const emit = defineEmits<{
  delete: [];
  manageStatus: [];
  share: [];
  toggleAffected: [];
}>();
</script>
