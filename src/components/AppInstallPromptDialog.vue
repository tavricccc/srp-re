<template>
  <DialogOverlay :open="open" padded z-index-class="z-[80]" :persistent="preventDismiss">
    <section
      ref="dialogRef"
      class="panel dialog-card flex flex-col !overflow-hidden md:max-w-2xl md:max-h-[min(85dvh,780px)]"
      data-dialog-root
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-install-prompt-title"
      aria-describedby="app-install-prompt-description"
      tabindex="-1"
    >
      <div class="min-h-0 flex-1 overflow-y-auto px-5 pt-6 pb-5 md:px-8 md:pt-8 md:pb-6">
        <div class="flex items-start justify-between gap-4 pb-2">
          <div class="flex min-w-0 items-start gap-4">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/60 bg-white/90 shadow-note dark:border-ink-700/80 dark:bg-ink-900/80" aria-hidden="true">
              <AppIcon :name="content.icon" :size="6" :stroke-width="2.1" class="text-current" :class="content.iconToneClass" />
            </div>

            <div class="min-w-0 flex-1">
              <h2 id="app-install-prompt-title" class="text-[1.75rem] font-semibold tracking-[0.015em] text-ink-950 dark:text-ink-50 md:text-3xl">
                {{ content.title }}
              </h2>
              <p v-if="content.description" id="app-install-prompt-description" class="mt-2 max-w-2xl text-sm leading-6 text-ink-600 dark:text-ink-300 md:text-base">
                {{ content.description }}
              </p>
            </div>
          </div>
        </div>

        <div class="mt-5">
          <div class="flex flex-wrap items-center gap-2">
            <span class="tag border-primary/30 bg-primary-container/70 text-on-primary-container dark:border-primary/40 dark:bg-primary-container/30 dark:text-primary">
              {{ content.badge }}
            </span>
            <span v-if="content.secondaryBadge" class="tag border-ink-200/80 bg-white/80 text-ink-600 dark:border-ink-700/80 dark:bg-ink-900/70 dark:text-ink-300">
              {{ content.secondaryBadge }}
            </span>
          </div>
        </div>

        <div class="mt-6">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-base font-semibold tracking-[0.015em] text-ink-950 dark:text-ink-50">{{ t('app.install.steps') }}</h3>
            <span class="tag">{{ t('app.install.stepCount', { count: content.steps.length }) }}</span>
          </div>

          <ol v-if="content.steps.length" class="mt-4 space-y-3">
            <li
              v-for="(step, index) in content.steps"
              :key="`${index}-${step.title}`"
              class="flex gap-3 border-b border-ink-100/80 pb-3 last:border-b-0 last:pb-0 dark:border-ink-800/80"
            >
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-900 text-sm font-bold text-white dark:bg-ink-100 dark:text-ink-900">
                {{ index + 1 }}
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-semibold text-ink-900 dark:text-ink-100">{{ step.title }}</span>
                <span v-if="step.description" class="mt-1 block text-xs leading-5 text-ink-500 dark:text-ink-400">{{ step.description }}</span>
              </span>
            </li>
          </ol>

          <div v-if="content.notes.length || content.actionTitle" class="mt-6 space-y-4">
            <div v-if="content.notes.length">
              <h4 class="text-sm font-semibold text-ink-900 dark:text-ink-100">{{ t('app.install.notes') }}</h4>
              <ul class="mt-3 space-y-2">
                <li
                  v-for="note in content.notes"
                  :key="note"
                  class="flex gap-2 text-sm leading-6 text-ink-600 dark:text-ink-300"
                >
                  <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"></span>
                  <span>{{ note }}</span>
                </li>
              </ul>
            </div>

            <div v-if="content.actionTitle">
              <p class="text-sm font-semibold text-ink-900 dark:text-ink-100">{{ content.actionTitle }}</p>
              <p class="mt-1 text-xs leading-5 text-ink-500 dark:text-ink-400">{{ content.actionDescription }}</p>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="!preventDismiss || content.primaryLabel"
        class="dialog-actions border-t border-ink-100 bg-white/95 px-5 pb-6 pt-4 backdrop-blur dark:border-ink-800 dark:bg-ink-950/95 md:px-8 md:pb-8 md:pt-4"
      >
        <button
          v-if="!preventDismiss"
          type="button"
          class="button-secondary"
          @click="handleSecondaryAction"
        >
          {{ content.secondaryLabel }}
        </button>
        <button
          v-if="content.primaryLabel"
          type="button"
          class="button-primary gap-2"
          data-autofocus
          :disabled="installing"
          @click="handlePrimaryAction"
        >
          <AppIcon v-bind="primaryIconProps" class="shrink-0" />
          {{ content.primaryLabel }}
        </button>
      </div>
    </section>

    <ConfirmDialog
      :danger="false"
      :open="isSkipConfirmOpen"
      title="app.install.areYouSureYouWantToSkipItFirst"
      message="app.install.areYouSureYouWantToSkipThisStepYouCanStillTurnOnTheInstallationPromptLater"
      cancel-label="app.install.continueToView"
      confirm-label="app.install.confirmSkip"
      @cancel="isSkipConfirmOpen = false"
      @confirm="confirmSkip"
    />
  </DialogOverlay>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import DialogOverlay from '@/components/ui/DialogOverlay.vue';
