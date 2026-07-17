<template>
  <PageLoadFailure
    v-if="problem"
    :title="t(problemTitle)"
    :description="t(problemDescription)"
    :retry-disabled="problemRetryDisabled"
    @retry="emit('retryProblem')"
  />

  <div
    v-else-if="loading"
    class="flex min-h-[50dvh] items-center justify-center"
    :aria-label="t(loadingLabel)"
    aria-busy="true"
  >
    <LoadingSpinner :size="8" />
  </div>

  <div v-else-if="!allowed" class="sr-only" role="status">{{ t('auth.redirectingToSignIn') }}</div>

  <PageLoadFailure
    v-else-if="error"
    :title="t(errorTitle)"
    :description="t(error)"
    @retry="emit('retryError')"
  />

  <slot v-else />
</template>

<script setup lang="ts">
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import PageLoadFailure from '@/components/ui/PageLoadFailure.vue';
import { useI18n } from '@/i18n';

const { t } = useI18n();

withDefaults(defineProps<{
  allowed: boolean;
  error?: string;
  errorTitle?: string;
  loading: boolean;
  loadingLabel: string;
  problem: boolean;
  problemDescription: string;
  problemRetryDisabled?: boolean;
  problemTitle: string;
}>(), {
  error: '',
  errorTitle: 'common.contentReadFailed',
  problemRetryDisabled: false,
});

const emit = defineEmits<{
  retryError: [];
  retryProblem: [];
}>();
</script>
