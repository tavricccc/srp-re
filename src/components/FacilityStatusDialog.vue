<template>
  <StatusTransitionDialog
    dialog-title-id="facility-status-dialog-title"
    :open="open"
    :saving="saving"
    :error="error"
    :options="availableOptions"
    :initial-status="availableOptions[0]?.value ?? ''"
    select-title="facility.admin.changeStatus"
    result-title="facility.addFacilityResult"
    result-description="facility.describeTheResultSoUsersUnderstandWhatHappened"
    result-input-id="facility-result-content"
    result-label="issue.result"
    :result-max-length="INPUT_LIMITS.resultContent"
    :result-warning-length="1800"
    result-placeholder="facility.describeHowTheFacilityReportWasHandled"
    result-required-error="facility.enterTheFacilityResult"
    :result-statuses="['completed', 'unable-to-handle']"
    @close="emit('close')"
    @submit="submit"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import StatusTransitionDialog from '@/components/ui/StatusTransitionDialog.vue';
import { INPUT_LIMITS } from '@/constants/input-limits';
import type { FacilityStatus } from '@/types';

const props = withDefaults(defineProps<{
  currentStatus: FacilityStatus;
  error?: string;
  open: boolean;
  saving?: boolean;
}>(), {
  error: '',
  saving: false,
});

const emit = defineEmits<{
  close: [];
  submit: [status: FacilityStatus, result: string];
}>();

const options = [
  { value: 'processing', label: 'facility.processing', description: 'facility.workHasStartedOnThisFacilityIssueButThereIsNoFinalOutcomeYet' },
  { value: 'completed', label: 'facility.completed', description: 'facility.thisFacilityIssueHasBeenResolvedEnterTheOutcome' },
  { value: 'unable-to-handle', label: 'facility.cannotBeResolved', description: 'facility.ifItCannotBeProcessedAfterEvaluationTheReasonsMustBeExplained' },
] satisfies Array<{ value: FacilityStatus; label: string; description: string }>;

const availableOptions = computed(() =>
  props.currentStatus === 'pending'
    ? options.filter((option) => option.value === 'processing')
    : options.filter((option) => option.value !== 'processing'),
);

function submit(status: string, result: string) {
  emit('submit', status as FacilityStatus, result);
}
</script>
