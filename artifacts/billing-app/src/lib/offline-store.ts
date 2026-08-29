const DB_NAME = "mobilinq-offline";
const DB_VERSION = 1;
const CACHE_STORE = "read-cache";
const OUTBOX_STORE = "outbox";
const SAFE_PATHS = ["/products", "/services", "/customers", "/sales", "/quotations", "/repairs", "/settings", "/stores"];

export type OutboxStatus = "pending" | "syncing" | "completed" | "conflict" | "error";

export interface OfflineScope {
  employeeId: number;
  storeId: number | null;
}

export interface OutboxOperation {
  operationId: string;
  action?: "create_sale" | "create_customer" | "create_repair" | "repair_status" | "repair_photo";
  expectedVersion?: string;
  scope: OfflineScope;
  method: string;
  url: string;
  body: unknown;
  createdAt: string;
  attempts: number;
  status: OutboxStatus;
  lastError?: string;
}

let scope: OfflineScope | null = null;
const listeners = new Set<() => void>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB is unavailable."));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE, { keyPath: "key" });
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) db.createObjectStore(OUTBOX_STORE, { keyPath: "operationId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open offline storage."));
  });
}

function isSafePath(url: string) {
  try {
    const path = new URL(url, window.location.origin).pathname.replace(/^.*\/api/, "");
    return SAFE_PATHS.some((safe) => path === safe || path.startsWith(`${safe}/`));
  } catch {
    return false;
  }
}

function scopedKey(url: string) {
  return `${scope?.employeeId ?? "anonymous"}:${scope?.storeId ?? "all"}:${url}`;
}

export function setOfflineScope(next: OfflineScope | null) {
  scope = next;
  listeners.forEach((listener) => listener());
}

export function getOfflineScope() {
  return scope;
}

export function subscribeOfflineScope(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function clearOfflineData() {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([CACHE_STORE, OUTBOX_STORE], "readwrite");
    tx.objectStore(CACHE_STORE).clear();
    tx.objectStore(OUTBOX_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function cacheRead(url: string, data: unknown) {
  if (!scope || !isSafePath(url) || typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, "readwrite");
      tx.objectStore(CACHE_STORE).put({ key: scopedKey(url), url, data, scope, cachedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Offline caching is best effort; the online response remains authoritative.
  }
}

export async function getCachedRead<T>(url: string): Promise<{ data: T; cachedAt: string } | null> {
  if (!scope || !isSafePath(url) || typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(CACHE_STORE, "readonly").objectStore(CACHE_STORE).get(scopedKey(url));
      request.onsuccess = () => resolve(request.result ? { data: request.result.data as T, cachedAt: request.result.cachedAt } : null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export async function queueOfflineOperation(operation: Omit<OutboxOperation, "scope" | "createdAt" | "attempts" | "status"> & { scope?: OfflineScope }) {
  if (!scope) throw new Error("A signed-in employee is required before queuing work.");
  const payloadSize = JSON.stringify(operation.body ?? null).length;
  if (payloadSize > 3_000_000) throw new Error("This offline item is too large. Reduce the attachment size and try again.");
  if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    if (estimate.usage && estimate.quota && estimate.usage + payloadSize > estimate.quota * 0.9) {
      throw new Error("Offline storage is nearly full. Sync or clear old offline data before trying again.");
    }
  }
  const value: OutboxOperation = { ...operation, scope, createdAt: new Date().toISOString(), attempts: 0, status: "pending" };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, "readwrite");
    tx.objectStore(OUTBOX_STORE).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return value;
}

export async function listOutbox(): Promise<OutboxOperation[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(OUTBOX_STORE, "readonly").objectStore(OUTBOX_STORE).getAll();
    request.onsuccess = () => resolve((request.result as OutboxOperation[]).filter((item) => item.scope.employeeId === scope?.employeeId));
    request.onerror = () => reject(request.error);
  });
}

export async function updateOutbox(operationId: string, patch: Partial<OutboxOperation>) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, "readwrite");
    const store = tx.objectStore(OUTBOX_STORE);
    const request = store.get(operationId);
    request.onsuccess = () => {
      if (request.result) store.put({ ...request.result, ...patch });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function isOfflineCapableUrl(url: string) {
  return isSafePath(url);
}