import { useBodyScrollLock } from '@/composables/useBodyScrollLock';
import { useDialogFocus } from '@/composables/useDialogFocus';
import type { AppInstallPromptMode } from '@/composables/useAppInstallPrompt';
import type { InAppBrowserName } from '@/lib/in-app-browser';
import type { AppInstallPromptReason, IosBrowserGuide } from '@/lib/pwa-install';
import { useI18n } from '@/i18n';

type InstallStep = {
  description?: string;
  title: string;
};

type InstallContent = {
  actionDescription: string;
  actionTitle: string;
  badge: string;
  description: string;
  icon: 'download' | 'share' | 'warning';
  iconToneClass: string;
  notes: string[];
  primaryLabel: string | null;
  secondaryBadge: string;
  secondaryLabel: string;
  steps: InstallStep[];
  title: string;
};

const props = defineProps<{
  canInstallNatively: boolean;
  iosBrowserGuide: IosBrowserGuide | null;
  open: boolean;
  mode: AppInstallPromptMode;
  browserName: InAppBrowserName | null;
  installing: boolean;
  reason: AppInstallPromptReason;
}>();

const emit = defineEmits<{
  close: [];
  copyUrl: [];
  install: [];
}>();
const { t } = useI18n();

const contentKeys = computed<InstallContent>(() => {
  const isNotificationInstall = props.reason === 'notifications';
  const installDescription = isNotificationInstall
    ? 'app.install.forReliableNotificationsAddTheAppToTheHomeScreenAndOpenItFromThere'
    : 'app.install.homeScreenAppBenefit';

  if (props.mode === 'in-app-browser') {
    return {
      actionDescription: 'app.install.openThisPageInTheSystemBrowserThenFollowItsStepsToAddTheAppToTheHomeScreen',
      actionTitle: 'app.install.switchTheOpeningMethodFirst',
      badge: isNotificationInstall ? 'app.install.notificationsRequireHomeScreenMode' : 'app.install.itIsRecommendedToSwitchBrowsers',
      description: t(
        isNotificationInstall
          ? 'app.install.inAppBrowser.notifications'
          : 'app.install.inAppBrowser.description',
        { browser: props.browserName ?? 'App' },
      ),
      icon: 'warning',
      iconToneClass: 'text-warning',
      notes: ['app.install.notificationsRequireInstalledApp'],
      primaryLabel: null,
      secondaryBadge: props.browserName
        ? t('app.install.inAppBrowser.badge', { browser: props.browserName })
        : '',
      secondaryLabel: 'app.install.maybeLater',
      steps: [
        { title: 'app.install.clickTheMenuButton', description: 'app.install.clickTheMenuIconInTheUpperRightOrLowerRightCornerUsuallyTheThreeDotsShareOrCompassIcon' },
        { title: 'app.install.selectOpenWithBrowser', description: 'app.install.clickOpenInSafariOpenInDefaultBrowserOrOpenInOtherApplicationInTheMenu' },
        { title: 'app.install.followTheStepsToAddItToTheHomeScreen', description: 'app.install.systemBrowserGuidedInstall' },
      ],
      title: isNotificationInstall ? 'app.install.installUsingTheSystemBrowser' : 'app.install.itIsRecommendedToUseTheSystemBrowserInstead',
    };
  }

  if (props.mode === 'ios-open-safari') {
    const browserName = props.iosBrowserGuide === 'Google' ? 'Google App' : 'Chrome';
    return {
      actionDescription: 'app.install.openCurrentUrlInSafari',
      actionTitle: 'app.install.firstMoveTheUrlToSafari',
      badge: 'app.install.needToUseSafariInstead',
      description: t(
        isNotificationInstall
          ? 'app.install.safari.notifications'
          : 'app.install.safari.description',
        { browser: browserName },
      ),
      icon: 'share',
      iconToneClass: 'text-secondary',
      notes: ['app.install.safariNotificationLaunchReminder'],
      primaryLabel: props.installing ? 'app.install.copying' : 'app.install.copyUrl',
      secondaryBadge: browserName,
      secondaryLabel: 'app.install.skipItFirst',
      steps: [
        { title: 'app.install.clickCopyUrl', description: 'app.install.firstSaveTheUrlOfTheCurrentPageToTheClipboard' },
        { title: 'app.install.changeToSafariToEnable', description: 'app.install.pasteTheUrlAndGoToTheSamePage' },
        { title: 'app.install.longPressOnTheAddressBar', description: 'app.install.longPressTheAddressBarAboveInSafariToCallOutRelatedOperations' },
        { title: 'app.install.selectShareButton', description: 'app.install.selectShareFromTheActionThatPopsUp' },
        { title: 'app.install.installedAsApp', description: 'app.install.scrollDownAndSelectAddToHomeScreenThenFollowTheOnScreenInstructions' },
      ],
      title: 'app.install.pleaseUseSafariToOpenItInstead',
    };
  }

  if (props.mode === 'ios-install') {
    return {
      actionDescription: '',
      actionTitle: 'app.install.followTheSteps',
      badge: isNotificationInstall ? 'app.install.installFirstToEnableNotifications' : 'app.install.safariInstallationProcess',
      description: '',
      icon: 'share',
      iconToneClass: 'text-primary',
      notes: [installDescription, 'app.install.ifAddToHomeScreenIsNotShownEditTheActionsAtTheBottomOfTheShareMenuThenTryAgain', 'app.install.afterTheInstallationIsCompletePleaseReEnterThePlatformFromTheDesktopIcon'],
      primaryLabel: null,
      secondaryBadge: 'Safari',
      secondaryLabel: 'app.install.maybeLater',
      steps: [
        { title: 'app.install.longPressOnTheAddressBar', description: 'app.install.firstLongPressTheAddressBarOfTheCurrentPageAboveSafari' },
        { title: 'app.install.selectShareButton', description: 'app.install.selectShareFromTheActionsThatAppear' },
        { title: 'app.install.installedAsApp', description: 'app.install.scrollDownTheSharingMenuFindAndClickAddToHomeScreen' },
        { title: 'app.install.confirmHowTheAppOpens', description: 'app.install.ifYouSeeOpenAsWebAppPleaseKeepItOpen' },
        { title: 'app.install.clickAddToCompleteTheInstallation', description: 'app.install.returnToTheHomeScreenAndReopenTheAppFromItsNewIcon' },
      ],
      title: isNotificationInstall ? 'app.install.installTheAppToUseNotifications' : 'app.install.installedAsApp',
    };
  }

  return {
    actionDescription: '',
    actionTitle: props.canInstallNatively ? 'app.install.theSystemWillTakeOverTheInstallation' : '',
    badge: isNotificationInstall ? 'app.install.turnOnNotificationsAfterInstallation' : 'app.install.installOnAndroidHomeScreen',
    description: installDescription,
    icon: 'download',
    iconToneClass: 'text-primary',
    notes: props.canInstallNatively
      ? ['app.install.installationPromptAvailableLater']
      : ['app.install.ifTheSystemInstallPromptDoesNotAppearChooseInstallAppOrAddToHomeScreenFromTheBrowserMenu'],
    primaryLabel: props.canInstallNatively ? (props.installing ? 'app.install.opening' : 'app.install.installApp') : null,
    secondaryBadge: props.canInstallNatively ? 'app.install.systemInstallationWindow' : 'app.install.browserMenu',
    secondaryLabel: 'app.install.skipItFirst',
    steps: [
      { title: props.canInstallNatively ? 'app.install.clickInstallApp' : 'app.install.openBrowserMenu', description: props.canInstallNatively ? 'app.install.theSystemWillOpenTheAndroidNativeInstallationPrompt' : 'app.install.lookForTheInstallationOptionInYourCurrentBrowserSMenu' },
      { title: 'app.install.installedAsApp', description: props.canInstallNatively ? 'app.install.followTheSystemDialogBoxToCompleteTheInstallationOrAddAShortcut' : 'app.install.selectInstallAppOrAddToHomeScreenToFinish' },
      { title: 'app.install.openThePlatformFromTheHomeScreen', description: isNotificationInstall ? 'app.install.turnItBackOnAndGoBackToNotificationSettings' : 'app.install.afterThatYouCanEnterDirectlyLikeNormalApp' },
    ],
    title: isNotificationInstall ? 'app.install.installTheAppToUseNotifications' : 'app.install.installApp',
  };
});

