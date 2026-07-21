import { ref } from 'vue';
import { recordPlatformVisit } from '@/services/dashboard';
import { cacheUserAvatar } from '@/services/users-write';
import { clearResolvedUploadCache } from '@/services/uploads';
import { clearContentReadCache, clearContentReadMemoryCache, setContentCacheScope } from '@/services/content-read-cache';
import { ensureContentRevisionsFresh, resetContentRevisionState } from '@/services/content-revisions';
import { registerAppResumeHandler } from '@/composables/useAppResume';
import { clearAuthorProfileCache } from '@/composables/useAuthorProfile';

export const mySupportedIssueIds = ref<Set<string>>(new Set());
export const customPhotoUrl = ref<string | null>(null);

let activeSessionToken = 0;
const VISIT_RECORD_INTERVAL_MS = 6 * 60 * 60 * 1_000;
const VISIT_RECORDED_AT_KEY = 'novae:platform-visit-recorded-at';
const CONTENT_REVISION_RESUME_MS = 10 * 60_000;
let revisionResumeInitialized = false;

function initializeContentRevisionResume() {
  if (revisionResumeInitialized) return;
  revisionResumeInitialized = true;
  registerAppResumeHandler((reason, hiddenDurationMs) => {
    if (reason !== 'pageshow' && hiddenDurationMs < CONTENT_REVISION_RESUME_MS) return;
    void ensureContentRevisionsFresh({ notify: true }).catch(() => undefined);
  });
}

export function clearActiveSessionData() {
  activeSessionToken += 1;
  mySupportedIssueIds.value = new Set();
  customPhotoUrl.value = null;
  clearResolvedUploadCache();
  clearContentReadCache();
  resetContentRevisionState();
}

export async function initActiveSessionData(uid: string) {
  activeSessionToken += 1;
  mySupportedIssueIds.value = new Set();
  customPhotoUrl.value = null;
  clearResolvedUploadCache();
  clearAuthorProfileCache();
  setContentCacheScope(uid);
  clearContentReadMemoryCache();
  initializeContentRevisionResume();
}

export async function cacheUserAvatarOnLogin(photoURL: string) {
  try {
    const photoUrl = await cacheUserAvatar(photoURL);
    if (photoUrl) {
      customPhotoUrl.value = photoUrl;
      clearAuthorProfileCache();
    }
  } catch {
    void 0;
  }
}

export async function recordPlatformVisitOnLogin() {
  const lastRecordedAt = Number.parseInt(localStorage.getItem(VISIT_RECORDED_AT_KEY) || '0', 10);
  if (Number.isFinite(lastRecordedAt) && Date.now() - lastRecordedAt < VISIT_RECORD_INTERVAL_MS) return;
  try {
    await recordPlatformVisit();
    localStorage.setItem(VISIT_RECORDED_AT_KEY, String(Date.now()));
  } catch {
    void 0;
  }
}
