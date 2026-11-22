/**
 * The reader's gallery, on this device only (IndexedDB). Each work keeps its
 * media, verse reference, prompt, provider and model. Never a key.
 */
import type { Output } from "./result.tsx";

const DB = "injeel-studio-gallery";
const STORE = "works";
export type Work = Omit<Output, "src"> & { id: string; createdAt: number; blob?: Blob; url?: string };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Keeps the media itself when the browser can read it; otherwise the provider link. */
export async function saveWork(output: Output): Promise<boolean> {
  const { src, ...meta } = output;
  let blob: Blob | undefined;
  try {
    blob = await (await fetch(src)).blob();
  } catch {
    blob = undefined;
  }
  // A blob: or data: link dies with this page, so it is not worth keeping on its own.
  if (!blob && /^(blob|data):/.test(src)) return false;
  const work: Work = { ...meta, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, createdAt: Date.now(), ...(blob ? { blob } : { url: src }) };
  try {
    await run("readwrite", (store) => store.put(work));
    return true;
  } catch {
    return false;
  }
}

export async function listWorks(): Promise<Work[]> {
  try {
    const rows = await run("readonly", (store) => store.getAll() as IDBRequest<Work[]>);
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function deleteWork(id: string) {
  try {
    await run("readwrite", (store) => store.delete(id));
    return true;
  } catch {
    return false;
  }
}