const content = computed<InstallContent>(() => ({
  ...contentKeys.value,
  actionDescription: t(contentKeys.value.actionDescription),
  actionTitle: t(contentKeys.value.actionTitle),
  badge: t(contentKeys.value.badge),
  description: t(contentKeys.value.description),
  notes: contentKeys.value.notes.map((note) => t(note)),
  primaryLabel: contentKeys.value.primaryLabel ? t(contentKeys.value.primaryLabel) : null,
  secondaryLabel: t(contentKeys.value.secondaryLabel),
  steps: contentKeys.value.steps.map((step) => ({
    description: step.description ? t(step.description) : undefined,
    title: t(step.title),
  })),
  title: t(contentKeys.value.title),
}));

const primaryIconProps = computed(() => {
  if (props.mode === 'ios-open-safari' || props.mode === 'ios-install') return { name: 'share' as const, size: 4 };
  if (props.mode === 'native-install') return { name: 'download' as const, size: 4, strokeWidth: 2.2 };
  return { name: 'close' as const, size: 4, strokeWidth: 2.2 };
});
const isSkipConfirmOpen = ref(false);

const preventDismiss = computed(() => {
  return props.mode === 'in-app-browser' || props.mode === 'ios-open-safari';
});

useBodyScrollLock(toRef(props, 'open'));

const { dialogRef } = useDialogFocus(toRef(props, 'open'), {
  onClose: () => emit('close'),
  persistent: preventDismiss,
});

function handlePrimaryAction() {
  if (props.mode === 'native-install' && props.canInstallNatively) {
    emit('install');
    return;
  }

  if (props.mode === 'ios-install') {
    emit('close');
    return;
  }

  if (props.mode === 'ios-open-safari') {
    emit('copyUrl');
    return;
  }

  emit('close');
}

function handleSecondaryAction() {
  isSkipConfirmOpen.value = true;
}

function confirmSkip() {
  isSkipConfirmOpen.value = false;
  emit('close');
}
</script>
