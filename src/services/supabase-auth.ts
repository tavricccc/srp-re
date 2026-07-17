import type { User } from 'firebase/auth';
import { hasSupabaseConfig } from '@/lib/supabase';
import { withRequestTimeout } from '@/lib/request';
import { apiGatewayUrl, hasApiGatewayConfig } from '@/lib/api-gateway';
import { t } from '@/i18n';

interface SyncUserResponse {
  error?: string;
  ok?: boolean;
  role?: string;
}

const PROFILE_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1_000;
const PROFILE_SYNC_KEY_PREFIX = 'novae:profile-synced-at:';

function wasRecentlySynced(uid: string) {
  try {
    const syncedAt = Number.parseInt(localStorage.getItem(`${PROFILE_SYNC_KEY_PREFIX}${uid}`) ?? '0', 10);
    return Number.isFinite(syncedAt) && Date.now() - syncedAt < PROFILE_SYNC_INTERVAL_MS;
  } catch {
    return false;
  }
}

function rememberSync(uid: string) {
  try {
    localStorage.setItem(`${PROFILE_SYNC_KEY_PREFIX}${uid}`, String(Date.now()));
  } catch {
    // A blocked storage API should not prevent authentication.
  }
}

export async function ensureSupabaseAuthenticatedRole(user: User) {
  if (!hasSupabaseConfig() || !hasApiGatewayConfig()) return;

  const token = await withRequestTimeout(
    () => user.getIdTokenResult(),
    { label: 'auth.supabaseLoginInitialization' },
  );
  if (token.claims.role === 'authenticated' && wasRecentlySynced(user.uid)) return;

  const response = await withRequestTimeout(
    (signal) => fetch(apiGatewayUrl('/v1/auth/sync'), {
      method: 'POST',
      body: JSON.stringify({ email: user.email }),
      headers: {
        Authorization: `Bearer ${token.token}`,
        'Content-Type': 'application/json',
      },
      signal,
    }),
    { label: 'auth.supabaseLoginInitialization' },
  );
  let data: SyncUserResponse | null = null;
  try {
    data = await response.json() as SyncUserResponse;
  } catch {
    // Use the HTTP fallback below.
  }

  if (!response.ok || data?.ok !== true) {
    throw new Error(data?.error || t('service.supabaseAuthFailed', { status: response.status }));
  }
  rememberSync(user.uid);

  if (token.claims.role !== 'authenticated') {
    let refreshedToken = await withRequestTimeout(
      () => user.getIdTokenResult(true),
      { label: 'auth.supabaseLoginUpdate' },
    );
    let attempts = 0;
    while (refreshedToken.claims.role !== 'authenticated' && attempts < 3) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      refreshedToken = await withRequestTimeout(
        () => user.getIdTokenResult(true),
        { label: 'common.refreshingSupabaseSignIn' },
      );
      attempts++;
    }
    if (refreshedToken.claims.role !== 'authenticated') {
      throw new Error('auth.supabaseLoginInitializationHasNotBeenCompleted');
    }
  }
}
