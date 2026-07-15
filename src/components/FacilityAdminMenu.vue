<template>
  <div v-if="facility.canManageFacility" class="relative inline-block text-left">
    <button
      ref="triggerRef"
      type="button"
      class="button-toolbar h-8 w-8 rounded-full p-0"
      :class="{ 'text-ink-800 dark:text-ink-100': open }"
      title="管理設備"
      aria-label="管理設備"
      @click="open = !open"
    >
      <AppIcon name="more-horizontal" :size="4.5" :stroke-width="1.8" />
    </button>

    <Teleport to="body">
      <transition name="popover">
        <div
          v-if="open"
          ref="menuRef"
          class="popover-panel popover-panel--compact fixed z-[120] w-44 origin-top-right"
          :style="dropdownStyle"
          @click.stop
          @pointerdown.stop
        >
          <button v-if="!closed" type="button" class="menu-item" @click="selectStatus">
            <AppIcon name="edit" :size="3" />
            <span class="font-semibold">變更設備狀態</span>
          </button>
          <div class="mt-1 border-t border-error/20 pt-1">
            <button type="button" class="menu-item menu-item-danger" @click="selectDelete">
              <AppIcon name="trash" :size="3" />
              <span>刪除設備</span>
            </button>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { useClickOutside } from '@/composables/useClickOutside';
import { useDropdownPosition } from '@/composables/useDropdownPosition';
import type { FacilitySummary } from '@/types';

const props = defineProps<{ facility: FacilitySummary }>();
const emit = defineEmits<{ status: []; delete: [] }>();
const open = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);
const menuRef = ref<HTMLDivElement | null>(null);
const closed = computed(() => ['completed', 'unable-to-handle'].includes(props.facility.status));

useClickOutside(open, [triggerRef, menuRef], () => { open.value = false; });
const { dropdownStyle } = useDropdownPosition(triggerRef, open, { fallbackHeight: 120, width: 176 }, menuRef);

function selectStatus() { open.value = false; emit('status'); }
function selectDelete() { open.value = false; emit('delete'); }
</script>
