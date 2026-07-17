<template>
  <div
    class="flex min-h-0 min-w-0 w-full max-w-full flex-col"
    :class="[contentClass, flat ? 'settings-panel--flat overflow-visible' : 'overflow-hidden']"
  >
    <div
      v-if="!flat"
      class="flex items-start justify-between gap-3 border-b border-ink-100 px-4 py-3 dark:border-ink-700"
    >
      <div>
        <p class="text-base font-semibold tracking-[0.015em] text-ink-950 dark:text-ink-50">{{ t('settings.mine') }}</p>
        <p class="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{{ t('notification.accountNotificationsAndAppSettings') }}</p>
      </div>
      <button
        v-if="showClose"
        type="button"
        class="button-toolbar -mr-1 h-9 w-9 shrink-0 rounded-full p-0"
        :aria-label="t('settings.closeSettings')"
        data-autofocus
        @click="emit('close')"
      >
        <AppIcon name="close" :size="4" />
      </button>
    </div>

    <div
      class="settings-scroll min-h-0 min-w-0 w-full max-w-full"
      :class="flat
        ? 'settings-scroll--flat overflow-visible'
        : 'overflow-x-hidden overflow-y-auto'"
    >
      <section :aria-label="t('settings.accountInformation')" class="settings-group list-surface py-4">
        <p v-if="SCHOOL_NAME" class="mb-3 text-xs font-semibold text-ink-500 dark:text-ink-400">
          {{ SCHOOL_NAME }}
        </p>
        <div class="flex min-w-0 max-w-full items-center gap-3">
          <UserAvatar :photo-url="displayPhotoUrl" :name="displayName || 'U'" size="md" :alt-text="t('settings.userAvatar')" class="h-10 w-10 shrink-0" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-ink-950 dark:text-ink-50">
              {{ displayName || t('settings.nameNotSet') }}
            </p>
            <p class="truncate text-xs leading-5 text-ink-500 dark:text-ink-400">
              {{ email }}
            </p>
            <div class="settings-account__uid-row flex min-w-0 items-center gap-1">
              <p class="truncate text-[11px] leading-5 text-ink-400 dark:text-ink-500">{{ t('account.uidLabel') }}{{ uid }}</p>
              <button
                type="button"
                class="settings-account__uid-copy button-toolbar shrink-0 rounded-full p-0"
                :title="t('settings.copyUid')"
                :aria-label="t('settings.copyUid')"
                @click="copyUid"
              >
                <AppIcon name="copy" :size="3" :stroke-width="2" />
              </button>
            </div>
          </div>
          <button
            type="button"
            class="button-secondary h-8 min-h-8 shrink-0 gap-1.5 px-2.5 py-1 text-xs font-semibold"
            @click="emit('switchAccount')"
          >
            <AppIcon name="switch-horizontal" :size="3" :stroke-width="2" />
            {{ t('settings.switchAccount') }}
          </button>
        </div>
      </section>

      <section class="settings-group list-surface" :aria-label="t('dashboard.pushNotification')">
        <button
          type="button"
          class="settings-row list-surface-row list-surface-row--interactive"
          :class="(pushLoading || !pushActionLabel) ? 'opacity-60 cursor-not-allowed' : ''"
          :disabled="pushLoading || !pushActionLabel"
          @click="emit('togglePush')"
        >
          <span class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-ink-950 dark:text-ink-50">{{ t('dashboard.pushNotification') }}</p>
            <p class="mt-1 text-xs leading-5 text-ink-500 dark:text-ink-400">{{ pushStatusDescription }}</p>
            <p v-if="pushError" class="mt-1 text-xs leading-5 text-error">{{ pushError }}</p>
          </span>
          <span
            v-if="pushActionLabel"
            class="setting-switch"
            :class="{ 'setting-switch--on': pushEnabled }"
            role="switch"
            :aria-checked="pushEnabled"
            :aria-label="t('dashboard.pushNotification')"
          >
            <span class="setting-switch__thumb"></span>
          </span>
        </button>
      </section>

      <section :aria-label="t('notification.notificationTypes')">
        <p class="settings-group-title">{{ t('notification.notificationTypes') }}</p>
        <div class="settings-group list-surface">
          <button
            v-for="option in personalNotificationOptions"
            :key="option.key"
            type="button"
            class="settings-row list-surface-row list-surface-row--interactive"
            :disabled="pushLoading"
            @click="emit('setPreference', option.key, !personalPreferences[option.key])"
          >
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-ink-900 dark:text-ink-100">{{ option.label }}</span>
              <span class="mt-0.5 block text-xs leading-5 text-ink-500 dark:text-ink-400">{{ option.description }}</span>
            </span>
            <span
              class="setting-switch"
              :class="{ 'setting-switch--on': personalPreferences[option.key] }"
              role="switch"
              :aria-checked="personalPreferences[option.key]"
              :aria-label="option.label"
            >
              <span class="setting-switch__thumb"></span>
            </span>
          </button>
        </div>
      </section>

      <section :aria-label="t('settings.features')">
        <p class="settings-group-title">{{ t('settings.features') }}</p>
        <div class="settings-group list-surface">
          <RouterLink
            to="/issues/my-proposals"
            class="settings-row list-surface-row list-surface-row--interactive gap-3"
            @click="emit('close')"
          >
            <span class="flex min-w-0 items-center gap-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center text-ink-500 dark:text-ink-300">
                <AppIcon name="user" :size="4" :stroke-width="2" />
              </span>
              <span>
                <span class="block text-sm font-semibold text-ink-900 dark:text-ink-100">{{ t('issue.myProposal') }}</span>
                <span class="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">{{ t('issue.yourProposalsAndLatestProgress') }}</span>
              </span>
            </span>
            <AppIcon name="chevron-right" :size="4" class="shrink-0 text-ink-400" :stroke-width="2.2" />
          </RouterLink>
          <RouterLink
            v-if="isAdmin"
            to="/dashboard"
            class="settings-row list-surface-row list-surface-row--interactive gap-3"
            @click="emit('close')"
          >
            <span class="flex min-w-0 items-center gap-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center text-ink-500 dark:text-ink-300">
                <AppIcon name="chart" :size="4" :stroke-width="2" />
              </span>
              <span>
                <span class="block text-sm font-semibold text-ink-900 dark:text-ink-100">{{ t('dashboard.statistics') }}</span>
                <span class="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">{{ t('settings.viewPlatformUsageAndOperations') }}</span>
              </span>
            </span>
            <AppIcon name="chevron-right" :size="4" class="shrink-0 text-ink-400" :stroke-width="2.2" />
          </RouterLink>
          <RouterLink v-if="canManageRoles" to="/admin/access" class="settings-row list-surface-row list-surface-row--interactive gap-3" @click="emit('close')">
            <span class="flex min-w-0 items-center gap-3"><span class="flex h-9 w-9 items-center justify-center text-ink-500"><AppIcon name="shield-check" :size="4" /></span><span><span class="block text-sm font-semibold">{{ t('access.roleManagement') }}</span><span class="mt-0.5 block text-xs text-ink-500">{{ t('access.manageMemberRolesAndPermissions') }}</span></span></span><AppIcon name="chevron-right" :size="4" class="text-ink-400" />
          </RouterLink>
          <button
            type="button"
            class="settings-row list-surface-row list-surface-row--interactive gap-3"
            @click="emit('restartApp')"
          >
            <span class="flex min-w-0 items-center gap-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center text-ink-500 dark:text-ink-300">
                <AppIcon name="restart" :size="4" :stroke-width="2" />
              </span>
              <span>
                <span class="block text-sm font-semibold text-ink-900 dark:text-ink-100">{{ t('settings.restartApp') }}</span>
                <span class="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">{{ t('settings.reloadTheAppAndItsConnections') }}</span>
              </span>
            </span>
            <AppIcon name="chevron-right" :size="4" class="shrink-0 text-ink-400" :stroke-width="2.2" />
          </button>
        </div>
      </section>

      <section :aria-label="t('settings.language')">
        <p class="settings-group-title">{{ t('settings.language') }}</p>
        <div class="settings-group list-surface">
          <button
            v-for="option in languageOptions"
            :key="option.value"
            type="button"
            class="settings-row list-surface-row list-surface-row--interactive"
            @click="setLocale(option.value)"
          >
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-ink-900 dark:text-ink-100">{{ t(option.label) }}</span>
              <span class="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">{{ t('settings.changeTheInterfaceLanguage') }}</span>
            </span>
            <SelectionMark :selected="locale === option.value" />
          </button>
        </div>
      </section>

      <section :aria-label="t('settings.moreResources')">
        <p class="settings-group-title">{{ t('settings.moreResources') }}</p>
        <div class="settings-group list-surface">
          <a
            :href="PROJECT_CHANGELOG_URL"
            target="_blank"
            rel="noreferrer"
            class="settings-row list-surface-row list-surface-row--interactive gap-3"
            @click="emit('close')"
          >
            <span class="flex min-w-0 items-center gap-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center text-ink-500 dark:text-ink-300">
                <AppIcon name="changelog" :size="4" :stroke-width="2" />
              </span>
              <span>
                <span class="block text-sm font-semibold text-ink-900 dark:text-ink-100">{{ t('settings.changelog') }}</span>
                <span class="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">{{ t('settings.seeTheLatestFeaturesAndFixes') }}</span>
              </span>
            </span>
            <AppIcon name="chevron-right" :size="4" class="shrink-0 text-ink-400" :stroke-width="2.2" />
          </a>
          <a :href="PROJECT_WEBSITE_URL" target="_blank" rel="noreferrer" class="settings-row list-surface-row list-surface-row--interactive gap-3" @click="emit('close')">
            <span class="flex min-w-0 items-center gap-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center text-ink-500 dark:text-ink-300"><AppIcon name="link" :size="4" :stroke-width="2" /></span>
              <span><span class="block text-sm font-semibold text-ink-900 dark:text-ink-100">{{ t('settings.officialWebsite') }}</span><span class="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">{{ t('settings.openTheNovaeWebsite') }}</span></span>
            </span>
            <AppIcon name="chevron-right" :size="4" class="shrink-0 text-ink-400" :stroke-width="2.2" />
          </a>
          <a :href="PROJECT_DOCS_URL" target="_blank" rel="noreferrer" class="settings-row list-surface-row list-surface-row--interactive gap-3" @click="emit('close')">
            <span class="flex min-w-0 items-center gap-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center text-ink-500 dark:text-ink-300"><AppIcon name="changelog" :size="4" :stroke-width="2" /></span>
              <span><span class="block text-sm font-semibold text-ink-900 dark:text-ink-100">{{ t('settings.documentation') }}</span><span class="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">{{ t('settings.readArchitectureAndUsageDocumentation') }}</span></span>
            </span>
            <AppIcon name="chevron-right" :size="4" class="shrink-0 text-ink-400" :stroke-width="2.2" />
          </a>
          <a :href="PROJECT_GITHUB_URL" target="_blank" rel="noreferrer" class="settings-row list-surface-row list-surface-row--interactive gap-3" @click="emit('close')">
            <span class="flex min-w-0 items-center gap-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center text-ink-500 dark:text-ink-300"><AppIcon name="code" :size="4" :stroke-width="2" /></span>
              <span><span class="block text-sm font-semibold text-ink-900 dark:text-ink-100">{{ t('settings.github') }}</span><span class="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">{{ t('issue.viewSourceCodeAndReportIssues') }}</span></span>
            </span>
            <AppIcon name="chevron-right" :size="4" class="shrink-0 text-ink-400" :stroke-width="2.2" />
          </a>
        </div>
      </section>

      <button
        type="button"
        class="button-danger w-full"
        @click="logoutDialogOpen = true"
      >
        {{ t('auth.signOutLabel') }}
      </button>
    </div>
  </div>

  <ConfirmDialog
    :open="logoutDialogOpen"
    :title="t('auth.signOut')"
    :message="t('auth.youWillNeedToSignInAgainWithYourSchoolGoogleAccount')"
    :confirm-label="t('auth.signOutLabel')"
    @cancel="logoutDialogOpen = false"
    @confirm="confirmLogout"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import UserAvatar from '@/components/ui/UserAvatar.vue';
