import { computed, ref } from 'vue';
import { fetchPlatformDashboard } from '@/services/dashboard';
import type { PlatformDashboardData } from '@/types';
import { formatRequestError, isAbortFailure } from '@/lib/request';

export function usePlatformDashboard() {
  const dashboard = ref<PlatformDashboardData | null>(null);
  const loading = ref(false);
  const error = ref('');
  let requestVersion = 0;

  async function loadDashboard(options: { forceRefresh?: boolean } = {}) {
    const currentVersion = ++requestVersion;
    loading.value = true;
    error.value = '';

    try {
      const nextDashboard = await fetchPlatformDashboard(options);
      if (currentVersion === requestVersion) dashboard.value = nextDashboard;
    } catch (caught) {
      if (currentVersion === requestVersion && !isAbortFailure(caught)) {
        error.value = formatRequestError(caught, 'dashboard.dashboardFailedToLoadPleaseTryAgainLater');
      }
    } finally {
      if (currentVersion === requestVersion) loading.value = false;
    }
  }

  return {
    dashboard,
    stats: computed(() => dashboard.value?.stats ?? null),
    operations: computed(() => dashboard.value?.operations ?? null),
    loading,
    error,
    loadDashboard,
  };
}
