<template>
  <div v-if="mobile" class="relative inline-block text-left">
    <slot name="trigger" :open="sheetOpen" :toggle="toggleSheet" />
    <DialogShell
      :open="sheetOpen"
      presentation="sheet"
      :padded="false"
      :padded-surface="false"
      :labelled-by="titleId"
      surface-class="adaptive-action-sheet max-h-[min(72dvh,34rem)] overflow-hidden bg-surface px-3 pb-3"
      @close="closeSheet"
    >
      <h2 :id="titleId" class="sr-only">{{ title }}</h2>
      <div class="scrollbar-subtle max-h-[calc(72dvh-3rem)] overflow-y-auto py-1">
        <slot :close="closeSheet" />
      </div>
    </DialogShell>
  </div>
  <DropdownMenu
    v-else
    ref="dropdownRef"
    :fallback-height="fallbackHeight"
    :panel-class="panelClass"
    :size="size"
    :width="width"
  >
    <template #trigger="slotProps"><slot name="trigger" v-bind="slotProps" /></template>
    <template #default="slotProps"><slot v-bind="slotProps" /></template>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId } from 'vue';
import DropdownMenu from '@/components/ui/molecules/DropdownMenu.vue';
import DialogShell from '@/components/ui/organisms/DialogShell.vue';

const props = withDefaults(defineProps<{
  fallbackHeight?: number;
  panelClass?: string;
  size?: 'compact' | 'default' | 'search';
  title: string;
  width?: number;
}>(), {
  fallbackHeight: 160,
  panelClass: '',
  size: 'compact',
  width: 176,
});

const titleId = `adaptive-action-${useId()}`;
const mobile = ref(false);
const sheetOpen = ref(false);
const dropdownRef = ref<InstanceType<typeof DropdownMenu> | null>(null);
let mediaQuery: MediaQueryList | null = null;

function syncViewport() {
  mobile.value = mediaQuery?.matches ?? false;
  if (!mobile.value) sheetOpen.value = false;
}
function closeSheet() { sheetOpen.value = false; }
function toggleSheet() { sheetOpen.value = !sheetOpen.value; }
function open() {
  if (mobile.value) sheetOpen.value = true;
  else dropdownRef.value?.open();
}

onMounted(() => {
  mediaQuery = window.matchMedia('(max-width: 767px) and (pointer: coarse)');
  syncViewport();
  mediaQuery.addEventListener('change', syncViewport);
});
onBeforeUnmount(() => mediaQuery?.removeEventListener('change', syncViewport));

defineExpose({ close: closeSheet, open });
defineSlots<{
  default(props: { close: () => void }): unknown;
  trigger(props: { open: boolean; toggle: () => void }): unknown;
}>();
</script>
