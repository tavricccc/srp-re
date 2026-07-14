<template>
  <section class="min-h-0 px-1 pb-3 sm:px-2 sm:pb-5">
    <article class="panel overflow-visible" :aria-label="detailsLabel">
      <header class="flex items-start gap-3 px-4 py-4 sm:px-5">
        <button
          type="button"
          class="button-icon shrink-0"
          :class="{ 'max-md:hidden': !showMobileBackButton }"
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

      <div class="grid min-w-0 border-t border-ink-100/70 dark:border-ink-800/70 md:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]">
        <div class="min-w-0 px-4 py-4 sm:px-5 sm:py-5 md:pr-6">
          <slot name="details" :compact="!isDesktopViewport" :scroll-content="false" />
          <slot name="actions" :compact="!isDesktopViewport" />
        </div>

        <aside
          ref="commentsSectionRef"
          class="min-w-0 border-t border-ink-100/70 px-4 py-4 dark:border-ink-800/70 sm:px-5 sm:py-5 md:border-l md:border-t-0"
          :aria-label="commentsLabel"
        >
          <slot name="comments" :compact-header="false" />
        </aside>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';

type DetailPageTab = 'details' | 'comments';

const props = withDefaults(defineProps<{
  backLabel?: string;
  commentsLabel?: string;
  detailsLabel: string;
  initialTab?: DetailPageTab;
  showMobileBackButton?: boolean;
}>(), {
  backLabel: '返回',
  commentsLabel: '討論留言',
  initialTab: 'details',
  showMobileBackButton: true,
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

const commentsSectionRef = ref<HTMLElement | null>(null);
const isDesktopViewport = ref(
  typeof window === 'undefined' ? false : window.matchMedia('(min-width: 768px)').matches,
);
let desktopMediaQuery: MediaQueryList | null = null;

function syncDesktopViewport(event?: MediaQueryListEvent) {
  isDesktopViewport.value = event?.matches ?? desktopMediaQuery?.matches ?? window.innerWidth >= 768;
}

async function revealInitialSection(tab: DetailPageTab) {
  if (tab !== 'comments' || isDesktopViewport.value) return;
  await nextTick();
  commentsSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

watch(
  () => props.initialTab,
  (tab) => void revealInitialSection(tab),
);

onMounted(() => {
  desktopMediaQuery = window.matchMedia('(min-width: 768px)');
  syncDesktopViewport();
  desktopMediaQuery.addEventListener('change', syncDesktopViewport);
  void revealInitialSection(props.initialTab);
});

onBeforeUnmount(() => {
  desktopMediaQuery?.removeEventListener('change', syncDesktopViewport);
});
</script>
