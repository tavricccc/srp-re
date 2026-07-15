import {
  clearPersistentCacheScope,
  deletePersistentCacheByPrefix,
  readPersistentCache,
  writePersistentCache,
} from '@/lib/persistent-cache';

export const CONTENT_READ_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
export const CONTENT_SHORT_CACHE_TTL_MS = 10 * 60 * 1_000;

interface CacheEntry<T> {
  stale: boolean;
  updatedAt: number;
  value: T;
}

const cache = new Map<string, CacheEntry<unknown>>();
const pendingPersistentReads = new Map<string, Promise<unknown | null>>();
const pendingRequests = new Map<string, Promise<unknown>>();
const pendingInvalidations = new Map<string, Promise<void>>();
const MAX_MEMORY_CACHE_ENTRIES = 2_000;
let activeScope = 'anonymous';
let realtimeReliable = true;
let wasOffline = false;

function scopedKey(key: string) {
  return `${activeScope}\u0000${key}`;
}

export function setContentCacheScope(scope: string) {
  const normalized = scope.trim() || 'anonymous';
  if (normalized === activeScope) return;
  activeScope = normalized;
  cache.clear();
  pendingPersistentReads.clear();
  pendingRequests.clear();
}

export function createContentCacheKey(parts: Array<string | number | boolean | null | undefined>) {
  return parts.map((part) => {
    if (part === null) return 'null';
    if (part === undefined) return 'undefined';
    return String(part);
  }).join('|');
}

export function isContentCacheFresh(updatedAt: number, now = Date.now(), maxAgeMs = CONTENT_READ_CACHE_TTL_MS) {
  return now - updatedAt < maxAgeMs;
}

export function getCachedContent<T>(key: string, maxAgeMs = CONTENT_READ_CACHE_TTL_MS): T | null {
  const entry = cache.get(key);
  if (!entry || entry.stale || !isContentCacheFresh(entry.updatedAt, Date.now(), maxAgeMs)) return null;
  return entry.value as T;
}

export async function getCachedContentPersistent<T>(key: string, maxAgeMs = CONTENT_READ_CACHE_TTL_MS) {
  const memoryCached = getCachedContent<T>(key, maxAgeMs);
  if (memoryCached) return memoryCached;

  const persistentKey = scopedKey(key);
  const relevantInvalidations = Array.from(pendingInvalidations.entries())
    .filter(([invalidationKey]) => {
      const separatorIndex = invalidationKey.indexOf('\u0000');
      return invalidationKey.slice(0, separatorIndex) === activeScope
        && key.startsWith(invalidationKey.slice(separatorIndex + 1));
    })
    .map(([, pending]) => pending);
  if (relevantInvalidations.length > 0) await Promise.all(relevantInvalidations);
  const existing = pendingPersistentReads.get(persistentKey);
  if (existing) return await existing as T | null;

  const scopeAtRead = activeScope;
  const pending = readPersistentCache<T>(persistentKey).then((entry) => {
    if (!entry || entry.scope !== scopeAtRead || !isContentCacheFresh(entry.updatedAt, Date.now(), maxAgeMs)) return null;
    if (activeScope !== scopeAtRead) return null;
    cache.set(key, { stale: false, updatedAt: entry.updatedAt, value: entry.value });
    return entry.value;
  }).finally(() => pendingPersistentReads.delete(persistentKey));
  pendingPersistentReads.set(persistentKey, pending);
  return await pending;
}

export function getCachedContentEntry<T>(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  return { stale: entry.stale, updatedAt: entry.updatedAt, value: entry.value as T };
}

export function setCachedContent<T>(key: string, value: T, updatedAt = Date.now()) {
  cache.set(key, { stale: false, updatedAt, value });
  const scope = activeScope;
  void writePersistentCache({ cacheKey: key, key: `${scope}\u0000${key}`, scope, updatedAt, value });

  while (cache.size > MAX_MEMORY_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey !== 'string') break;
    cache.delete(oldestKey);
  }
}

export function runCoalescedContentRequest<T>(key: string, request: () => Promise<T>) {
  const scopedRequestKey = scopedKey(key);
  const existing = pendingRequests.get(scopedRequestKey);
  if (existing) return existing as Promise<T>;
  const pending = request().finally(() => pendingRequests.delete(scopedRequestKey));
  pendingRequests.set(scopedRequestKey, pending);
  return pending;
}

export function patchCachedContent<T>(key: string, updater: (value: T) => T) {
  const entry = cache.get(key);
  if (!entry) return;
  setCachedContent(key, updater(entry.value as T));
}

export function markContentCacheStale(predicate: (key: string) => boolean) {
  cache.forEach((entry, key) => {
    if (predicate(key)) entry.stale = true;
  });
}

export function markContentCachePrefixStale(prefix: string) {
  markContentCacheStale((key) => key.startsWith(prefix));
  const scope = activeScope;
  const invalidationKey = `${scope}\u0000${prefix}`;
  const previous = pendingInvalidations.get(invalidationKey) ?? Promise.resolve();
  const pending = previous
    .then(() => deletePersistentCacheByPrefix(scope, prefix))
    .finally(() => {
      if (pendingInvalidations.get(invalidationKey) === pending) pendingInvalidations.delete(invalidationKey);
    });
  pendingInvalidations.set(invalidationKey, pending);
}

export function clearContentReadMemoryCache() {
  cache.clear();
  pendingPersistentReads.clear();
  pendingRequests.clear();
}

export function clearContentReadCache() {
  const scope = activeScope;
  clearContentReadMemoryCache();
  void clearPersistentCacheScope(scope);
}

export function markContentRealtimeUnreliable() { realtimeReliable = false; }
export function markContentRealtimeReliable() { realtimeReliable = true; wasOffline = false; }
export function markContentWentOffline() { wasOffline = true; }

export function shouldRefreshContentAfterResume(updatedAt: number) {
  return wasOffline || !realtimeReliable || !isContentCacheFresh(updatedAt);
}
