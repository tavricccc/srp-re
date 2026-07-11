import { app } from '@/lib/firebase';

let initialization: Promise<void> | null = null;

function readEnv(name: string) {
  return String(import.meta.env[name as keyof ImportMetaEnv] ?? '').trim();
}

export function ensureFirebaseAppCheck() {
  if (initialization) return initialization;
  initialization = (async () => {
    if (!app || readEnv('VITE_FIREBASE_APP_CHECK_ENABLED') !== 'true') return;
    const siteKey = readEnv('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY');
    if (!siteKey) return;
    const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('firebase/app-check');
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  })();
  return initialization;
}
