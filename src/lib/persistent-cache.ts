const DATABASE_NAME = 'novae-content-cache';
const DATABASE_VERSION = 1;
const STORE_NAME = 'entries';

export interface PersistentCacheEntry<T> {
  cacheKey: string;
  key: string;
  scope: string;
  updatedAt: number;
  value: T;
  writeVersion?: number;
}

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('scope', 'scope', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  }).catch((error) => {
    databasePromise = null;
    throw error;
  });
  return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export async function readPersistentCache<T>(key: string) {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, 'readonly');
    return await requestResult(transaction.objectStore(STORE_NAME).get(key)) as PersistentCacheEntry<T> | undefined;
  } catch {
    return undefined;
  }
}

export async function writePersistentCache<T>(entry: PersistentCacheEntry<T>) {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(entry);
    await transactionDone(transaction);
  } catch {
    // Persistent caching is opportunistic; memory caching remains available.
  }
}

export async function deletePersistentCacheIfVersion(key: string, writeVersion: number) {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const entry = await requestResult(store.get(key)) as PersistentCacheEntry<unknown> | undefined;
    if (entry?.writeVersion === writeVersion) store.delete(key);
    await transactionDone(transaction);
  } catch {
    // Ignore unavailable or blocked storage.
  }
}

export async function deletePersistentCacheByPrefix(scope: string, prefix: string) {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const request = transaction.objectStore(STORE_NAME).index('scope').openCursor(IDBKeyRange.only(scope));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const entry = cursor.value as PersistentCacheEntry<unknown>;
      if (entry.cacheKey.startsWith(prefix)) cursor.delete();
      cursor.continue();
    };
    await transactionDone(transaction);
  } catch {
    // Ignore unavailable or blocked storage.
  }
}

export async function clearPersistentCacheScope(scope: string) {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const request = transaction.objectStore(STORE_NAME).index('scope').openKeyCursor(IDBKeyRange.only(scope));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      transaction.objectStore(STORE_NAME).delete(cursor.primaryKey);
      cursor.continue();
    };
    await transactionDone(transaction);
  } catch {
    // Ignore unavailable or blocked storage.
  }
}
