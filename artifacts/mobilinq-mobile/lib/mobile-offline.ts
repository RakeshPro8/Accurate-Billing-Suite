import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  replayOfflineOperations,
  MOBILE_MAX_REPLAY_BATCH,
  MOBILE_MAX_RETRY_ATTEMPTS,
  type SyncOperation,
  type SyncOperationAction,
  type SyncReplayResponse,
} from '@workspace/api-client-react';

export type MobileScope = { employeeId: number; storeId: number | null };
export type MobileOutboxStatus = 'pending' | 'syncing' | 'completed' | 'conflict' | 'error';

export type MobileOutboxItem = {
  operationId: string;
  action: SyncOperationAction;
  url: string;
  body: Record<string, unknown>;
  expectedVersion?: string;
  scope: MobileScope;
  createdAt: string;
  attempts: number;
  status: MobileOutboxStatus;
  lastError?: string;
};

export type CachedMobileQuery = {
  queryKey: readonly unknown[];
  data: unknown;
  cachedAt: string;
};

const OUTBOX_PREFIX = 'mobilinq.mobile.outbox.v1:';
const CACHE_PREFIX = 'mobilinq.mobile.cache.v1:';
const CACHE_TTL = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = MOBILE_MAX_RETRY_ATTEMPTS;
const sensitiveKeys = new Set([
  'devicepassword',
  'pin',
  'password',
  'smtpPass'.toLowerCase(),
  'token',
  'authorization',
  'payment',
  'payments',
  'reference',
  'notes',
]);

const listeners = new Set<() => void>();
let activeScope: MobileScope | null = null;

function scopeId(scope: MobileScope) {
  return `${scope.employeeId}:${scope.storeId ?? 'all'}`;
}

function outboxKey(scope: MobileScope) {
  return `${OUTBOX_PREFIX}${scopeId(scope)}`;
}

function cacheKey(scope: MobileScope) {
  return `${CACHE_PREFIX}${scopeId(scope)}`;
}

function notify() {
  listeners.forEach((listener) => listener());
}

function scrub(value: unknown, parentKey = ''): unknown {
  if (Array.isArray(value)) return value.map((entry) => scrub(entry));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !sensitiveKeys.has(key.toLowerCase()) && !sensitiveKeys.has(parentKey.toLowerCase()))
      .map(([key, nested]) => [key, scrub(nested, key)]),
  );
}

export function containsSensitiveOfflineData(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSensitiveOfflineData);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([key, nested]) => sensitiveKeys.has(key.toLowerCase()) || containsSensitiveOfflineData(nested),
  );
}

export function setMobileScope(scope: MobileScope | null) {
  activeScope = scope;
  notify();
}

export function getMobileScope() {
  return activeScope;
}

export function subscribeMobileOffline(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function saveCachedQuery(scope: MobileScope, queryKey: readonly unknown[], data: unknown) {
  const existing = await loadCachedQueries(scope);
  const next = existing.filter((item) => JSON.stringify(item.queryKey) !== JSON.stringify(queryKey));
  next.push({ queryKey, data: scrub(data), cachedAt: new Date().toISOString() });
  await AsyncStorage.setItem(cacheKey(scope), JSON.stringify(next.slice(-60)));
  notify();
}

export async function loadCachedQueries(scope: MobileScope): Promise<CachedMobileQuery[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(scope));
    if (!raw) return [];
    const entries = JSON.parse(raw) as CachedMobileQuery[];
    return entries.filter((entry) => Date.now() - new Date(entry.cachedAt).getTime() <= CACHE_TTL);
  } catch {
    return [];
  }
}

export async function clearMobileScope(scope?: MobileScope | null) {
  const target = scope ?? activeScope;
  if (!target) return;
  await Promise.all([AsyncStorage.removeItem(outboxKey(target)), AsyncStorage.removeItem(cacheKey(target))]);
  notify();
}

export async function clearAllMobileOfflineData() {
  const keys = await AsyncStorage.getAllKeys();
  const owned = keys.filter((key) => key.startsWith(OUTBOX_PREFIX) || key.startsWith(CACHE_PREFIX));
  if (owned.length) await AsyncStorage.multiRemove(owned);
  notify();
}

