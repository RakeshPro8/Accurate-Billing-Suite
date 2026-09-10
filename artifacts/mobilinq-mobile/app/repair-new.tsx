import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useCreateRepair, useGetCustomers, useGetAuthSession, getGetCustomersQueryKey } from '@workspace/api-client-react';
import type { RepairInput } from '@workspace/api-client-react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { PhotoCapture } from '@/components/PhotoCapture';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ScreenHeader, SignedOutState, getTopInset } from '@/components/BusinessUI';
import { LocalizedText as Text } from '@/components/BusinessUI';
import { useColors } from '@/hooks/useColors';
import { enqueueMobileOperation, isOfflineFailure } from '@/lib/mobile-offline';

export default function NewRepairScreen() {
  const colors = useColors(); const insets = useSafeAreaInsets(); const topInset = getTopInset(insets.top);
  const session = useGetAuthSession(); const customers = useGetCustomers(undefined, { query: { queryKey: getGetCustomersQueryKey(), enabled: !!session.data?.authenticated } }); const create = useCreateRepair();
  const [form, setForm] = useState<RepairInput>({ deviceType: 'Phone', problemDescription: '', priority: 'normal', customerName: '' }); const [photo, setPhoto] = useState<string | null>(null); const [message, setMessage] = useState('');
  const customerMatches = useMemo(() => form.customerName?.trim() ? (customers.data ?? []).filter((customer) => customer.name.toLowerCase().includes(form.customerName!.toLowerCase())).slice(0, 3) : [], [customers.data, form.customerName]);
  if (!session.data?.authenticated && !session.isLoading) return <SignedOutState colors={colors} topInset={topInset} />;
  const set = (key: keyof RepairInput, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = () => {
    if (!form.deviceType?.trim() || !form.problemDescription?.trim()) { setMessage('Device type and problem description are required.'); return; }
    setMessage('');
    const body: RepairInput = { ...form, deviceType: form.deviceType.trim(), problemDescription: form.problemDescription.trim(), customerName: form.customerName?.trim() || undefined, customerPhone: form.customerPhone?.trim() || undefined, customerEmail: form.customerEmail?.trim() || undefined, deviceBrand: form.deviceBrand?.trim() || undefined, deviceModel: form.deviceModel?.trim() || undefined };
    create.mutate({ data: body }, {
      onSuccess: async (repair) => {
        if (photo) {
          // Photo upload is intentionally online-only when creating a new ticket;
          // this prevents an offline photo from losing its server repair id.
          setMessage('Repair created. Add the photo from the repair detail when connected.');
        } else setMessage(`${repair.ticketNumber} created.`);
        router.replace('/(tabs)/repairs');
      },
      onError: async (error) => {
        if (!isOfflineFailure(error)) { setMessage('Repair could not be created. Check the details and try again.'); return; }
        try {
          await enqueueMobileOperation({ action: 'create_repair', url: '/api/repairs', body: body as unknown as Record<string, unknown> });
          setMessage('Repair saved to the offline queue. The ticket number will be assigned after sync.');
          router.replace('/(tabs)/repairs');
        } catch (queueError) { setMessage(queueError instanceof Error ? queueError.message : 'This repair could not be queued.'); }
      },
    });
  };
  return <KeyboardAwareScrollViewCompat contentContainerStyle={[styles.content, { backgroundColor: colors.background, paddingTop: topInset + 20, paddingBottom: insets.bottom + 40 }]} bottomOffset={80}>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Feather name="arrow-left" size={18} color={colors.primary} /><Text style={[styles.backText, { color: colors.primary }]}>REPAIR QUEUE</Text></Pressable>
    <ScreenHeader eyebrow="MOBILINQ / NEW REPAIR" title="Capture the handoff." subtitle="Only safe, operational fields are available offline. Device unlock codes are never stored." icon="tool" colors={colors} />
    <OfflineBanner />
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Field label="DEVICE TYPE" value={form.deviceType ?? ''} onChangeText={(value) => set('deviceType', value)} colors={colors} placeholder="Phone, tablet, laptop…" />
      <View style={styles.two}><View style={styles.half}><Field label="BRAND" value={form.deviceBrand ?? ''} onChangeText={(value) => set('deviceBrand', value)} colors={colors} placeholder="Apple" /></View><View style={styles.half}><Field label="MODEL" value={form.deviceModel ?? ''} onChangeText={(value) => set('deviceModel', value)} colors={colors} placeholder="iPhone 14" /></View></View>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>CUSTOMER (OPTIONAL)</Text>
      <TextInput value={form.customerName ?? ''} onChangeText={(value) => { set('customerName', value); setForm((current) => ({ ...current, customerId: undefined })); }} placeholder="Search or type a name" placeholderTextColor={colors.mutedForeground} style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} />
      {customerMatches.map((customer) => <Pressable key={customer.id} onPress={() => setForm((current) => ({ ...current, customerId: customer.id, customerName: customer.name, customerPhone: customer.phone ?? undefined, customerEmail: customer.email ?? undefined }))} style={[styles.suggestion, { borderColor: colors.border }]}><Text style={[styles.suggestionName, { color: colors.foreground }]}>{customer.name}</Text><Text style={[styles.suggestionMeta, { color: colors.mutedForeground }]}>{customer.phone || customer.email || 'No contact details'}</Text></Pressable>)}
      <Field label="PHONE" value={form.customerPhone ?? ''} onChangeText={(value) => set('customerPhone', value)} colors={colors} placeholder="Optional" />
      <Field label="PROBLEM" value={form.problemDescription ?? ''} onChangeText={(value) => set('problemDescription', value)} colors={colors} placeholder="What needs attention?" multiline />
      <Text style={[styles.label, { color: colors.mutedForeground }]}>INTAKE PHOTO</Text><PhotoCapture onCapture={setPhoto} />{photo ? <Text style={[styles.photoReady, { color: colors.primary }]}>Photo validated and ready for online upload.</Text> : null}
      {!!message && <Text style={[styles.message, { color: colors.primary }]}>{message}</Text>}
      <Pressable testID="create-repair" accessibilityRole="button" disabled={create.isPending} onPress={submit} style={[styles.button, { backgroundColor: colors.primary, opacity: create.isPending ? 0.6 : 1 }]}><Feather name="check" size={16} color={colors.primaryForeground} /><Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{create.isPending ? 'CREATING…' : 'CREATE REPAIR'}</Text></Pressable>
    </View>
  </KeyboardAwareScrollViewCompat>;
}

function Field({ label, value, onChangeText, colors, placeholder, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; colors: ReturnType<typeof useColors>; placeholder: string; multiline?: boolean }) {
  return <View style={styles.field}><Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.mutedForeground} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} style={[styles.input, multiline && styles.textarea, { borderColor: colors.border, color: colors.foreground }]} /></View>;
}

const styles = StyleSheet.create({ content: { flexGrow: 1, paddingHorizontal: 18 }, back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16, minHeight: 36 }, backText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }, card: { borderWidth: 1, borderRadius: 14, padding: 14 }, field: { marginBottom: 12 }, two: { flexDirection: 'row', gap: 10 }, half: { flex: 1 }, label: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 6 }, input: { minHeight: 44, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, fontSize: 14 }, textarea: { minHeight: 92, paddingTop: 12 }, suggestion: { padding: 9, borderWidth: 1, borderRadius: 8, marginTop: -7, marginBottom: 8 }, suggestionName: { fontSize: 12, fontWeight: '600' }, suggestionMeta: { fontSize: 10, marginTop: 2 }, photoReady: { fontSize: 11, marginTop: 8 }, message: { fontSize: 12, lineHeight: 17, marginVertical: 10 }, button: { minHeight: 46, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }, buttonText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9 } });