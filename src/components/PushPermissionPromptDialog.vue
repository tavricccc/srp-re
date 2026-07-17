<template>
  <DialogOverlay :open="open" padded z-index-class="z-[90]" @close="emit('dismiss')">
    <section
      ref="dialogRef"
      class="panel panel-pad dialog-card"
      data-dialog-root
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-permission-title"
      aria-describedby="push-permission-description"
      tabindex="-1"
    >
      <div class="flex items-start gap-4">
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-info-container text-info shadow-note"
          aria-hidden="true"
        >
          <AppIcon name="bell" :size="6" />
        </div>
        <div class="min-w-0 flex-1">
          <h2 id="push-permission-title" class="dialog-title !mt-0">
            {{ t(mode === 'repair' ? 'app.install.reEnablePushNotifications' : 'app.install.turnOnPushNotifications') }}
          </h2>
          <p id="push-permission-description" class="dialog-description">
            {{ t(mode === 'repair'
              ? 'app.install.deviceNotificationLinkRequiresRefresh'
              : 'app.install.proposalNotificationBenefits') }}
          </p>
        </div>
      </div>

      <div class="dialog-actions">
        <button
          type="button"
          class="button-secondary"
          :disabled="busy"
          @click="emit('dismiss')"
        >
          {{ t('common.later') }}
        </button>
        <button
          type="button"
          class="button-primary"
          :disabled="busy"
          data-autofocus
          @click="emit('enable')"
        >
          <BusyButtonContent
            :busy="busy"
            :label="mode === 'repair' ? 'app.install.reEnable' : 'app.install.turnOnNotifications'"
            busy-label="app.install.processing"
          />
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
  busy: boolean;
  mode?: 'permission' | 'repair';
  open: boolean;
}>();
const { t } = useI18n();

const emit = defineEmits<{
  dismiss: [];
  enable: [];
}>();

useBodyScrollLock(toRef(props, 'open'));

const { dialogRef } = useDialogFocus(toRef(props, 'open'), {
  onClose: () => emit('dismiss'),
});
</script>
