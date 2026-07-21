<template>
  <DialogOverlay
    :open="open"
    :no-padding="noPadding"
    :overlay-class="overlayClass"
    :padded="padded"
    :persistent="persistent"
    :transition-name="transitionName"
    :z-index-class="zIndexClass"
    @close="handleClose"
  >
    <section
      ref="dialogRef"
      class="surface-card"
      :class="[paddedSurface ? 'surface-pad-lg' : '', surfaceClass]"
      data-dialog-root
      :role="role"
      aria-modal="true"
      :aria-busy="busy ? 'true' : undefined"
      :aria-labelledby="labelledBy || undefined"
      :aria-describedby="describedBy || undefined"
      tabindex="-1"
    >
      <slot />
    </section>
  </DialogOverlay>
</template>

<script setup lang="ts">
import { toRef } from 'vue';
import DialogOverlay from '@/components/ui/molecules/DialogOverlay.vue';
import { useBodyScrollLock } from '@/composables/useBodyScrollLock';
import { useDialogFocus } from '@/composables/useDialogFocus';

const props = withDefaults(defineProps<{
  busy?: boolean;
  closeable?: boolean;
  describedBy?: string;
  labelledBy?: string;
  noPadding?: boolean;
  overlayClass?: string;
  open: boolean;
  padded?: boolean;
  paddedSurface?: boolean;
  persistent?: boolean;
  role?: 'alertdialog' | 'dialog';
  surfaceClass?: string;
  transitionName?: string;
  zIndexClass?: string;
}>(), {
  busy: false,
  closeable: true,
  describedBy: '',
  labelledBy: '',
  noPadding: false,
  overlayClass: '',
  padded: true,
  paddedSurface: true,
  persistent: false,
  role: 'dialog',
  surfaceClass: 'w-full max-w-lg',
  transitionName: 'dialog',
  zIndexClass: 'z-50',
});

const emit = defineEmits<{
  close: [];
}>();

function handleClose() {
  if (props.closeable && !props.busy && !props.persistent) emit('close');
}

const isOpen = toRef(props, 'open');
useBodyScrollLock(isOpen);
const { dialogRef } = useDialogFocus(isOpen, { onClose: handleClose });
</script>
