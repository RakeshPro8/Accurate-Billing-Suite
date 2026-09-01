import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { getAuthSession, getCurrentStore, getSessionCookie, setSessionCookie } from '@workspace/api-client-react';
import * as SecureStore from 'expo-secure-store';
import {
  clearAllMobileOfflineData,
  getMobileScope,
  listMobileOutbox,
  loadCachedQueries,
  replayMobileOutbox,
  setMobileScope,
  subscribeMobileOffline,
  type MobileOutboxItem,
  type MobileScope,
} from '@/lib/mobile-offline';

type MobileOfflineContextValue = {
  isOnline: boolean;
  isStale: boolean;
  outbox: MobileOutboxItem[];
  sync: () => Promise<void>;
  refreshOutbox: () => Promise<void>;
};

const COOKIE_KEY = 'mobilinq.session.cookie.v1';
const OfflineContext = createContext<MobileOfflineContextValue>({
  isOnline: true,
  isStale: false,
  outbox: [],
  sync: async () => {},
  refreshOutbox: async () => {},
});

export async function restoreSessionCookie() {
  try {
    const cookie = await SecureStore.getItemAsync(COOKIE_KEY);
    if (cookie) setSessionCookie(cookie);
  } catch {
    // SecureStore may be unavailable in a web fallback; the live session still works.
  }
}

export async function persistSessionCookie() {
  const cookie = getSessionCookie();
  if (!cookie) return;
  try {
    await SecureStore.setItemAsync(COOKIE_KEY, cookie, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  } catch {
    // A session is still held in memory if secure storage is unavailable.
  }
}

export async function clearPersistedSession() {
  try {
    await SecureStore.deleteItemAsync(COOKIE_KEY);
  } catch {
    // Best effort cleanup.
  }
}

export function MobileOfflineProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(true);
  const [outbox, setOutbox] = useState<MobileOutboxItem[]>([]);
  const [isStale, setIsStale] = useState(false);

  const refreshOutbox = async () => setOutbox(await listMobileOutbox(getMobileScope()));

  useEffect(() => {
    void restoreSessionCookie().then(() => queryClient.invalidateQueries());
    const unsubscribe = subscribeMobileOffline(() => void refreshOutbox());
    const onState = () => {
      if (Platform.OS === 'web') setIsOnline(globalThis.navigator?.onLine !== false);
      void refreshOutbox();
    };
    const stateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') onState();
    });
    if (Platform.OS === 'web') {
      window.addEventListener('online', onState);
      window.addEventListener('offline', onState);
    }
    void refreshOutbox();
    return () => {
      unsubscribe();
      stateSubscription.remove();
      if (Platform.OS === 'web') {
        window.removeEventListener('online', onState);
        window.removeEventListener('offline', onState);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      try {
        const session = await getAuthSession();
        if (!session.authenticated || cancelled) return;
        const current = await getCurrentStore();
        const scope: MobileScope = { employeeId: session.employee.id, storeId: current.storeId };
        setMobileScope(scope);
        const cached = await loadCachedQueries(scope);
        if (cached.length) {
          cached.forEach((entry) => queryClient.setQueryData(entry.queryKey, entry.data));
          setIsStale(true);
        }
        await refreshOutbox();
        void replayMobileOutbox().then(() => refreshOutbox());
      } catch {
        // The auth screen handles a missing/expired live session.
      }
    }
    void hydrate();
    return () => { cancelled = true; };
  }, [queryClient]);

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.query.state.status !== 'success') return;
      const scope = getMobileScope();
      const key = event.query.queryKey;
      const keyText = JSON.stringify(key);
      const safe = ['/api/customers', '/api/repairs', '/api/products', '/api/services', '/api/sales', '/api/stores', '/api/reports', '/api/settings', '/api/customer-rights']
        .some((prefix) => keyText.includes(prefix));
      if (scope && safe && !keyText.includes('/auth/')) {
        void import('@/lib/mobile-offline').then(({ saveCachedQuery }) => saveCachedQuery(scope, key, event.query.state.data));
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const value = useMemo(() => ({
    isOnline,
    isStale,
    outbox,
    sync: async () => { await replayMobileOutbox(); await refreshOutbox(); setIsStale(false); },
    refreshOutbox,
  }), [isOnline, isStale, outbox]);

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useMobileOffline() {
  return useContext(OfflineContext);
}

export async function clearMobileSession() {
  await clearPersistedSession();
  await clearAllMobileOfflineData();
  setMobileScope(null);
}
