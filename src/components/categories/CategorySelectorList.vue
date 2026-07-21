<template>
  <div class="space-y-2" role="list" :aria-label="t('adminCenter.categoryListCount', { count: categories.length })">
    <p class="px-1 text-xs font-semibold text-ink-500">
      {{ t('adminCenter.categoryListCount', { count: categories.length }) }}
    </p>
    <button
      v-for="(category, index) in categories"
      :key="category.id || `new-${index}`"
      type="button"
      role="listitem"
      class="content-trigger flex w-full items-center gap-3 border px-3 py-3 text-left"
      :class="selectedIndex === index
        ? 'button-toolbar--active shadow-control'
        : 'border-ink-100 dark:border-ink-800'"
      :aria-current="selectedIndex === index ? 'true' : undefined"
      @click="selectedIndex = index"
    >
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-semibold text-ink-900 dark:text-ink-100">
          {{ category.label || t('categoryAdmin.untitledCategory') }}
        </span>
        <span class="mt-0.5 block truncate text-xs text-ink-500">
          {{ category.id || t('adminCenter.notSavedYet') }}
        </span>
      </span>
      <div v-if="showStatus" class="flex shrink-0 flex-col items-end gap-1">
        <span class="text-[11px] font-semibold" :class="category.isActive ? 'text-success' : 'text-ink-400'">
          {{ t(category.isActive ? 'categoryAdmin.active' : 'categoryAdmin.archived') }}
        </span>
        <span
          v-if="category.isDefault"
          class="rounded-full bg-primary-50 px-1.5 py-0.5 text-[9px] font-bold text-primary-700 dark:bg-primary-950/30 dark:text-primary-400"
        >
          {{ t('categoryAdmin.defaultCategory') }}
        </span>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '@/i18n';

interface CategorySelectorItem {
  id: string;
  isActive?: boolean;
  isDefault?: boolean;
  label: string;
}

withDefaults(defineProps<{
  categories: CategorySelectorItem[];
  showStatus?: boolean;
}>(), {
  showStatus: false,
});

const selectedIndex = defineModel<number>('selectedIndex', { required: true });
const { t } = useI18n();
</script>
