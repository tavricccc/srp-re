<template>
  <DialogOverlay :open="open" padded z-index-class="z-[110]" @close="handleClose">
    <section
      ref="dialogRef"
      class="panel panel-pad w-full max-w-lg"
      data-dialog-root
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-dialog-title"
      :aria-busy="saving ? 'true' : undefined"
      tabindex="-1"
    >
      <h3 id="review-dialog-title" class="dialog-title">
        {{ t(step === 1 ? 'issue.reviewThisProposal' : 'issue.fillInTheReasonForFailure') }}
      </h3>
      <p class="dialog-description">
        {{ t(step === 1
          ? 'issue.reviewTheProposalAndDecideWhetherToApproveItOnceApprovedItWillBecomePublicAndOpenForSupport'
          : 'notification.pleaseBrieflyDescribeTheReasonForRejectionANotificationWillBeSentToTheProposer') }}
      </p>

      <div class="mt-5 space-y-4">
        <!-- Moderation choice (Step 1) -->
        <div v-if="step === 1">
          <p class="field-label mb-2">{{ t('issue.review.result') }}</p>
          <div class="grid gap-2">
            <button
              v-for="option in reviewOptions"
              :key="option.value"
              type="button"
              class="content-trigger flex w-full items-center justify-between gap-3 border px-3 py-3 text-left"
              :class="reviewDecision === option.value
                ? 'button-toolbar--active shadow-note'
                : 'border-ink-100 dark:border-ink-800'"
              @click="reviewDecision = option.value"
            >
              <span class="min-w-0">
                <span class="block text-sm font-semibold text-ink-900 dark:text-ink-100">{{ t(option.label) }}</span>
                <span class="mt-0.5 block text-xs leading-5 text-ink-500 dark:text-ink-400">{{ t(option.description) }}</span>
              </span>
              <SelectionMark :selected="reviewDecision === option.value" />
            </button>
          </div>
        </div>

        <!-- Rejection reason input (Step 2) -->
        <div v-else-if="step === 2" class="space-y-2">
          <label class="field-label" for="review-rejection-reason">{{ t('issue.review.rejectionReason') }}</label>
          <div class="control-frame">
            <textarea
              id="review-rejection-reason"
              v-model="rejectionReason"
              class="block min-h-36 w-full resize-none bg-transparent px-4 py-3 text-base leading-6 text-ink-800 outline-none placeholder:text-ink-400 disabled:cursor-not-allowed disabled:text-ink-500 dark:text-ink-100 dark:placeholder:text-ink-500 md:text-sm"
              maxlength="500"
              :placeholder="t('notification.rejectionReasonHelp')"
              :disabled="saving"
            ></textarea>
            <div class="control-footer justify-end text-xs font-medium text-ink-500 dark:text-ink-400">
              <span :class="{ 'text-error': rejectionReason.length > 450 }">{{ rejectionReason.length }} / 500</span>
            </div>
          </div>
        </div>
      </div>

      <p v-if="errorMsg" class="mt-3 text-xs font-semibold text-error">{{ errorMsg }}</p>

      <div class="dialog-actions">
        <button type="button" class="button-secondary" :disabled="saving" @click="handleSecondaryClick">
          {{ t(step === 1 ? 'issue.cancel' : 'issue.return') }}
        </button>
        <button
          type="button"
          class="button-primary"
          :disabled="saving"
          @click="handlePrimaryClick"
        >
          <BusyButtonContent :busy="saving" :label="idlePrimaryLabel" busy-label="app.update.updating" />
        </button>
      </div>
    </section>
  </DialogOverlay>
</template>

<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue';
import DialogOverlay from '@/components/ui/DialogOverlay.vue';
import BusyButtonContent from '@/components/ui/BusyButtonContent.vue';
import SelectionMark from '@/components/ui/SelectionMark.vue';
import { useBodyScrollLock } from '@/composables/useBodyScrollLock';
import { useDialogFocus } from '@/composables/useDialogFocus';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { moderateIssueStatus } from '@/services/issues';
import type { IssueRecord } from '@/types';
import { useI18n } from '@/i18n';

const props = defineProps<{
  open: boolean;
  issue: IssueRecord;
}>();
const { t } = useI18n();

const emit = defineEmits<{
  close: [];
  success: [issue: IssueRecord];
}>();

useBodyScrollLock(toRef(props, 'open'));

const reviewOptions = [
  {
    value: 'approved' as const,
    label: 'issue.approved',
    description: 'issue.theProposalWillBeMadePublicAndOpenToUserSupport',
  },
  {
    value: 'rejected' as const,
    label: 'issue.failureToPassTheReview',
    description: 'issue.theProposalWillNotBeMadePublicAndTheProposerMustBeNotifiedOfTheReasonsForRejection',
  },
];

const step = ref(1);
const reviewDecision = ref<'approved' | 'rejected'>('approved');
const rejectionReason = ref(props.issue.review_rejection_reason ?? '');
const saving = ref(false);
const errorMsg = ref('');
const { start } = useActionFeedback();

const idlePrimaryLabel = computed(() => {
  if (step.value === 1) {
    return reviewDecision.value === 'approved' ? 'issue.confirm' : 'issue.nextStep';
  }
  return 'issue.confirmAuditResults';
});

function handleClose() {
  if (saving.value) return;
  emit('close');
}

const { dialogRef } = useDialogFocus(toRef(props, 'open'), {
  onClose: handleClose,
});

function handlePrimaryClick() {
  if (step.value === 1) {
    if (reviewDecision.value === 'approved') {
      submitReview();
    } else {
      step.value = 2;
    }
  } else if (step.value === 2) {
    submitReview();
  }
}

function handleSecondaryClick() {
  if (step.value === 1) {
    handleClose();
  } else {
    step.value = 1;
    errorMsg.value = '';
  }
}

async function submitReview() {
  saving.value = true;
  errorMsg.value = '';
  const feedbackHandle = start('issue.updatingProposalReview');
  try {
    if (reviewDecision.value === 'approved') {
      const updated = await moderateIssueStatus(props.issue.id, 'pending');
      emit('success', updated);
      feedbackHandle.succeed('issue.proposalReviewPassed');
      emit('close');
    } else {
      const reason = rejectionReason.value.replace(/\s+/g, ' ').trim();
      if (!reason) {
        errorMsg.value = 'issue.pleaseEnterTheReasonWhyTheReviewFailed';
        feedbackHandle.fail(errorMsg.value);
        saving.value = false;
        return;
      }
      const updated = await moderateIssueStatus(props.issue.id, 'review-rejected', reason);
      emit('success', updated);
      feedbackHandle.succeed('issue.proposalReviewUpdated');
      emit('close');
    }
  } catch (caught) {
    errorMsg.value = caught instanceof Error ? caught.message : 'issue.reviewProcessingFailedPleaseTryAgainLater';
    feedbackHandle.fail(errorMsg.value);
  } finally {
    saving.value = false;
  }
}

watch(
  () => props.open,
  (newOpen) => {
    if (newOpen) {
      step.value = 1;
      reviewDecision.value = 'approved';
      rejectionReason.value = props.issue.review_rejection_reason ?? '';
      errorMsg.value = '';
    }
  }
);
</script>
