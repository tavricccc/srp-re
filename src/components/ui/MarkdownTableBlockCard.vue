<template>
  <div class="rounded-lg border border-ink-200 bg-ink-50/70 px-3 py-2 dark:border-ink-700 dark:bg-ink-900/60">
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-ink-800 dark:text-ink-100">{{ t('markdown.tableBlock') }}</p>
        <p class="text-xs text-ink-500 dark:text-ink-400">{{ rows }} × {{ columns }}</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="text-xs text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-ink-50"
          @click="emit('edit')"
        >
          {{ t('markdown.editTable') }}
        </button>
        <button
          type="button"
          class="text-xs text-error hover:opacity-80"
          @click="emit('delete')"
        >
          {{ t('comments.confirmDeletion') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '@/i18n';

defineProps<{
  columns: number;
  rows: number;
}>();
const { t } = useI18n();

const emit = defineEmits<{
  delete: [];
  edit: [];
}>();
</script>
