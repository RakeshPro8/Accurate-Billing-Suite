import { listOutbox, setLastSyncAt, updateOutbox } from "./offline-store";

let syncing = false;
const syncListeners = new Set<() => void>();

export function subscribeSync(listener: () => void) {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

function notify() {
  syncListeners.forEach((listener) => listener());
}

export async function syncOutbox() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  let syncFailed = false;
  try {
    for (const operation of await listOutbox()) {
      if (operation.status === "completed") continue;
      await updateOutbox(operation.operationId, { status: "syncing" });
      notify();
      try {
        const response = await fetch(operation.url, {
          method: operation.method,
          credentials: "include",
          headers: { "Content-Type": "application/json", "Idempotency-Key": operation.operationId },
          body: operation.action
            ? JSON.stringify({ operations: [{ operationId: operation.operationId, action: operation.action, body: operation.body, expectedVersion: operation.expectedVersion }] })
            : operation.body === undefined ? undefined : JSON.stringify(operation.body),
        });
        if (response.status === 409) {
          syncFailed = true;
          await updateOutbox(operation.operationId, { status: "conflict", lastError: "The server changed this record while the device was offline." });
        } else if (!response.ok) {
          syncFailed = true;
          const error = await response.json().catch(() => ({}));
          await updateOutbox(operation.operationId, { status: "error", attempts: operation.attempts + 1, lastError: error.error ?? `HTTP ${response.status}` });
        } else {
          await updateOutbox(operation.operationId, { status: "completed", attempts: operation.attempts + 1, lastError: undefined });
        }
      } catch (error) {
        syncFailed = true;
        await updateOutbox(operation.operationId, { status: "error", attempts: operation.attempts + 1, lastError: error instanceof Error ? error.message : "Network unavailable." });
        break;
      }
      notify();
    }
    if (!syncFailed) setLastSyncAt();
  } finally {
    syncing = false;
    notify();
  }
}

export function isSyncing() {
  return syncing;
}