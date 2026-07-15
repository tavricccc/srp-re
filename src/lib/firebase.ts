import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, initializeAuth, type Auth } from 'firebase/auth';

const allowedDomain = String(import.meta.env.VITE_ALLOWED_DOMAIN ?? '').trim().toLowerCase();
const firebaseVapidKey = readEnv('VITE_FIREBASE_VAPID_KEY');

function readEnv(name: string) {
  return String(import.meta.env[name as keyof ImportMetaEnv] ?? '').trim();
}

const firebaseConfig = {
  apiKey: readEnv('VITE_FIREBASE_API_KEY'),
  authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
  appId: readEnv('VITE_FIREBASE_APP_ID'),
  messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
};

const requiredConfig = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

const missingConfig = requiredConfig.filter((key) => !readEnv(key));

const firebaseInitError = missingConfig.length
  ? `Firebase 設定缺少：${missingConfig.join(', ')}。請在本機 .env 或部署環境變數中補齊。`
  : '';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (!firebaseInitError) {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  try {
    auth = initializeAuth(app, { persistence: browserLocalPersistence });
  } catch {
    auth = getAuth(app);
  }
}
export { allowedDomain, app, auth, firebaseVapidKey };
