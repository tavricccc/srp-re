<template>
  <div ref="rootRef" class="relative inline-block text-left">
    <slot name="trigger" :open="open" :toggle="toggle" />

    <Teleport to="body">
      <transition name="popover">
        <DropdownPanel
          v-if="open"
          ref="panelComponentRef"
          class="fixed z-[120] origin-top-right"
          :class="panelClass"
          :size="size"
          :style="dropdownStyle"
          tabindex="-1"
          @click.stop
          @keydown="handlePanelKeydown"
          @pointerdown.stop
        >
          <slot :close="close" />
        </DropdownPanel>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue';
import DropdownPanel from '@/components/ui/molecules/DropdownPanel.vue';
import { useClickOutside } from '@/composables/useClickOutside';
import { useDropdownPosition } from '@/composables/useDropdownPosition';

const props = withDefaults(defineProps<{
  fallbackHeight?: number;
  panelClass?: string;
  size?: 'compact' | 'default' | 'search';
  width?: number;
}>(), {
  fallbackHeight: 160,
  panelClass: '',
  size: 'compact',
  width: 176,
});

const open = ref(false);
const rootRef = useTemplateRef<HTMLElement>('rootRef');
const panelComponentRef = useTemplateRef<InstanceType<typeof DropdownPanel>>('panelComponentRef');
const panelRef = computed(() => panelComponentRef.value?.$el as HTMLElement | null);
let triggerElement: HTMLElement | null = null;

const menuItemSelector = [
  '.dropdown-item:not(:disabled):not([aria-disabled="true"])',
  '[role="menuitem"]:not([aria-disabled="true"])',
  '[role="option"]:not([aria-disabled="true"])',
  'a[href]:not([aria-disabled="true"])',
  'button:not(:disabled)',
  '[tabindex]:not([tabindex="-1"]):not([aria-disabled="true"])',
].join(',');
const { dropdownStyle } = useDropdownPosition(
  rootRef,
  open,
  { fallbackHeight: props.fallbackHeight, width: props.width },
  panelRef,
);

function resolveTriggerElement() {
  const root = rootRef.value;
  if (!root) return null;
  if (document.activeElement instanceof HTMLElement && root.contains(document.activeElement)) {
    return document.activeElement;
  }
  return root.querySelector<HTMLElement>(
    'button:not(:disabled), a[href], [role="button"], [tabindex]:not([tabindex="-1"])',
  );
}

function menuItems() {
  return Array.from(panelRef.value?.querySelectorAll<HTMLElement>(menuItemSelector) ?? [])
    .filter((item) => item.getClientRects().length > 0);
}

function focusItem(item: HTMLElement | undefined) {
  item?.focus({ preventScroll: true });
}

function focusIsWithinMenu() {
  const activeElement = document.activeElement;
  return activeElement instanceof Node && Boolean(
    rootRef.value?.contains(activeElement) || panelRef.value?.contains(activeElement),
  );
}

function close(restoreFocus = true) {
  if (!open.value) return;
  const focusTarget = restoreFocus ? triggerElement : null;
  triggerElement = null;
  open.value = false;
  void nextTick(() => {
    if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
  });
}

function toggle() {
  if (open.value) {
    close();
    return;
  }
  triggerElement = resolveTriggerElement();
  open.value = true;
  void nextTick(() => focusItem(menuItems()[0] ?? panelRef.value ?? undefined));
}

function openMenu() {
  if (open.value) return;
  triggerElement = resolveTriggerElement();
  open.value = true;
  void nextTick(() => focusItem(menuItems()[0] ?? panelRef.value ?? undefined));
}

function handlePanelKeydown(event: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const items = menuItems();
  if (items.length === 0) return;

  event.preventDefault();
  const currentIndex = document.activeElement instanceof HTMLElement
    ? items.indexOf(document.activeElement)
    : -1;
  if (event.key === 'Home') return focusItem(items[0]);
  if (event.key === 'End') return focusItem(items.at(-1));

  const offset = event.key === 'ArrowDown' ? 1 : -1;
  const startingIndex = currentIndex === -1
    ? (offset > 0 ? -1 : 0)
    : currentIndex;
  focusItem(items[(startingIndex + offset + items.length) % items.length]);
}

useClickOutside(
  open,
  [rootRef, panelRef],
  () => close(focusIsWithinMenu()),
  { escape: true },
);

defineExpose({ close, open: openMenu, toggle });

defineSlots<{
  default(props: { close: () => void }): unknown;
  trigger(props: { open: boolean; toggle: () => void }): unknown;
}>();
</script>