export async function listMobileOutbox(scope = activeScope): Promise<MobileOutboxItem[]> {
  if (!scope) return [];
  try {
    const raw = await AsyncStorage.getItem(outboxKey(scope));
    return raw ? (JSON.parse(raw) as MobileOutboxItem[]) : [];
  } catch {
    return [];
  }
}

async function saveOutbox(scope: MobileScope, items: MobileOutboxItem[]) {
  await AsyncStorage.setItem(outboxKey(scope), JSON.stringify(items));
  notify();
}

function createOperationId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueueMobileOperation(input: {
  action: SyncOperationAction;
  url: string;
  body: Record<string, unknown>;
  expectedVersion?: string;
  scope?: MobileScope;
}) {
  const scope = input.scope ?? activeScope;
  if (!scope) throw new Error('Sign in and choose a store before saving offline work.');
  if (containsSensitiveOfflineData(input.body)) {
    throw new Error('This action includes private data and cannot be saved offline.');
  }
  const current = await listMobileOutbox(scope);
  const item: MobileOutboxItem = {
    operationId: createOperationId(),
    action: input.action,
    url: input.url,
    body: scrub(input.body) as Record<string, unknown>,
    expectedVersion: input.expectedVersion,
    scope,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: 'pending',
  };
  await saveOutbox(scope, [...current, item]);
  return item;
}

export async function updateMobileOutbox(operationId: string, patch: Partial<MobileOutboxItem>) {
  if (!activeScope) return;
  const current = await listMobileOutbox(activeScope);
  await saveOutbox(activeScope, current.map((item) => item.operationId === operationId ? { ...item, ...patch } : item));
}

export async function retryMobileOperation(operationId: string) {
  await updateMobileOutbox(operationId, { status: 'pending', lastError: undefined });
}

export async function discardMobileOperation(operationId: string) {
  if (!activeScope) return;
  const current = await listMobileOutbox(activeScope);
  await saveOutbox(activeScope, current.filter((item) => item.operationId !== operationId));
}

function isNetworkError(error: unknown) {
  return error instanceof TypeError || (error instanceof Error && /network|offline|fetch/i.test(error.message));
}

export async function replayMobileOutbox(): Promise<{ completed: number; conflicts: number; errors: number }> {
  if (!activeScope || typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { completed: 0, conflicts: 0, errors: 0 };
  }
  const pending = (await listMobileOutbox(activeScope))
    .filter((item) => item.status === 'pending' || item.status === 'error')
    .filter((item) => item.attempts < MAX_ATTEMPTS)
    .slice(0, MOBILE_MAX_REPLAY_BATCH);
  if (!pending.length) return { completed: 0, conflicts: 0, errors: 0 };

  await Promise.all(pending.map((item) => updateMobileOutbox(item.operationId, { status: 'syncing' })));
  try {
    const response: SyncReplayResponse = await replayOfflineOperations({
      operations: pending.map(({ operationId, action, url, body, expectedVersion }): SyncOperation => ({
        operationId, action, url, body, expectedVersion,
      })),
    });
    for (const result of response.results ?? []) {
      const item = pending.find((entry) => entry.operationId === result.operationId);
      if (!item) continue;
      const status = result.status === 'completed' ? 'completed' : result.status === 'conflict' ? 'conflict' : 'error';
      await updateMobileOutbox(item.operationId, {
        status,
        attempts: item.attempts + 1,
        lastError: result.message,
      });
    }
    const completed = response.results?.filter((result) => result.status === 'completed').length ?? 0;
    const conflicts = response.results?.filter((result) => result.status === 'conflict').length ?? 0;
    const errors = (response.results?.length ?? 0) - completed - conflicts;
    return { completed, conflicts, errors };
  } catch (error) {
    for (const item of pending) {
      await updateMobileOutbox(item.operationId, {
        status: 'error',
        attempts: item.attempts + 1,
        lastError: isNetworkError(error) ? 'Still offline. Work will retry when the connection returns.' : 'Sync could not be completed.',
      });
    }
    return { completed: 0, conflicts: 0, errors: pending.length };
  }
}

export function isOfflineFailure(error: unknown) {
  if (error instanceof TypeError) return true;
  if (error instanceof Error && /network|offline|fetch|timeout/i.test(error.message)) return true;
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = Number((error as { status?: unknown }).status);
    return status === 0 || !Number.isFinite(status);
  }
  return false;
}
