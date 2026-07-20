import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  getAuth,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import { t } from '@/i18n';

const allowedDomain = String(import.meta.env.VITE_ALLOWED_DOMAIN ?? '').trim().toLowerCase();
const firebaseVapidKey = String(import.meta.env.VITE_FIREBASE_VAPID_KEY ?? '').trim();

const apiKey = String(import.meta.env.VITE_FIREBASE_API_KEY ?? '').trim();
const authDomain = String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '').trim();
const projectId = String(import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '').trim();
const appId = String(import.meta.env.VITE_FIREBASE_APP_ID ?? '').trim();
const messagingSenderId = String(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '').trim();
const authEmulatorUrl = String(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL ?? '').trim();

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  appId,
  messagingSenderId,
};

const missingConfig: string[] = [];
if (!apiKey) missingConfig.push('VITE_FIREBASE_API_KEY');
if (!authDomain) missingConfig.push('VITE_FIREBASE_AUTH_DOMAIN');
if (!projectId) missingConfig.push('VITE_FIREBASE_PROJECT_ID');
if (!appId) missingConfig.push('VITE_FIREBASE_APP_ID');

const firebaseInitError = missingConfig.length
  ? t('config.firebaseMissing', { keys: missingConfig.join(', ') })
  : '';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (!firebaseInitError) {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  try {
    auth = initializeAuth(app, {
      persistence: browserLocalPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    auth = getAuth(app);
  }
  if (auth && authEmulatorUrl) connectAuthEmulator(auth, authEmulatorUrl, { disableWarnings: true });
}
export { allowedDomain, app, auth, firebaseVapidKey };
