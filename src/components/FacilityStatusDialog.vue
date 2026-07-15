<template>
  <DialogOverlay :open="open" padded z-index-class="z-[110]" @close="handleClose">
    <section
      ref="dialogRef"
      class="panel panel-pad w-full max-w-lg"
      data-dialog-root
      role="dialog"
      aria-modal="true"
      aria-labelledby="facility-status-dialog-title"
      :aria-busy="saving ? 'true' : undefined"
      tabindex="-1"
    >
      <h3 id="facility-status-dialog-title" class="dialog-title">
        {{ terminal ? '填寫設備處理結果' : '更新設備狀態' }}
      </h3>
      <p class="dialog-description">
        {{ terminal ? '結案時請填寫使用者看得到的處理結果。' : '請選擇下一個狀態。' }}
      </p>

      <div class="mt-5 space-y-4">
        <div>
          <p class="field-label mb-2">下一個狀態</p>
          <div class="grid gap-2">
            <SelectionOptionButton
              v-for="option in availableOptions"
              :key="option.value"
              :label="option.label"
              :description="option.description"
              :selected="status === option.value"
              :disabled="saving"
              @select="status = option.value"
            />
          </div>
        </div>

        <div v-if="terminal" class="space-y-2">
          <label class="field-label" for="facility-result-content">處理結果</label>
          <div class="overflow-hidden rounded-[var(--radius-inner)] border-0 bg-surface shadow-note transition-colors focus-within:ring-2 focus-within:ring-outline/25 dark:bg-surface">
            <textarea
              id="facility-result-content"
              v-model="result"
              class="block min-h-36 w-full resize-none bg-transparent px-4 py-3 text-base leading-6 text-ink-800 outline-none placeholder:text-ink-400 disabled:cursor-not-allowed disabled:text-ink-500 dark:text-ink-100 dark:placeholder:text-ink-500 md:text-sm"
              maxlength="2000"
              placeholder="請說明處理結果或無法處理的原因"
              :disabled="saving"
            ></textarea>
            <div class="flex items-center justify-end border-t border-ink-100 bg-ink-50/50 px-4 py-2 text-xs font-medium text-ink-500 dark:border-ink-800 dark:bg-ink-950/30 dark:text-ink-400">
              <span :class="{ 'text-error': result.length > 1800 }">{{ result.length }} / 2000</span>
            </div>
          </div>
        </div>
      </div>

      <p v-if="localError || error" class="mt-3 text-xs font-semibold text-error">{{ localError || error }}</p>

      <div class="dialog-actions">
        <button type="button" class="button-secondary" :disabled="saving" @click="handleClose">取消</button>
        <button type="button" class="button-primary" :disabled="saving || !status" @click="submit">
          <BusyButtonContent :busy="saving" label="確認" busy-label="更新中" />
        </button>
      </div>
    </section>
  </DialogOverlay>
</template>

<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue';
import DialogOverlay from '@/components/ui/DialogOverlay.vue';
import BusyButtonContent from '@/components/ui/BusyButtonContent.vue';
import SelectionOptionButton from '@/components/ui/SelectionOptionButton.vue';
import { useBodyScrollLock } from '@/composables/useBodyScrollLock';
import { useDialogFocus } from '@/composables/useDialogFocus';
import type { FacilityStatus } from '@/types';

const props = withDefaults(defineProps<{
  currentStatus: FacilityStatus;
  error?: string;
  open: boolean;
  saving?: boolean;
}>(), { error: '', saving: false });

const emit = defineEmits<{ close: []; submit: [status: FacilityStatus, result: string] }>();
const options: Array<{ value: FacilityStatus; label: string; description: string }> = [
  { value: 'processing', label: '處理中', description: '設備問題已開始處理，尚未有最終結果。' },
  { value: 'completed', label: '已完成', description: '設備問題已處理完成，需填寫處理結果。' },
  { value: 'unable-to-handle', label: '無法處理', description: '經評估後無法處理，需說明原因。' },
];
const availableOptions = computed(() => props.currentStatus === 'pending'
  ? options.filter((option) => option.value === 'processing')
  : options.filter((option) => option.value !== 'processing'));
const status = ref<FacilityStatus | ''>('');
const result = ref('');
const localError = ref('');
const terminal = computed(() => status.value === 'completed' || status.value === 'unable-to-handle');
const isOpen = toRef(props, 'open');

useBodyScrollLock(isOpen);
function handleClose() { if (!props.saving) emit('close'); }
const { dialogRef } = useDialogFocus(isOpen, { onClose: handleClose });

function submit() {
  localError.value = '';
  if (!status.value) return;
  if (terminal.value && !result.value.trim()) {
    localError.value = '請填寫處理結果。';
    return;
  }
  emit('submit', status.value, result.value.trim());
}

watch(
  () => [props.open, props.currentStatus] as const,
  () => {
    if (!props.open) return;
    status.value = availableOptions.value[0]?.value ?? '';
    result.value = '';
    localError.value = '';
  },
  { immediate: true },
);
</script>
