import { getRedirectResult, onAuthStateChanged, signOut } from 'firebase/auth';
import { computed, reactive } from 'vue';
import { auth, allowedDomain } from '@/lib/firebase';
import type { SessionState } from '@/composables/sessionTypes';
import { debugLog } from '@/composables/sessionDebug';
import { loginWithGoogle, logoutFromFirebase } from '@/composables/sessionAuthActions';
import {
  cacheUserAvatarOnLogin,
  clearActiveSessionData,
  customPhotoUrl,
  initActiveSessionData,
  mySupportedIssueIds,
  recordPlatformVisitOnLogin,
} from '@/composables/sessionEffects';
import { validateBasicUser, validateUserAgainstToken } from '@/composables/sessionValidation';
import { withRequestTimeout } from '@/lib/request';
import { ensureSupabaseAuthenticatedRole } from '@/services/supabase-auth';
import { fetchCurrentUserRole } from '@/services/session-role';
import { ensureContentRevisionsFresh } from '@/services/content-revisions';

const state = reactive<SessionState>({
  initialized: false,
  loading: true,
  authChecking: true,
  userLoading: false,
  appInitializing: true,
  appReady: false,
  roleLoading: false,
  user: null,
  userRole: 'user',
  roles: [],
  permissions: [],
  managedIssueCategoryIds: [],
  error: '',
});

let booted = false;
let verificationSerial = 0;
const sessionReadyWaiters: Array<() => void> = [];
const roleReadyWaiters: Array<() => void> = [];
let sessionStartupTimeout: number | null = null;

const SESSION_STARTUP_TIMEOUT_MS = 12_000;
const ROLE_READY_TIMEOUT_MS = 12_000;

function clearSessionStartupTimeout() {
  if (sessionStartupTimeout !== null) {
    window.clearTimeout(sessionStartupTimeout);
    sessionStartupTimeout = null;
  }
}

function resolveSessionReadyWaiters() {
  if (!state.appReady) return;
  while (sessionReadyWaiters.length > 0) {
    sessionReadyWaiters.shift()?.();
  }
}

function markAppReady() {
  clearSessionStartupTimeout();
  state.loading = false;
  state.authChecking = false;
  state.userLoading = false;
  state.appInitializing = false;
  state.initialized = true;
  state.appReady = true;
  resolveSessionReadyWaiters();
}

function recoverFromSessionStartupTimeout() {
  if (state.initialized) return;
  debugLog('session startup timed out; continuing without blocking the app');
  state.error = '登入狀態載入時間過長，已先開啟 App。';
  markAppReady();
}

function resolveRoleReadyWaiters() {
  if (state.roleLoading) return;
  while (roleReadyWaiters.length > 0) {
    roleReadyWaiters.shift()?.();
  }
}

function observeAuthState(firebaseAuth: NonNullable<typeof auth>) {
  void withRequestTimeout(() => getRedirectResult(firebaseAuth), { label: '登入回復' })
    .then((result) => {
      debugLog('getRedirectResult resolved', result
        ? {
            uid: result.user.uid,
            email: result.user.email ?? '',
            providerId: result.providerId ?? '',
          }
        : null);
    })
    .catch((error) => {
      debugLog('getRedirectResult failed', error);
      state.error = '登入失敗，請稍後再試。';
    });

  onAuthStateChanged(firebaseAuth, async (user) => {
    debugLog('onAuthStateChanged fired', user
      ? {
          uid: user.uid,
          email: user.email ?? '',
          emailVerified: user.emailVerified,
          providers: user.providerData.map((provider) => provider.providerId),
        }
      : null);
    const isStartupResolution = !state.initialized;
    state.loading = true;
    state.authChecking = false;
    if (isStartupResolution) {
      state.userLoading = Boolean(user);
      state.appInitializing = true;
      state.appReady = false;
    }
    state.error = '';

    try {
      if (!user) {
        debugLog('no active user after auth state change');
        clearActiveSessionData();
        verificationSerial += 1;
        state.user = null;
        state.roleLoading = false;
        resolveRoleReadyWaiters();
        return;
      }

      const basicValidation = validateBasicUser(user);
      if (!basicValidation.ok) {
        debugLog('basic validation failed', basicValidation);
        await rejectCurrentUser(basicValidation.reason);
        return;
      }

      acceptCurrentUser(user);
    } catch (error) {
      debugLog('auth state processing failed', error);
      state.error = '登入狀態檢查逾時，請重新載入。';
    } finally {
      markAppReady();
    }
  }, (error) => {
    debugLog('auth state observer failed', error);
    state.error = '登入狀態載入失敗，請稍後再試。';
    if (!state.initialized) {
      markAppReady();
    }
  });
}

async function rejectCurrentUser(reason: string) {
  if (!auth) return;
  const firebaseAuth = auth;

  clearActiveSessionData();
  verificationSerial += 1;
  state.user = null;
  state.userRole = 'user';
  state.roles = [];
  state.permissions = [];
  state.managedIssueCategoryIds = [];
  state.roleLoading = false;
  state.error = reason;
  try {
    await withRequestTimeout(() => signOut(firebaseAuth), { label: '登出' });
  } finally {
    resolveRoleReadyWaiters();
    markAppReady();
  }
}

