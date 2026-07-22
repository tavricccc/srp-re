import { computed } from 'vue';
import { useSession } from '@/composables/useSession';
import { createContentCacheKey } from '@/services/content-read-cache';

export function useIssueDetailCacheScope() {
  const { managedIssueCategoryIds, roles, user } = useSession();

  return computed(() => createContentCacheKey([
    user.value?.uid ?? '',
    roles.value.includes('platform-admin')
      ? 'platform-admin'
      : managedIssueCategoryIds.value.slice().sort().join(','),
  ]));
}
