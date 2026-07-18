<template>
  <RoutePageFrame as="div" layout="fill">
    <PageLoadFailure
      v-if="sessionLoadingHasProblem"
      :title="sessionProblemTitle"
      :description="sessionProblemDescription"
      :retry-disabled="!sessionOnline"
      @retry="reloadPage"
    />

    <div v-else-if="sessionLoading" class="space-y-5" :aria-label="t('issue.loadingProposals')" aria-busy="true">
      <div class="board-controls relative z-20 space-y-3">
        <div class="flex flex-row items-center justify-between gap-3 md:mt-0">
          <span class="skeleton-block hidden h-8 w-32 rounded md:block"></span>
          <div class="flex w-full shrink-0 items-center justify-end gap-1.5 sm:gap-2 md:w-auto">
            <span class="skeleton-block h-8 w-[9.375rem] rounded-full"></span>
            <span class="skeleton-block h-8 w-8 rounded-full md:h-9 md:w-9"></span>
            <span class="skeleton-block h-8 w-8 rounded-full md:h-9 md:w-9"></span>
            <span class="skeleton-block h-8 w-8 rounded-full"></span>
          </div>
        </div>
      </div>
      <IssueBoardTable
        :issues="[]"
        :loading="true"
        error=""
      />
    </div>

    <div v-else-if="!isAllowedUser" class="sr-only" role="status">{{ t('auth.redirectingToSignIn') }}</div>

    <IssueBoard
      v-if="isAllowedUser"
      class="min-h-0 flex-1"
      :is-form-open="isFormOpen"
      @toggle-form="toggleForm"
    />
  </RoutePageFrame>
</template>

<script setup lang="ts">
import RoutePageFrame from '@/components/ui/RoutePageFrame.vue';
import { computed, ref } from 'vue';
import { useI18n } from '@/i18n';
import IssueBoard from '@/components/IssueBoard.vue';
import IssueBoardTable from '@/components/IssueBoardTable.vue';
import PageLoadFailure from '@/components/ui/PageLoadFailure.vue';
import { useSession } from '@/composables/useSession';
import { useLoadingTimeout } from '@/composables/useLoadingTimeout';
import { resetAppConnection } from '@/lib/reconnect';

const { t } = useI18n();
const { initialized, isAllowedUser, loading } = useSession();
const sessionLoading = computed(() => loading.value || !initialized.value);
const {
  hasProblem: sessionLoadingHasProblem,
  isOnline: sessionOnline,
  problemDescription: sessionProblemDescription,
  problemTitle: sessionProblemTitle,
} = useLoadingTimeout(sessionLoading, 5_000);
const isFormOpen = ref(false);

function toggleForm() {
  isFormOpen.value = !isFormOpen.value;
}

async function reloadPage() {
  await resetAppConnection();
  window.location.reload();
}
</script>
