import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  MOBILE_MAX_REPLAY_BATCH,
  MOBILE_MAX_RETRY_ATTEMPTS,
  setBaseUrl,
  type SyncReplayResponse,
} from '@workspace/api-client-react';
import {
  clearAllMobileOfflineData,
  clearMobileScope,
  containsSensitiveOfflineData,
  discardMobileOperation,
  enqueueMobileOperation,
  getMobileScope,
  listMobileOutbox,
  loadCachedQueries,
  replayMobileOutbox,
  retryMobileOperation,
  saveCachedQuery,
  setMobileScope,
  type MobileScope,
} from './lib/mobile-offline';

class MemoryLocalStorage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  keys() {
    return this.values.keys();
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalNavigator = globalThis.navigator;
const hadNavigator = 'navigator' in globalThis;
const storage = new MemoryLocalStorage();
const phoneScope: MobileScope = { employeeId: 7, storeId: 11 };
let replayResponse: SyncReplayResponse = { results: [] };
let replayRequests: Array<Record<string, unknown>> = [];

function setRuntime(runtime: 'phone' | 'web-fallback', online = true) {
  Reflect.set(globalThis, 'window', { localStorage: storage });
  if (runtime === 'phone') {
    Reflect.deleteProperty(globalThis, 'navigator');
  } else {
    Reflect.set(globalThis, 'navigator', { onLine: online });
  }
}

function queueableOperation(index = 0) {
  return {
    action: 'create_customer' as const,
    url: '/api/customers',
    body: { name: `Customer ${index}`, phone: `555-010${index % 10}` },
  };
}

async function seedQueue(count: number, scope = phoneScope) {
  setMobileScope(scope);
  for (let index = 0; index < count; index += 1) {
    await enqueueMobileOperation({ ...queueableOperation(index), scope });
  }
}

beforeEach(() => {
  storage.clear();
  replayResponse = { results: [] };
  replayRequests = [];
  setRuntime('phone');
  setBaseUrl('https://offline-test.invalid');
  globalThis.fetch = async (_input, init) => {
    replayRequests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(JSON.stringify(replayResponse), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  setMobileScope(null);
});

afterEach(() => {
  storage.clear();
  setMobileScope(null);
  setBaseUrl(null);
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) Reflect.deleteProperty(globalThis, 'window');
  else Reflect.set(globalThis, 'window', originalWindow);
  if (hadNavigator) Reflect.set(globalThis, 'navigator', originalNavigator);
  else Reflect.deleteProperty(globalThis, 'navigator');
});

describe('phone offline journey', () => {
  it('requires sign-in scope before saving work and keeps store data scoped', async () => {
    await assert.rejects(
      enqueueMobileOperation(queueableOperation()),
      /Sign in and choose a store/,
    );

    setMobileScope(phoneScope);
    await saveCachedQuery(phoneScope, ['/api/repairs'], [{ id: 1, ticketNumber: 'R-1' }]);
    const item = await enqueueMobileOperation(queueableOperation());

    assert.deepEqual(getMobileScope(), phoneScope);
    assert.equal(item.scope.storeId, phoneScope.storeId);
    assert.equal((await listMobileOutbox(phoneScope)).length, 1);

    const secondStore = { employeeId: 7, storeId: 12 };
    await saveCachedQuery(secondStore, ['/api/repairs'], [{ id: 2, ticketNumber: 'R-2' }]);
    await enqueueMobileOperation({ ...queueableOperation(2), scope: secondStore });
    await clearMobileScope(phoneScope);

    assert.deepEqual(await loadCachedQueries(phoneScope), []);
    assert.deepEqual(await listMobileOutbox(phoneScope), []);
    assert.equal((await loadCachedQueries(secondStore)).length, 1);
    assert.equal((await listMobileOutbox(secondStore)).length, 1);
  });

  it('restores only fresh snapshots and marks the cache boundary without leaking secrets', async () => {
    await saveCachedQuery(phoneScope, ['/api/customers'], {
      name: 'Visible customer',
      password: 'do-not-store',
      profile: { devicePassword: '1234', notes: 'private notes' },
      payment: { cardNumber: '4111111111111111', cvv: '123' },
    });

    const cacheKey = 'mobilinq.mobile.cache.v1:7:11';
    const saved = JSON.parse(storage.getItem(cacheKey) ?? '[]') as Array<Record<string, unknown>>;
    assert.equal(JSON.stringify(saved).includes('do-not-store'), false);
    assert.equal(JSON.stringify(saved).includes('1234'), false);
    assert.equal(JSON.stringify(saved).includes('private notes'), false);
    assert.equal(JSON.stringify(saved).includes('4111111111111111'), false);
    assert.equal(JSON.stringify(saved).includes('123'), false);
    assert.equal((await loadCachedQueries(phoneScope)).length, 1);

    storage.setItem(cacheKey, JSON.stringify([{ queryKey: ['/api/customers'], data: {}, cachedAt: '2020-01-01T00:00:00.000Z' }]));
    assert.deepEqual(await loadCachedQueries(phoneScope), []);
  });

  it('replays a bounded batch and leaves later work recoverable', async () => {
    await seedQueue(MOBILE_MAX_REPLAY_BATCH + 3);
    replayResponse = {
      results: (await listMobileOutbox(phoneScope)).slice(0, MOBILE_MAX_REPLAY_BATCH).map((item) => ({
        operationId: item.operationId,
        status: 'completed' as const,
      })),
    };

    const result = await replayMobileOutbox();
    const outbox = await listMobileOutbox(phoneScope);

    assert.deepEqual(result, { completed: MOBILE_MAX_REPLAY_BATCH, conflicts: 0, errors: 0 });
    assert.equal(replayRequests[0]?.operations instanceof Array, true);
    assert.equal((replayRequests[0]?.operations as unknown[]).length, MOBILE_MAX_REPLAY_BATCH);
    assert.equal(outbox.filter((item) => item.status === 'completed').length, MOBILE_MAX_REPLAY_BATCH);
    assert.equal(outbox.filter((item) => item.status === 'pending').length, 3);
  });

  it('stops retrying a failed operation after the shared attempt limit', async () => {
    await seedQueue(1);
    globalThis.fetch = async () => {
      throw new TypeError('network unavailable');
    };

    for (let attempt = 0; attempt < MOBILE_MAX_RETRY_ATTEMPTS; attempt += 1) {
      const result = await replayMobileOutbox();
      assert.deepEqual(result, { completed: 0, conflicts: 0, errors: 1 });
      await retryMobileOperation((await listMobileOutbox(phoneScope))[0].operationId);
    }

    const exhausted = await listMobileOutbox(phoneScope);
    assert.equal(exhausted[0].status, 'pending');
    assert.equal(exhausted[0].attempts, MOBILE_MAX_RETRY_ATTEMPTS);

    const skipped = await replayMobileOutbox();
    assert.deepEqual(skipped, { completed: 0, conflicts: 0, errors: 0 });
    assert.equal((await listMobileOutbox(phoneScope))[0].attempts, MOBILE_MAX_RETRY_ATTEMPTS);
  });

  it('keeps a conflict recoverable and supports retry or discard', async () => {
    await seedQueue(1);
    const original = (await listMobileOutbox(phoneScope))[0];
    const operationId = original.operationId;
    replayResponse = {
      results: [{
        operationId,
        status: 'conflict',
        message: 'Repair changed while this device was offline.',
      }],
    };

    assert.deepEqual(await replayMobileOutbox(), { completed: 0, conflicts: 1, errors: 0 });
    assert.equal((await listMobileOutbox(phoneScope))[0].status, 'conflict');
    assert.equal((await listMobileOutbox(phoneScope))[0].lastError, 'Repair changed while this device was offline.');
    const conflicted = (await listMobileOutbox(phoneScope))[0];
    assert.deepEqual(
      { operationId: conflicted.operationId, action: conflicted.action, url: conflicted.url, body: conflicted.body, scope: conflicted.scope },
      { operationId: original.operationId, action: original.action, url: original.url, body: original.body, scope: original.scope },
    );

    await retryMobileOperation(operationId);
    assert.equal((await listMobileOutbox(phoneScope))[0].status, 'pending');

    await discardMobileOperation(operationId);
    assert.deepEqual(await listMobileOutbox(phoneScope), []);
  });
});

describe('web fallback offline journey', () => {
  it('does not replay while offline, then syncs the same queue after reconnect', async () => {
    setRuntime('web-fallback', false);
    await seedQueue(1);
    const operationId = (await listMobileOutbox(phoneScope))[0].operationId;
    replayResponse = { results: [{ operationId, status: 'completed' }] };

    assert.deepEqual(await replayMobileOutbox(), { completed: 0, conflicts: 0, errors: 0 });
    assert.equal(replayRequests.length, 0);
    assert.equal((await listMobileOutbox(phoneScope))[0].status, 'pending');

    setRuntime('web-fallback', true);
    assert.deepEqual(await replayMobileOutbox(), { completed: 1, conflicts: 0, errors: 0 });
    assert.equal((await listMobileOutbox(phoneScope))[0].status, 'completed');
  });

  it('clears every employee/store cache and queued operation on sign-out', async () => {
    await seedQueue(1, { employeeId: 7, storeId: 11 });
    await saveCachedQuery({ employeeId: 8, storeId: 22 }, ['/api/sales'], [{ id: 4 }]);
    await enqueueMobileOperation({
      ...queueableOperation(8),
      scope: { employeeId: 8, storeId: 22 },
    });

    await clearAllMobileOfflineData();
    setMobileScope(null);

    assert.deepEqual(await listMobileOutbox({ employeeId: 7, storeId: 11 }), []);
    assert.deepEqual(await listMobileOutbox({ employeeId: 8, storeId: 22 }), []);
    assert.deepEqual(await loadCachedQueries({ employeeId: 7, storeId: 11 }), []);
    assert.deepEqual(await loadCachedQueries({ employeeId: 8, storeId: 22 }), []);
  });
});

describe('offline persistence privacy guard', () => {
  it('rejects device, password, and payment secrets before persistence', async () => {
    setMobileScope(phoneScope);
    const privateBodies = [
      { devicePassword: '1234' },
      { credentials: { password: 'secret' } },
      { payment: { cardNumber: '4111111111111111' } },
      { cardNumber: '4111111111111111', cvv: '123' },
      { authorization: 'Bearer private-token' },
    ];

    for (const body of privateBodies) {
      assert.equal(containsSensitiveOfflineData(body), true);
      await assert.rejects(
        enqueueMobileOperation({ ...queueableOperation(), body }),
        /private data and cannot be saved offline/,
      );
    }

    assert.deepEqual(await listMobileOutbox(phoneScope), []);
    assert.equal([...storage.keys()].some((key) => key.startsWith('mobilinq.mobile.outbox.v1:')), false);
  });
});