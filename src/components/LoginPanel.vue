<template>
  <section class="panel panel-pad relative mx-auto flex w-full max-w-2xl flex-col items-center justify-center overflow-hidden px-6 py-12 text-center sm:px-12">
    <DecorativeGlow size="md" />

    <div class="relative z-10 flex max-w-md flex-col items-center space-y-6">
      <span class="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-950 text-white shadow-elevated dark:bg-ink-50 dark:text-ink-950" aria-hidden="true">
        <AppIcon name="shield-check" :size="8" :stroke-width="1.5" />
      </span>

      <div class="space-y-3">
        <h2 class="text-2xl font-semibold tracking-[0.015em] text-ink-950 dark:text-ink-50 sm:text-3xl">{{ t('auth.signInWithASchoolAccount') }}</h2>
        <p class="text-sm leading-relaxed text-ink-500 dark:text-ink-400">
          {{ t('auth.useYour') }}
          <span class="font-semibold text-ink-800 dark:text-ink-100">{{ t('auth.schoolGoogleAccount') }} (@{{ allowedDomain || t('auth.configuredSchoolDomain') }})</span>
          {{ t('auth.toContinue') }}
        </p>
      </div>

      <div class="flex w-full flex-col items-center gap-3">
        <GoogleLoginButton :loading="loading" @login="login" />

        <p v-if="error" class="mt-2 max-w-sm rounded-lg border border-error/20 bg-error-container px-3 py-1.5 text-xs font-medium text-on-error-container">
          {{ t(error) }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import DecorativeGlow from '@/components/ui/DecorativeGlow.vue';
import GoogleLoginButton from '@/components/ui/GoogleLoginButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { useSession } from '@/composables/useSession';
import { useI18n } from '@/i18n';

const { allowedDomain, error, loading, login } = useSession();
const { t } = useI18n();
</script>
