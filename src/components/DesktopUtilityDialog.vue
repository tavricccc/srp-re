<template>
  <DialogShell
    :open="open"
    :padded="false"
    :padded-surface="false"
    labelled-by="desktop-utility-title"
    surface-class="desktop-utility-popup flex h-[min(86dvh,840px)] w-[min(92vw,1120px)] max-w-none overflow-hidden"
    @close="emit('close')"
  >
    <aside class="desktop-utility-popup__sidebar scrollbar-subtle flex w-60 shrink-0 flex-col overflow-y-auto border-r border-ink-100/70 px-3 py-4 dark:border-ink-800/70">
      <div class="mb-4 flex items-center gap-3 px-2">
        <UserAvatar :photo-url="photoUrl" :name="userName" size="sm" :alt-text="t('settings.userAvatar')" />
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-ink-950 dark:text-ink-50">{{ userName }}</p>
          <p class="truncate text-xs text-ink-500 dark:text-ink-400">{{ schoolLabel }}</p>
        </div>
      </div>

      <nav class="space-y-1" :aria-label="t('settings.mine')">
        <button
          type="button"
          class="desktop-utility-popup__nav-item"
          :class="{ 'desktop-utility-popup__nav-item--active': activePanel === 'settings' }"
          @click="emit('select', 'settings')"
        >
          <AppIcon name="settings" :size="4" />
          <span>{{ t('settings.mine') }}</span>
        </button>
        <button
          type="button"
          class="desktop-utility-popup__nav-item"
          :class="{ 'desktop-utility-popup__nav-item--active': activePanel === 'notifications' }"
          @click="emit('select', 'notifications')"
        >
          <span class="relative inline-flex">
            <AppIcon name="bell" :size="4" />
            <span v-if="hasUnread" class="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-error"></span>
          </span>
          <span>{{ t('navigation.notify') }}</span>
        </button>
      </nav>
    </aside>

    <div class="flex min-h-0 min-w-0 flex-1 bg-[rgb(var(--color-page-background))]">
      <SettingsView v-if="activePanel === 'settings'" embedded @close="emit('close')" />
      <NotificationsView v-else embedded @close="emit('close')" />
    </div>
  </DialogShell>
</template>

<script setup lang="ts">
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import UserAvatar from '@/components/ui/atoms/UserAvatar.vue';
import DialogShell from '@/components/ui/organisms/DialogShell.vue';
import { defineAsyncComponent } from 'vue';
import { useI18n } from '@/i18n';

const SettingsView = defineAsyncComponent(() => import('@/views/SettingsView.vue'));
const NotificationsView = defineAsyncComponent(() => import('@/views/NotificationsView.vue'));

defineProps<{
  activePanel: 'notifications' | 'settings';
  hasUnread: boolean;
  open: boolean;
  photoUrl: string | null;
  schoolLabel: string;
  userName: string;
}>();

const emit = defineEmits<{
  close: [];
  select: [panel: 'notifications' | 'settings'];
}>();
const { t } = useI18n();
</script>
