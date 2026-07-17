<template>
  <DialogOverlay :open="open" padded>
    <section
      ref="dialogRef"
      class="panel panel-pad dialog-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-update-title"
      data-dialog-root
      tabindex="-1"
    >
      <div class="flex items-start gap-4">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-info-container text-info shadow-note" aria-hidden="true">
          <AppIcon name="refresh" :size="6" :stroke-width="1.8" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="dialog-eyebrow">{{ t('app.update.eyebrow') }}</p>
          <h2 id="app-update-title" class="dialog-title">{{ t('app.update.title') }}</h2>
          <p class="dialog-description">{{ t('app.update.description') }}</p>
        </div>
      </div>
      <div class="dialog-actions">
        <button type="button" class="button-primary" :disabled="busy" data-autofocus @click="emit('reload')">
          <BusyButtonContent :busy="Boolean(busy)" label="app.update.update" busy-label="app.update.updating" />
        </button>
      </div>
    </section>
  </DialogOverlay>
</template>

<script setup lang="ts">
import { toRef } from 'vue';
import DialogOverlay from '@/components/ui/DialogOverlay.vue';
import BusyButtonContent from '@/components/ui/BusyButtonContent.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { useBodyScrollLock } from '@/composables/useBodyScrollLock';
import { useDialogFocus } from '@/composables/useDialogFocus';
import { useI18n } from '@/i18n';

const props = defineProps<{
  busy?: boolean;
  open: boolean;
}>();
const { t } = useI18n();

const emit = defineEmits<{
  reload: [];
}>();

useBodyScrollLock(toRef(props, 'open'));
const { dialogRef } = useDialogFocus(toRef(props, 'open'), {
  onClose: () => undefined,
});
</script>