import SelectionMark from '@/components/ui/SelectionMark.vue';
import {
  PROJECT_CHANGELOG_URL,
  PROJECT_DOCS_URL,
  PROJECT_GITHUB_URL,
  PROJECT_WEBSITE_URL,
  SCHOOL_NAME,
} from '@/constants/app';
import type { PersonalPushPreferenceKey, PersonalPushPreferences } from '@/services/notifications';
import { copyText } from '@/composables/useShareUrl';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { useI18n, type AppLocale } from '@/i18n';

const props = withDefaults(defineProps<{
  contentClass?: string;
  displayName: string;
  displayPhotoUrl: string | null;
  email: string;
  uid: string;
  isAdmin: boolean;
  canManageRoles: boolean;
  personalNotificationOptions: Array<{
    description: string;
    key: PersonalPushPreferenceKey;
    label: string;
  }>;
  personalPreferences: PersonalPushPreferences;
  pushActionLabel: string;
  pushEnabled: boolean;
  pushError: string;
  pushLoading: boolean;
  pushStatusDescription: string;
  showClose?: boolean;
  flat?: boolean;
}>(), {
  contentClass: '',
  showClose: false,
  flat: false,
});

const emit = defineEmits<{
  close: [];
  logout: [];
  restartApp: [];
  setPreference: [key: PersonalPushPreferenceKey, value: boolean];
  switchAccount: [];
  togglePush: [];
}>();

const logoutDialogOpen = ref(false);
const { show } = useActionFeedback();
const { locale, setLocale, t } = useI18n();
const languageOptions: Array<{ label: string; value: AppLocale }> = [
  { label: 'settings.traditionalChinese', value: 'zh-TW' },
  { label: 'settings.english', value: 'en' },
];

async function copyUid() {
  try {
    await copyText(props.uid);
    show(t('settings.uidCopied'), 'success');
  } catch {
    show(t('settings.unableToCopyUidPleaseTryAgainLater'), 'error');
  }
}

function confirmLogout() {
  logoutDialogOpen.value = false;
  emit('logout');
}
</script>
