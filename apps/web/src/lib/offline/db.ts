import type {
  CachedInventory,
  CachedProduct,
  CachedVariant,
  CatalogueCacheMeta,
  QueuedSale,
} from "./types";

const DB_NAME = "mms-pos-offline";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "id" });
      if (!db.objectStoreNames.contains("products")) db.createObjectStore("products", { keyPath: "id" });
      if (!db.objectStoreNames.contains("variants")) db.createObjectStore("variants", { keyPath: "id" });
      if (!db.objectStoreNames.contains("inventory")) {
        db.createObjectStore("inventory", { keyPath: "variantId" });
      }
      if (!db.objectStoreNames.contains("queue")) {
        const store = db.createObjectStore("queue", { keyPath: "id" });
        store.createIndex("byStatus", "status", { unique: false });
        store.createIndex("byOfflineId", "offlineId", { unique: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function txDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB tx failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB tx aborted"));
  });
}

export async function putCatalogue(input: {
  meta: CatalogueCacheMeta;
  products: CachedProduct[];
  variants: CachedVariant[];
  inventory: CachedInventory[];
  replace: boolean;
}) {
  const db = await openDb();
  const tx = db.transaction(["meta", "products", "variants", "inventory"], "readwrite");
  if (input.replace) {
    tx.objectStore("products").clear();
    tx.objectStore("variants").clear();
    tx.objectStore("inventory").clear();
  }
  tx.objectStore("meta").put(input.meta);
  for (const p of input.products) tx.objectStore("products").put(p);
  for (const v of input.variants) tx.objectStore("variants").put(v);
  for (const i of input.inventory) tx.objectStore("inventory").put(i);
  await txDone(tx);
  db.close();
}

export async function getCatalogueMeta(): Promise<CatalogueCacheMeta | null> {
  const db = await openDb();
  const tx = db.transaction("meta", "readonly");
  const req = tx.objectStore("meta").get("catalogue");
  const row = await new Promise<CatalogueCacheMeta | undefined>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as CatalogueCacheMeta | undefined);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return row ?? null;
}

export async function listCachedProducts(): Promise<CachedProduct[]> {
  const db = await openDb();
  const tx = db.transaction("products", "readonly");
  const req = tx.objectStore("products").getAll();
  const rows = await new Promise<CachedProduct[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as CachedProduct[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return rows;
}

export async function listCachedVariants(): Promise<CachedVariant[]> {
  const db = await openDb();
  const tx = db.transaction("variants", "readonly");
  const req = tx.objectStore("variants").getAll();
  const rows = await new Promise<CachedVariant[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as CachedVariant[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return rows;
}

export async function enqueueSale(sale: QueuedSale) {
  const db = await openDb();
  const tx = db.transaction("queue", "readwrite");
  tx.objectStore("queue").put(sale);
  await txDone(tx);
  db.close();
}

export async function updateQueuedSale(sale: QueuedSale) {
  await enqueueSale(sale);
}

export async function listQueuedSales(): Promise<QueuedSale[]> {
  const db = await openDb();
  const tx = db.transaction("queue", "readonly");
  const req = tx.objectStore("queue").getAll();
  const rows = await new Promise<QueuedSale[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as QueuedSale[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getQueuedSale(id: string): Promise<QueuedSale | null> {
  const db = await openDb();
  const tx = db.transaction("queue", "readonly");
  const req = tx.objectStore("queue").get(id);
  const row = await new Promise<QueuedSale | undefined>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as QueuedSale | undefined);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return row ?? null;
}

export async function deleteQueuedSale(id: string) {
  const db = await openDb();
  const tx = db.transaction("queue", "readwrite");
  tx.objectStore("queue").delete(id);
  await txDone(tx);
  db.close();
}

export async function countPendingQueue() {
  const rows = await listQueuedSales();
  return rows.filter((r) => r.status === "pending" || r.status === "failed" || r.status === "syncing")
    .length;
}
