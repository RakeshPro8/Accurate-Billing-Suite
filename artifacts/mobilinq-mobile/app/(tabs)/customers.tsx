import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  getGetCustomersQueryKey,
  useCreateCustomer,
  useGetAuthSession,
  useGetCustomers,
} from '@workspace/api-client-react';
import type { CustomerInput } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { OfflineBanner } from '@/components/OfflineBanner';
import { OutboxPanel } from '@/components/OutboxPanel';
import { ErrorState, ScreenHeader, ScreenSkeleton, SignedOutState, getTopInset } from '@/components/BusinessUI';
import { useColors } from '@/hooks/useColors';
import { enqueueMobileOperation, isOfflineFailure } from '@/lib/mobile-offline';

export default function CustomersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topInset = getTopInset(insets.top);
  const session = useGetAuthSession();
  const [search, setSearch] = useState('');
  const customers = useGetCustomers(search.trim() ? { search: search.trim() } : undefined, {
    query: { queryKey: getGetCustomersQueryKey(search.trim() ? { search: search.trim() } : undefined), enabled: !!session.data?.authenticated },
  });
  const create = useCreateCustomer();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CustomerInput>({ name: '', phone: '', email: '' });
  const [message, setMessage] = useState('');
  const list = useMemo(() => customers.data ?? [], [customers.data]);

  if (session.isLoading || customers.isLoading) return <ScreenSkeleton colors={colors} topInset={topInset} />;
  if (!session.data?.authenticated) return <SignedOutState colors={colors} topInset={topInset} />;
  if (customers.isError) return <ErrorState title="Customers unavailable" message="The customer list could not be loaded." onRetry={() => void customers.refetch()} colors={colors} topInset={topInset} />;

  const submit = () => {
    if (!form.name?.trim()) { setMessage('A customer name is required.'); return; }
    setMessage('');
    create.mutate({ data: { ...form, name: form.name.trim(), phone: form.phone?.trim() || undefined, email: form.email?.trim() || undefined } }, {
      onSuccess: () => { setForm({ name: '', phone: '', email: '' }); setShowForm(false); setMessage('Customer saved.'); void customers.refetch(); },
      onError: async (error) => {
        if (!isOfflineFailure(error)) { setMessage('Customer could not be saved. Check the fields and try again.'); return; }
        try {
          await enqueueMobileOperation({ action: 'create_customer', url: '/api/customers', body: { ...form, name: form.name.trim() } });
          setForm({ name: '', phone: '', email: '' }); setShowForm(false); setMessage('Saved to the offline queue. It will sync when connected.');
        } catch (queueError) { setMessage(queueError instanceof Error ? queueError.message : 'This customer could not be queued.'); }
      },
    });
  };

  return (
    <KeyboardAwareScrollViewCompat
      contentContainerStyle={[styles.content, { backgroundColor: colors.background, paddingTop: topInset + 20, paddingBottom: insets.bottom + 110 }]}
      bottomOffset={70}
      refreshControl={<RefreshControl refreshing={customers.isRefetching} onRefresh={() => void customers.refetch()} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      <ScreenHeader eyebrow="MOBILINQ / CUSTOMERS" title="People, not paperwork." subtitle="Find a customer fast and keep the next action moving." icon="users" colors={colors} />
      <OfflineBanner />
      <OutboxPanel />
      <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput testID="customer-search" value={search} onChangeText={setSearch} placeholder="Search name, phone, or email" placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} returnKeyType="search" />
      </View>
      <Pressable testID="new-customer" accessibilityRole="button" onPress={() => setShowForm((value) => !value)} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
        <Feather name={showForm ? 'x' : 'user-plus'} size={16} color={colors.primaryForeground} />
        <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>{showForm ? 'CLOSE' : 'NEW CUSTOMER'}</Text>
      </Pressable>
      {showForm ? <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Field label="NAME" value={form.name ?? ''} onChangeText={(name) => setForm((current) => ({ ...current, name }))} colors={colors} />
        <Field label="PHONE" value={form.phone ?? ''} onChangeText={(phone) => setForm((current) => ({ ...current, phone }))} colors={colors} keyboardType="phone-pad" />
        <Field label="EMAIL" value={form.email ?? ''} onChangeText={(email) => setForm((current) => ({ ...current, email }))} colors={colors} keyboardType="email-address" />
        <Pressable testID="save-customer" accessibilityRole="button" disabled={create.isPending} onPress={submit} style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: create.isPending ? 0.6 : 1 }]}><Text style={[styles.primaryText, { color: colors.primaryForeground }]}>{create.isPending ? 'SAVING…' : 'SAVE CUSTOMER'}</Text></Pressable>
      </View> : null}
      {!!message && <Text style={[styles.message, { color: colors.primary }]}>{message}</Text>}
      <Text style={[styles.caption, { color: colors.mutedForeground }]}>{list.length} result{list.length === 1 ? '' : 's'} · private finance details stay out of offline snapshots</Text>
      {list.map((customer) => <View key={customer.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}><Feather name="user" size={16} color={colors.primary} /></View>
        <View style={styles.cardCopy}><Text style={[styles.name, { color: colors.foreground }]}>{customer.name}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{customer.phone || customer.email || 'No contact details'}</Text></View>
        {customer.isLoyaltyMember ? <Text style={[styles.loyalty, { color: colors.primary }]}>LOYAL</Text> : null}
      </View>)}
      {!list.length ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>No matching customers. Create one above.</Text> : null}
    </KeyboardAwareScrollViewCompat>
  );
}

function Field({ label, value, onChangeText, colors, keyboardType = 'default' }: { label: string; value: string; onChangeText: (value: string) => void; colors: ReturnType<typeof useColors>; keyboardType?: 'default' | 'phone-pad' | 'email-address' }) {
  return <View style={styles.field}><Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'} style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} /></View>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 18 },
  search: { minHeight: 46, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 10 },
  primaryButton: { minHeight: 44, borderRadius: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 },
  primaryText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9 },
  form: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  field: { marginBottom: 11 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, fontSize: 14 },
  message: { fontSize: 12, marginBottom: 10, lineHeight: 17 },
  caption: { fontSize: 11, marginBottom: 9 },
  card: { minHeight: 70, borderWidth: 1, borderRadius: 13, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
  avatar: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 3 },
  loyalty: { fontSize: 9, fontWeight: '700', letterSpacing: 0.7 },
  empty: { textAlign: 'center', fontSize: 13, paddingVertical: 28 },
});