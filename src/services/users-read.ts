import { invokeBackendAction } from '@/services/backend-action';
import { READ_REQUEST_TIMEOUT_MS } from '@/lib/request';
import { toReadableBackendError } from './issues-core';
import {
  captureContentCacheWriteGuard,
  createContentCacheKey,
  getCachedContentPersistent,
  runCoalescedContentRequest,
  setCachedContentFromRead,
} from '@/services/content-read-cache';

const USER_AVATAR_CACHE_PREFIX = 'user-avatar|';

export async function fetchUserAvatarUrls(uids: string[]) {
  const uniqueUids = Array.from(new Set(uids.filter((uid) => uid && uid.trim().length > 0)))
    .map((uid) => uid.trim())
    .slice(0, 50);

  if (uniqueUids.length === 0) {
    return {};
  }

  const cachedEntries = await Promise.all(uniqueUids.map(async (uid) => [
    uid,
    await getCachedContentPersistent<{ value: string | null }>(
      createContentCacheKey(['user-avatar', uid]),
    ),
  ] as const));
  const avatars = Object.fromEntries(cachedEntries.flatMap(([uid, entry]) =>
    entry ? [[uid, entry.value] as const] : []
  ));
  const missingUids = uniqueUids.filter((uid) => !(uid in avatars));
  if (missingUids.length === 0) return avatars;
  const cacheGuards = new Map(missingUids.map((uid) => {
    const key = createContentCacheKey(['user-avatar', uid]);
    return [uid, captureContentCacheWriteGuard(key)] as const;
  }));

  try {
    const requestKey = `${USER_AVATAR_CACHE_PREFIX}request|${[...missingUids].sort().join(',')}`;
    const fetched = await runCoalescedContentRequest(requestKey, async () => {
      const fn = invokeBackendAction<{ uids: string[] }, { avatars: Record<string, string | null> }>(
        'getUserAvatarUrls',
        { timeoutMs: READ_REQUEST_TIMEOUT_MS },
      );
      return (await fn({ uids: missingUids })).avatars;
    });
    missingUids.forEach((uid) => {
      const value = fetched[uid] ?? null;
      avatars[uid] = value;
      const cacheGuard = cacheGuards.get(uid);
      if (cacheGuard) setCachedContentFromRead(cacheGuard, { value });
    });
    return avatars;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
