<template>
  <DialogOverlay :open="open" padded z-index-class="z-[110]" @close="handleClose">
    <section
      ref="dialogRef"
      class="panel panel-pad w-full max-w-lg"
      data-dialog-root
      role="dialog"
      aria-modal="true"
      :aria-labelledby="dialogTitleId"
      :aria-busy="saving ? 'true' : undefined"
      tabindex="-1"
    >
      <h3 :id="dialogTitleId" class="dialog-title">{{ t(step === 1 ? selectTitle : resultTitle) }}</h3>
      <p class="dialog-description">{{ t(step === 1 ? selectDescription : resultDescription) }}</p>

      <div class="mt-5 space-y-4">
        <div v-if="step === 1">
          <p class="field-label mb-2">{{ t('common.chooseTheNextStatus') }}</p>
          <div class="grid gap-2">
            <SelectionOptionButton
              v-for="option in options"
              :key="option.value"
              :label="t(option.label)"
              :description="t(option.description)"
              :selected="status === option.value"
              :disabled="saving"
              @select="status = option.value"
            />
          </div>
          <p
            v-if="statusWarnings[status]"
            class="mt-4 rounded-xl border border-warning/20 bg-warning-container/40 px-3 py-2 text-xs font-semibold leading-5 text-on-warning-container"
          >
            {{ t(statusWarnings[status]) }}
          </p>
        </div>

        <div v-else class="space-y-2">
          <label class="field-label" :for="resultInputId">{{ t(resultLabel) }}</label>
          <div class="control-frame">
            <textarea
              :id="resultInputId"
              v-model="result"
              class="block min-h-36 w-full resize-none bg-transparent px-4 py-3 text-base leading-6 text-ink-800 outline-none placeholder:text-ink-400 disabled:cursor-not-allowed disabled:text-ink-500 dark:text-ink-100 dark:placeholder:text-ink-500 md:text-sm"
              :maxlength="resultMaxLength"
              :placeholder="t(resultPlaceholder)"
              :disabled="saving"
            ></textarea>
            <div class="control-footer justify-end text-xs font-medium text-ink-500 dark:text-ink-400">
              <span :class="{ 'text-error': result.length > resultWarningLength }">
                {{ result.length }} / {{ resultMaxLength }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <p v-if="localError || error" class="mt-3 text-xs font-semibold text-error">
        {{ t(localError || error) }}
      </p>

      <div class="dialog-actions">
        <button type="button" class="button-secondary" :disabled="saving" @click="handleSecondary">
          {{ t(step === 1 ? 'issue.cancel' : 'issue.return') }}
        </button>
        <button type="button" class="button-primary" :disabled="saving || !status" @click="handlePrimary">
          <BusyButtonContent :busy="saving" :label="primaryLabel" :busy-label="t('app.update.updating')" />
        </button>
      </div>
    </section>
  </DialogOverlay>
</template>

<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue';
import BusyButtonContent from '@/components/ui/BusyButtonContent.vue';
import DialogOverlay from '@/components/ui/DialogOverlay.vue';
import SelectionOptionButton from '@/components/ui/SelectionOptionButton.vue';
import { useBodyScrollLock } from '@/composables/useBodyScrollLock';
import { useDialogFocus } from '@/composables/useDialogFocus';
import { useI18n } from '@/i18n';

interface StatusOption {
  description: string;
  label: string;
  value: string;
}

const props = withDefaults(defineProps<{
  dialogTitleId: string;
  error?: string;
  initialResult?: string;
  initialStatus: string;
  open: boolean;
  options: StatusOption[];
  resultDescription: string;
  resultInputId: string;
  resultLabel: string;
  resultMaxLength: number;
  resultPlaceholder: string;
  resultRequiredError: string;
  resultStatuses: string[];
  resultTitle: string;
  resultWarningLength: number;
  saving?: boolean;
  selectDescription?: string;
  selectTitle: string;
  statusWarnings?: Record<string, string>;
}>(), {
  error: '',
  initialResult: '',
  saving: false,
  selectDescription: 'common.pleaseSelectTheNextStatus',
  statusWarnings: () => ({}),
});

const emit = defineEmits<{
  close: [];
  submit: [status: string, result: string];
}>();

const status = ref('');
const result = ref('');
const localError = ref('');
const step = ref(1);
const requiresResult = computed(() => props.resultStatuses.includes(status.value));
const primaryLabel = computed(() => step.value === 1 && requiresResult.value ? 'issue.nextStep' : 'issue.confirm');
const { t } = useI18n();
const isOpen = toRef(props, 'open');

useBodyScrollLock(isOpen);
function handleClose() {
  if (!props.saving) emit('close');
}
const { dialogRef } = useDialogFocus(isOpen, { onClose: handleClose });

function handlePrimary() {
  localError.value = '';
  if (!status.value) return;
  if (step.value === 1 && requiresResult.value) {
    step.value = 2;
    return;
  }
  const trimmedResult = result.value.trim();
  if (requiresResult.value && !trimmedResult) {
    localError.value = props.resultRequiredError;
    return;
  }
  emit('submit', status.value, trimmedResult);
}

function handleSecondary() {
  if (step.value === 2) {
    step.value = 1;
    localError.value = '';
    return;
  }
  handleClose();
}

watch(
  () => [props.open, props.initialStatus, props.initialResult, props.options] as const,
  () => {
    if (!props.open) return;
    status.value = props.options.some((option) => option.value === props.initialStatus)
      ? props.initialStatus
      : props.options[0]?.value ?? '';
    result.value = props.initialResult;
    localError.value = '';
    step.value = 1;
  },
  { immediate: true },
);
</script>
