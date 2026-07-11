import { readonly, ref, watch } from 'vue';
import { useSession } from '@/composables/useSession';
import { fetchNotificationUnreadHint, subscribeNotificationBadge } from '@/services/notifications';

const hasUnread = ref(false);
let initialized = false;
let unsubscribe: (() => void) | null = null;
let version = 0;

export function setNotificationBadgeUnread(value: boolean) {
  hasUnread.value = value;
}

export function useNotificationBadge() {
  const { isAdmin, roleLoading, user } = useSession();
  if (!initialized) {
    initialized = true;
    watch(
      () => [user.value?.uid ?? '', isAdmin.value, roleLoading.value] as const,
      ([uid, admin, waiting]) => {
        unsubscribe?.();
        unsubscribe = null;
        hasUnread.value = false;
        const currentVersion = ++version;
        if (!uid || waiting) return;
        const refresh = () => {
          void fetchNotificationUnreadHint().then((value) => {
            if (currentVersion === version) hasUnread.value = value;
          }).catch(() => undefined);
        };
        refresh();
        unsubscribe = subscribeNotificationBadge(
          uid,
          admin,
          () => { hasUnread.value = true; },
          refresh,
          refresh,
        );
      },
      { immediate: true },
    );
  }
  return { hasUnread: readonly(hasUnread) };
}
