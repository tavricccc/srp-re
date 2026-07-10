export const CONTENT_READ_CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry<T> {
  stale: boolean;
  updatedAt: number;
  value: T;
}

const cache = new Map<string, CacheEntry<unknown>>();
let realtimeReliable = true;
let wasOffline = false;

export function createContentCacheKey(parts: Array<string | number | boolean | null | undefined>) {
  return parts.map((part) => {
    if (part === null) return 'null';
    if (part === undefined) return 'undefined';
    return String(part);
  }).join('|');
}

export function isContentCacheFresh(updatedAt: number, now = Date.now()) {
  return now - updatedAt < CONTENT_READ_CACHE_TTL_MS;
}

export function getCachedContent<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || entry.stale || !isContentCacheFresh(entry.updatedAt)) return null;
  return entry.value as T;
}

export function getCachedContentEntry<T>(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  return {
    stale: entry.stale,
    updatedAt: entry.updatedAt,
    value: entry.value as T,
  };
}

export function setCachedContent<T>(key: string, value: T, updatedAt = Date.now()) {
  cache.set(key, {
    stale: false,
    updatedAt,
    value,
  });
}

export function patchCachedContent<T>(key: string, updater: (value: T) => T) {
  const entry = cache.get(key);
  if (!entry) return;
  entry.value = updater(entry.value as T);
  entry.updatedAt = Date.now();
  entry.stale = false;
}

export function markContentCacheStale(predicate: (key: string) => boolean) {
  cache.forEach((entry, key) => {
    if (predicate(key)) entry.stale = true;
  });
}

export function markContentCachePrefixStale(prefix: string) {
  markContentCacheStale((key) => key.startsWith(prefix));
}

export function clearContentReadCache() {
  cache.clear();
}

export function markContentRealtimeUnreliable() {
  realtimeReliable = false;
}

export function markContentRealtimeReliable() {
  realtimeReliable = true;
  wasOffline = false;
}

export function markContentWentOffline() {
  wasOffline = true;
}

export function shouldRefreshContentAfterResume(updatedAt: number) {
  return wasOffline || !realtimeReliable || !isContentCacheFresh(updatedAt);
}
