/** Minimal IndexedDB helper for TRIPO offline cache + mutation queue */

const DB_NAME = 'tripo-offline';
const DB_VERSION = 1;

export type StoreName = 'cache' | 'queue';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function cacheSet(key: string, data: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('cache', 'readwrite');
  tx.objectStore('cache').put({ key, data, updatedAt: Date.now() });
  await txDone(tx);
  db.close();
}

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  const db = await openDb();
  const tx = db.transaction('cache', 'readonly');
  const req = tx.objectStore('cache').get(key);
  const row = await new Promise<any>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return row ? (row.data as T) : null;
}

export interface QueuedMutation {
  id?: number;
  method: string;
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
  createdAt: number;
  label: string;
}

export async function queueAdd(item: Omit<QueuedMutation, 'id' | 'createdAt'> & { createdAt?: number }): Promise<number> {
  const db = await openDb();
  const tx = db.transaction('queue', 'readwrite');
  const req = tx.objectStore('queue').add({
    ...item,
    createdAt: item.createdAt || Date.now(),
  });
  const id = await new Promise<number>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return id;
}

export async function queueList(): Promise<QueuedMutation[]> {
  const db = await openDb();
  const tx = db.transaction('queue', 'readonly');
  const req = tx.objectStore('queue').getAll();
  const rows = await new Promise<QueuedMutation[]>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function queueRemove(id: number): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('queue', 'readwrite');
  tx.objectStore('queue').delete(id);
  await txDone(tx);
  db.close();
}

export async function queueClear(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('queue', 'readwrite');
  tx.objectStore('queue').clear();
  await txDone(tx);
  db.close();
}
