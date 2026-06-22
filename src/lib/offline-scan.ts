"use client";

/**
 * Couche de persistance IndexedDB pour le scanner hors-ligne.
 * DB: "offline-scan" — 2 object stores :
 *   manifest : { token, holder, checkedInAt }  (keyPath: "token")
 *   queue    : { token, scannedAt, synced }    (keyPath: "token")
 */

const DB_NAME = "offline-scan";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("manifest")) {
        db.createObjectStore("manifest", { keyPath: "token" });
      }
      if (!db.objectStoreNames.contains("queue")) {
        db.createObjectStore("queue", { keyPath: "token" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db: IDBDatabase, store: string, mode: IDBTransactionMode) {
  return db.transaction(store, mode).objectStore(store);
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export interface ManifestEntry { token: string; holder: string; checkedInAt: string | null }
export interface QueueEntry { token: string; scannedAt: string; synced: boolean }

export async function loadManifest(entries: ManifestEntry[]): Promise<void> {
  const db = await openDb();
  const store = tx(db, "manifest", "readwrite");
  await wrap(store.clear());
  for (const e of entries) {
    store.put(e);
  }
}

export async function getManifestEntry(token: string): Promise<ManifestEntry | undefined> {
  const db = await openDb();
  return wrap<ManifestEntry | undefined>(tx(db, "manifest", "readonly").get(token));
}

export async function markCheckedInLocally(token: string, scannedAt: string): Promise<void> {
  const db = await openDb();
  const store = tx(db, "manifest", "readwrite");
  const entry = await wrap<ManifestEntry | undefined>(store.get(token));
  if (entry) {
    store.put({ ...entry, checkedInAt: scannedAt });
  }
}

export async function manifestCount(): Promise<number> {
  const db = await openDb();
  return wrap<number>(tx(db, "manifest", "readonly").count());
}

export type LocalCheckInResult = "ok" | "already_local" | "invalid";

export async function localCheckIn(token: string, scannedAt: string): Promise<LocalCheckInResult> {
  const db = await openDb();
  const entry = await wrap<ManifestEntry | undefined>(tx(db, "manifest", "readonly").get(token));
  if (!entry) return "invalid";
  if (entry.checkedInAt) return "already_local";
  // Marque localement
  await markCheckedInLocally(token, scannedAt);
  return "ok";
}

export async function enqueue(token: string, scannedAt: string): Promise<void> {
  const db = await openDb();
  tx(db, "queue", "readwrite").put({ token, scannedAt, synced: false });
}

export async function getPendingQueue(): Promise<QueueEntry[]> {
  const db = await openDb();
  const store = tx(db, "queue", "readonly");
  return new Promise((resolve, reject) => {
    const result: QueueEntry[] = [];
    const cur = store.openCursor();
    cur.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        if (!cursor.value.synced) result.push(cursor.value as QueueEntry);
        cursor.continue();
      } else {
        resolve(result);
      }
    };
    cur.onerror = () => reject(cur.error);
  });
}

export async function markSynced(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  const db = await openDb();
  const store = tx(db, "queue", "readwrite");
  for (const token of tokens) {
    const entry = await wrap<QueueEntry | undefined>(store.get(token));
    if (entry) store.put({ ...entry, synced: true });
  }
}

export async function pendingCount(): Promise<number> {
  const queue = await getPendingQueue();
  return queue.length;
}
