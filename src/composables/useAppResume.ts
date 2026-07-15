import { onScopeDispose } from 'vue';
import { resetRouteRequestScope } from '@/lib/route-request';

type AppResumeReason = 'pageshow' | 'visibility';
type ResumeHandler = (reason: AppResumeReason, hiddenDurationMs: number) => void | Promise<void>;

const handlers = new Set<ResumeHandler>();
let initialized = false;
let hiddenAt = 0;
let lastResumeAt = 0;

function emitResume(reason: AppResumeReason, hiddenDurationMs = 0) {
  const now = Date.now();
  if (now - lastResumeAt < 500) return;
  lastResumeAt = now;
  resetRouteRequestScope();
  handlers.forEach((handler) => void handler(reason, hiddenDurationMs));
}

export function initializeAppResume() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) emitResume('pageshow', Number.POSITIVE_INFINITY);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    if (hiddenAt > 0) emitResume('visibility', Date.now() - hiddenAt);
    hiddenAt = 0;
  });
}

export function useAppResume(handler: ResumeHandler) {
  const unregister = registerAppResumeHandler(handler);
  onScopeDispose(unregister);
}

export function registerAppResumeHandler(handler: ResumeHandler) {
  handlers.add(handler);
  return () => handlers.delete(handler);
}
