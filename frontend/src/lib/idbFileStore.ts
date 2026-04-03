type StoredFile = {
  blob: Blob;
  name: string;
  type: string;
  lastModified: number;
};

const DB_NAME = "halorai-create-design";
const DB_VERSION = 1;
const STORE = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      reject(tx.error);
      db.close();
    };
  });
}

export async function putFile(id: string, file: File): Promise<void> {
  const stored: StoredFile = {
    blob: file,
    name: file.name,
    type: file.type || "application/octet-stream",
    lastModified: file.lastModified || Date.now(),
  };
  await withStore("readwrite", (s) => s.put(stored as any, id));
}

export async function getFile(id: string): Promise<File | null> {
  const stored = (await withStore<StoredFile | undefined>("readonly", (s) => s.get(id))) as StoredFile | undefined;
  if (!stored?.blob) return null;
  return new File([stored.blob], stored.name || "file", { type: stored.type || stored.blob.type, lastModified: stored.lastModified || Date.now() });
}

export async function putBlob(id: string, blob: Blob, meta?: { name?: string; lastModified?: number }): Promise<void> {
  const stored: StoredFile = {
    blob,
    name: meta?.name || "blob",
    type: blob.type || "application/octet-stream",
    lastModified: meta?.lastModified || Date.now(),
  };
  await withStore("readwrite", (s) => s.put(stored as any, id));
}

export async function getBlob(id: string): Promise<Blob | null> {
  const stored = (await withStore<StoredFile | undefined>("readonly", (s) => s.get(id))) as StoredFile | undefined;
  return stored?.blob ?? null;
}

export async function del(id: string): Promise<void> {
  await withStore("readwrite", (s) => s.delete(id));
}

