import { invokeBackendAction } from '@/services/backend-action';
import { READ_REQUEST_TIMEOUT_MS } from '@/lib/request';
import { toReadableBackendError } from './issues-core';
import { runCoalescedContentRequest } from '@/services/content-read-cache';
import type { UserPublicProfile } from '@/types';

const USER_PROFILE_REQUEST_PREFIX = 'user-profile|';

export async function fetchUserPublicProfiles(uids: string[]) {
  const uniqueUids = Array.from(new Set(uids.filter((uid) => uid && uid.trim().length > 0)))
    .map((uid) => uid.trim())
    .slice(0, 50);

  if (uniqueUids.length === 0) {
    return {};
  }

  try {
    const requestKey = `${USER_PROFILE_REQUEST_PREFIX}${[...uniqueUids].sort().join(',')}`;
    return await runCoalescedContentRequest(requestKey, async () => {
      const fn = invokeBackendAction<{ uids: string[] }, { profiles: Record<string, UserPublicProfile> }>(
        'getUserPublicProfiles',
        { timeoutMs: READ_REQUEST_TIMEOUT_MS },
      );
      return (await fn({ uids: uniqueUids })).profiles;
    });
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
