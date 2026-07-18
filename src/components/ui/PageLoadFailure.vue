<template>
  <div class="panel panel-pad flex w-full min-w-0 flex-col items-center py-14 text-center">
    <span class="grid h-14 w-14 place-items-center rounded-2xl bg-warning-container text-warning shadow-note" aria-hidden="true">
      <AppIcon name="circle-alert" :size="7" :stroke-width="1.7" />
    </span>
    <h2 class="mt-5 text-xl font-semibold tracking-[0.015em] text-ink-950 dark:text-ink-50">{{ t(title) }}</h2>
    <p class="mt-2 text-sm text-ink-500 dark:text-ink-400">{{ t(description) }}</p>
    <button type="button" class="button-secondary mt-5" :disabled="retryDisabled" @click="emit('retry')">
      {{ t(actionLabel) }}
    </button>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue';
import { useI18n } from '@/i18n';

const { t } = useI18n();

withDefaults(defineProps<{
  actionLabel?: string;
  description?: string;
  retryDisabled?: boolean;
  title?: string;
}>(), {
  actionLabel: 'dashboard.refresh',
  description: 'common.loadTimeout',
  retryDisabled: false,
  title: 'common.thereSeemsToBeAProblemWithTheNetwork',
});

const emit = defineEmits<{
  retry: [];
}>();
</script>