function acceptCurrentUser(user: NonNullable<SessionState['user']>) {
  debugLog('login accepted', {
    uid: user.uid,
    email: user.email ?? '',
  });

  void initActiveSessionData(user.uid);
  const verificationId = ++verificationSerial;
  state.user = user;
  state.userRole = 'user';
  state.roles = [];
  state.permissions = [];
  state.managedIssueCategoryIds = [];
  state.roleLoading = true;
  void refreshVerifiedSession(user, verificationId);

  if (user.photoURL) {
    void cacheUserAvatarOnLogin(user.photoURL);
  }
  void recordPlatformVisitOnLogin();
}

function isCurrentVerification(user: NonNullable<SessionState['user']>, verificationId: number) {
  return verificationId === verificationSerial && state.user?.uid === user.uid;
}

async function refreshVerifiedSession(user: NonNullable<SessionState['user']>, verificationId: number) {
  try {
    const tokenValidation = await validateUserAgainstToken(user);
    if (!isCurrentVerification(user, verificationId)) return;
    if (!tokenValidation.ok) {
      debugLog('background token validation failed', tokenValidation);
      await rejectCurrentUser(tokenValidation.reason);
      return;
    }

    try {
      await ensureSupabaseAuthenticatedRole(user);
      if (!isCurrentVerification(user, verificationId)) return;
      await ensureContentRevisionsFresh().catch(() => undefined);
      if (!isCurrentVerification(user, verificationId)) return;
    } catch (error) {
      debugLog('background supabase auth initialization failed', error);
      await rejectCurrentUser('登入初始化失敗，請重新登入後再試。');
      return;
    }

    const access = await fetchCurrentUserRole();
    if (!isCurrentVerification(user, verificationId)) return;
    state.userRole = access.role;
    state.roles = access.roles;
    state.permissions = access.permissions;
    state.managedIssueCategoryIds = access.managedIssueCategoryIds;
  } catch (error) {
    if (!isCurrentVerification(user, verificationId)) return;
    debugLog('background session verification failed', error);
    state.userRole = 'user';
    state.roles = [];
    state.permissions = [];
    state.managedIssueCategoryIds = [];
  } finally {
    if (isCurrentVerification(user, verificationId)) {
      state.roleLoading = false;
      resolveRoleReadyWaiters();
    }
  }
}

export function initializeSession() {
  if (booted) {
    return;
  }

  booted = true;
  if (!auth) {
    state.user = null;
    state.error = '服務暫時無法使用，請稍後再試。';
    markAppReady();
    return;
  }

  const firebaseAuth = auth;
  sessionStartupTimeout = window.setTimeout(
    recoverFromSessionStartupTimeout,
    SESSION_STARTUP_TIMEOUT_MS,
  );
  observeAuthState(firebaseAuth);
}

export function waitForSessionReady() {
  initializeSession();
  if (state.appReady) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    sessionReadyWaiters.push(resolve);
  });
}

export function waitForRoleReady(): Promise<boolean> {
  initializeSession();
  if (!state.roleLoading) {
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let timeoutId = 0;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      const waiterIndex = roleReadyWaiters.indexOf(roleReady);
      if (waiterIndex >= 0) roleReadyWaiters.splice(waiterIndex, 1);
      resolve(ready);
    };
    const roleReady = () => finish(true);
    roleReadyWaiters.push(roleReady);
    timeoutId = window.setTimeout(() => finish(false), ROLE_READY_TIMEOUT_MS);
  });
}

export function useSession() {
  const userEmail = computed(() => String(state.user?.email ?? '').toLowerCase());
  const userRole = computed(() => state.userRole);
  const permissions = computed(() => state.permissions);

  return {
    user: computed(() => state.user),
    userEmail,
    userRole,
    roles: computed(() => state.roles),
    permissions,
    managedIssueCategoryIds: computed(() => state.managedIssueCategoryIds),
    canManageIssueCategory: (categoryId: string) => state.roles.includes('platform-admin') || state.managedIssueCategoryIds.includes(categoryId),
    can: (permission: import('@/services/session-role').PermissionCode) => permissions.value.includes(permission),
    isAdmin: computed(() => state.roles.includes('platform-admin')),
    loading: computed(() => state.loading),
    roleLoading: computed(() => state.roleLoading),
    authChecking: computed(() => state.authChecking),
    userLoading: computed(() => state.userLoading),
    appInitializing: computed(() => state.appInitializing),
    appReady: computed(() => state.appReady),
    initialized: computed(() => state.initialized),
    error: computed(() => state.error),
    isAllowedUser: computed(() => Boolean(state.user)),
    mySupportedIssueIds,
    customPhotoUrl,
    allowedDomain,
    login: (options?: { selectAccount?: boolean }) => loginWithGoogle(state, options),
    logout: () => logoutFromFirebase(state),
  };
}
