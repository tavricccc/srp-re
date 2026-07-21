<template>
  <SurfacePanel variant="list" padding="sm" class="space-y-1">
    <p class="px-2 pb-2 text-xs font-semibold text-ink-500">
      {{ t('adminCenter.categoryListCount', { count: categories.length }) }}
    </p>
    <ListSurfaceRow
      v-for="(category, index) in categories"
      :key="category.id || `new-${index}`"
      as="button"
      interactive
      class="w-full text-left"
      :class="selectedIndex === index ? 'button-toolbar--active' : ''"
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
          class="rounded bg-primary-50 px-1 py-0.5 text-[9px] font-bold text-primary-700 dark:bg-primary-950/30 dark:text-primary-400"
        >
          {{ t('categoryAdmin.defaultCategory') }}
        </span>
      </div>
    </ListSurfaceRow>
  </SurfacePanel>
</template>

<script setup lang="ts">
import ListSurfaceRow from '@/components/ui/molecules/ListSurfaceRow.vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
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
