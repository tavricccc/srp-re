<template>
  <div
    class="space-y-0.5"
    :aria-label="t('comments.loadingComments')"
    aria-busy="true"
  >
    <div
      v-for="index in count"
      :key="index"
      class="skeleton-enter flex items-start gap-2.5 py-2.5"
      :style="{ '--skeleton-enter-index': index - 1 }"
    >
      <SkeletonBlock class="mt-0.5 h-8 w-8 shrink-0 rounded-full" />
      <div class="min-w-0 flex-1 space-y-2">
        <div class="flex items-center gap-2">
          <SkeletonBlock class="h-3.5 w-24 rounded" />
          <SkeletonBlock class="h-3 w-14 rounded" />
        </div>
        <SkeletonBlock class="block h-3.5 w-full rounded" />
        <SkeletonBlock class="block h-3.5 w-3/4 rounded" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@/i18n";
import SkeletonBlock from "@/components/ui/atoms/SkeletonBlock.vue";

const { t } = useI18n();
withDefaults(
  defineProps<{
    count?: number;
  }>(),
  {
    count: 4,
  },
);
</script>
