<template>
  <div ref="rootRef" class="relative min-w-0" @click.stop @pointerdown.stop>
    <button
      type="button"
      class="flex max-w-full items-center text-ink-950 dark:text-ink-50"
      :class="variant === 'mobile-header'
        ? 'h-10 gap-1 text-2xl font-semibold leading-tight tracking-[0.015em]'
        : 'gap-1.5 text-2xl font-semibold tracking-[0.015em]'"
      title="選擇提案分類"
      :aria-label="`目前分類：${label}，選擇其他分類`"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="truncate">{{ label }}</span>
      <AppIcon
        name="chevron-down"
        :size="variant === 'mobile-header' ? 4.5 : 5"
        class="shrink-0 transition-transform"
        :class="{ 'rotate-180': open }"
      />
    </button>

    <transition name="popover">
      <div
        v-if="open"
        class="popover-panel popover-panel--section absolute left-0 z-[100] mt-2 w-max min-w-[11rem] max-w-[calc(100vw-2rem)]"
      >
        <div class="popover-section-label mb-1.5 whitespace-nowrap">提案分類</div>
        <div class="space-y-0.5">
          <button
            v-for="option in options"
            :key="option.value"
            type="button"
            class="menu-item justify-between gap-4 whitespace-nowrap"
            :class="{ 'button-toolbar--active': option.value === activeFilter }"
            @click="select(option.value)"
          >
            <span>{{ option.label }}</span>
            <SelectionMark :selected="option.value === activeFilter" />
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import SelectionMark from '@/components/ui/SelectionMark.vue';
import { ISSUE_FILTER_OPTIONS } from '@/constants/categories';
import { useClickOutside } from '@/composables/useClickOutside';
import type { IssueFilter } from '@/types';

defineProps<{
  activeFilter: IssueFilter;
  label: string;
  variant: 'desktop-heading' | 'mobile-header';
}>();

const emit = defineEmits<{
  select: [filter: IssueFilter];
}>();

const rootRef = ref<HTMLElement | null>(null);
const open = ref(false);
const options = ISSUE_FILTER_OPTIONS;

useClickOutside(open, [rootRef], () => { open.value = false; }, { escape: true });

function select(filter: IssueFilter) {
  open.value = false;
  emit('select', filter);
}
</script>
