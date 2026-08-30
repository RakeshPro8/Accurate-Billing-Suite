import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useGetAuthSession, useGetCurrentStore, useGetSettings, useGetStores, useLogoutEmployee, useSetCurrentStore } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfflineBanner } from '@/components/OfflineBanner';
import { OutboxPanel } from '@/components/OutboxPanel';
import { clearMobileSession } from '@/context/MobileOfflineContext';
import { clearMobileScope, getMobileScope, setMobileScope } from '@/lib/mobile-offline';

export default function SettingsScreen() {
  const colors = useColors(); const insets = useSafeAreaInsets(); const queryClient = useQueryClient(); const session = useGetAuthSession(); const settings = useGetSettings(); const stores = useGetStores(); const current = useGetCurrentStore(); const select = useSetCurrentStore(); const logout = useLogoutEmployee(); const [message, setMessage] = useState('');
  const chooseStore = (storeId: number, name: string) => {
    select.mutate({ data: { storeId } }, { onSuccess: async () => {
      const previous = getMobileScope();
      if (previous && previous.storeId !== storeId) await clearMobileScope(previous);
      if (session.data?.authenticated) setMobileScope({ employeeId: session.data.employee.id, storeId });
      queryClient.clear();
      setMessage(`${name} selected. Local data was refreshed for this store.`);
      await current.refetch();
    }, onError: () => setMessage('Store could not be selected. Try again when connected.') });
  };
  const signOut = () => logout.mutate(undefined, { onSuccess: async () => { await clearMobileSession(); queryClient.clear(); setMessage('Signed out. Local operational data was cleared.'); } });
  return <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 110, backgroundColor: colors.background }]}><Text style={[styles.kicker, { color: colors.primary }]}>CONTROL CENTER</Text><Text style={[styles.title, { color: colors.foreground }]}>Settings</Text><OfflineBanner /><OutboxPanel /><View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.row}><Feather name="map-pin" size={18} color={colors.primary} /><View style={styles.rowCopy}><Text style={[styles.cardTitle, { color: colors.foreground }]}>Current store</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>Store context controls your lists and permissions.</Text></View></View>{(stores.data ?? []).map((store) => <Pressable key={store.id} testID={`store-${store.id}`} accessibilityRole="button" onPress={() => chooseStore(store.id, store.name)} style={[styles.store, { borderColor: current.data?.storeId === store.id ? colors.primary : colors.border }]}><Text style={[styles.storeName, { color: colors.foreground }]}>{store.name}</Text>{current.data?.storeId === store.id && <Feather name="check" size={17} color={colors.primary} />}</Pressable>)}</View><View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{settings.data?.businessName ?? 'Mobilinq'}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{settings.data?.taxEnabled ? `${settings.data.taxName} configured at ${settings.data.taxRate}%` : 'Tax disabled for new transactions'}</Text><Text style={[styles.meta, { color: colors.mutedForeground, marginTop: 8 }]}>Sessions use OS-backed storage where available. PINs, device unlock codes, and payment data are never persisted.</Text></View>{!!message && <Text style={[styles.message, { color: colors.primary }]}>{message}</Text>}<Pressable testID="sign-out" accessibilityRole="button" onPress={signOut} style={[styles.logout, { borderColor: colors.destructive }]}><Feather name="log-out" size={16} color={colors.destructive} /><Text style={[styles.logoutText, { color: colors.destructive }]}>SIGN OUT</Text></Pressable></ScrollView>;
}
const styles = StyleSheet.create({ content: { flexGrow: 1, paddingHorizontal: 20 }, kicker: { fontSize: 11, letterSpacing: 1.8, fontWeight: '700' }, title: { fontSize: 26, fontWeight: '700', marginTop: 6, marginBottom: 20 }, card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 14 }, row: { flexDirection: 'row', alignItems: 'center', gap: 11 }, rowCopy: { flex: 1 }, cardTitle: { fontSize: 16, fontWeight: '700' }, meta: { fontSize: 12, marginTop: 4, lineHeight: 17 }, store: { marginTop: 12, padding: 12, borderWidth: 1, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, storeName: { fontSize: 14, fontWeight: '600' }, message: { fontSize: 13, marginBottom: 14 }, logout: { height: 44, borderWidth: 1, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, logoutText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 }, });