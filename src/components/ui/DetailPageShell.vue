<template>
  <section class="flex h-full min-h-0 flex-col">
    <header class="flex shrink-0 items-start gap-3 pb-3">
      <button
        type="button"
        class="button-icon shrink-0"
        :aria-label="backLabel"
        :title="backLabel"
        @click="emit('back')"
      >
        <AppIcon name="chevron-left" :size="5" />
      </button>
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2 pt-1.5">
        <slot name="header" />
      </div>
    </header>

    <div v-if="isDesktopViewport" class="hidden min-h-0 flex-1 md:flex">
      <div class="flex h-full min-h-0 w-[62%] flex-col pr-6">
        <slot name="details" :compact="false" :scroll-content="true" />
        <slot name="actions" :compact="false" />
      </div>
      <div class="flex h-full min-h-0 w-[38%] flex-col border-l border-ink-100 pl-6 pr-1 dark:border-ink-800">
        <slot name="comments" :compact-header="false" />
      </div>
    </div>

    <div v-else class="flex min-h-0 flex-1 flex-col overflow-hidden md:hidden">
      <div class="mb-2 flex shrink-0 justify-center">
        <SegmentedControl
          :model-value="activeTab"
          :options="tabOptions"
          @update:model-value="setActiveTab"
        />
      </div>

      <div class="flex min-h-0 flex-1 flex-col px-1">
        <div v-show="activeTab === 'details'" class="flex h-full min-h-0 flex-1 flex-col">
          <div class="min-h-0 flex-1 overflow-y-auto px-1 pb-3 pr-2">
            <slot name="details" :compact="true" :scroll-content="false" />
          </div>
          <slot name="actions" :compact="true" />
        </div>

        <div v-show="activeTab === 'comments'" class="min-h-0 flex-1">
          <slot name="comments" :compact-header="true" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import SegmentedControl from '@/components/SegmentedControl.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

type DetailPageTab = 'details' | 'comments';

const props = withDefaults(defineProps<{
  backLabel?: string;
  commentsLabel?: string;
  detailsLabel: string;
  initialTab?: DetailPageTab;
}>(), {
  backLabel: '返回',
  commentsLabel: '討論留言',
  initialTab: 'details',
});

const emit = defineEmits<{
  back: [];
}>();

defineSlots<{
  actions(props: { compact: boolean }): unknown;
  comments(props: { compactHeader: boolean }): unknown;
  details(props: { compact: boolean; scrollContent: boolean }): unknown;
  header(): unknown;
}>();

const activeTab = ref<DetailPageTab>(props.initialTab);
const isDesktopViewport = ref(
  typeof window === 'undefined' ? false : window.matchMedia('(min-width: 768px)').matches,
);
let desktopMediaQuery: MediaQueryList | null = null;

const tabOptions = computed(() => [
  { value: 'details', label: props.detailsLabel },
  { value: 'comments', label: props.commentsLabel },
]);

watch(
  () => props.initialTab,
  (tab) => {
    activeTab.value = tab;
  },
);

function syncDesktopViewport(event?: MediaQueryListEvent) {
  isDesktopViewport.value = event?.matches ?? desktopMediaQuery?.matches ?? window.innerWidth >= 768;
}

function setActiveTab(value: string) {
  if (value === 'details' || value === 'comments') {
    activeTab.value = value;
  }
}

onMounted(() => {
  desktopMediaQuery = window.matchMedia('(min-width: 768px)');
  syncDesktopViewport();
  desktopMediaQuery.addEventListener('change', syncDesktopViewport);
});

onBeforeUnmount(() => {
  desktopMediaQuery?.removeEventListener('change', syncDesktopViewport);
});
</script>
