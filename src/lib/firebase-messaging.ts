import { app, firebaseVapidKey } from '@/lib/firebase';

export async function loadFirebaseMessaging() {
  if (!app || !firebaseVapidKey) return null;
  const sdk = await import('firebase/messaging');
  if (!await sdk.isSupported()) return null;
  return { messaging: sdk.getMessaging(app), sdk };
}
