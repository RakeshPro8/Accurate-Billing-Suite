import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { changeEmployeePin, createPinResetRequest, getGetInventorySummaryQueryKey, getGetRepairsQueryKey, getGetSalesQueryKey, getGetSignInEmployeesQueryKey, recoverAdminAccount, useGetAuthSession, useGetInventorySummary, useGetRepairs, useGetSales, useGetSignInEmployees, useSignInEmployee } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import { InventoryHealth, getInventoryItems } from '@/components/InventoryHealth';
import { getTopInset, ScreenSkeleton } from '@/components/BusinessUI';
import { LocalizedText as Text } from '@/components/BusinessUI';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfflineBanner } from '@/components/OfflineBanner';
import { OutboxPanel } from '@/components/OutboxPanel';
import { persistSessionCookie } from '@/context/MobileOfflineContext';
import { setMobileScope } from '@/lib/mobile-offline';
import { useLocale } from '@/context/LocaleContext';

export default function HomeScreen() {
  const colors = useColors();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const topInset = getTopInset(insets.top);
  const session = useGetAuthSession();
  const employees = useGetSignInEmployees({ query: { queryKey: getGetSignInEmployeesQueryKey(), enabled: !session.data?.authenticated } });
  const repairs = useGetRepairs(undefined, { query: { queryKey: getGetRepairsQueryKey(), enabled: !!session.data?.authenticated } });
  const sales = useGetSales(undefined, { query: { queryKey: getGetSalesQueryKey(), enabled: !!session.data?.authenticated } });
  const inventory = useGetInventorySummary({ query: { queryKey: getGetInventorySummaryQueryKey(), enabled: !!session.data?.authenticated } });
  const signIn = useSignInEmployee();
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState<'request' | 'admin' | null>(null);
  const [recoveryNote, setRecoveryNote] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryNewPin, setRecoveryNewPin] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinChangeError, setPinChangeError] = useState('');
  const [pinChangePending, setPinChangePending] = useState(false);
  const activeRepairs = useMemo(() => (repairs.data ?? []).filter((repair) => !['picked_up', 'cancelled'].includes(repair.status)), [repairs.data]);
  const inventoryItems = useMemo(() => getInventoryItems(inventory.data), [inventory.data]);
  const atRiskRepairs = useMemo(() => activeRepairs.filter((repair) => isSlaRisk(repair)), [activeRepairs]);
  const lowStockCount = useMemo(() => inventoryItems.filter((item) => item.active !== false && (item.stock <= 0 || item.lowStock === true || (typeof item.reorderPoint === 'number' && item.stock <= item.reorderPoint))).length, [inventoryItems]);

  async function submitResetRequest() {
    if (!employeeId) return;
    try {
      await createPinResetRequest({ employeeId, note: recoveryNote.trim() || undefined });
      setRecoveryMessage(t('Your request was sent. Ask an administrator to review it in Employee management.'));
      setRecoveryNote('');
    } catch {
      setRecoveryMessage(t('Unable to submit the request. Try again later.'));
    }
  }

  async function submitAdminRecovery() {
    if (!/^\d{4,8}$/.test(recoveryNewPin)) {
      setRecoveryMessage(t('Choose a 4-8 digit PIN.'));
      return;
    }
    try {
      const result = await recoverAdminAccount({ recoveryCode, newPin: recoveryNewPin });
      setMobileScope({ employeeId: result.employee.id, storeId: null });
      await persistSessionCookie();
      setRecoveryMode(null);
      setRecoveryMessage('');
      setPin('');
    } catch {
      setRecoveryMessage(t('Unable to complete admin recovery.'));
    }
  }

  async function submitPinChange() {
    if (!/^\d{4,8}$/.test(newPin)) {
      setPinChangeError(t('Choose a 4-8 digit PIN.'));
      return;
    }
    if (newPin !== confirmNewPin) {
      setPinChangeError(t('PINs do not match.'));
      return;
    }
    setPinChangePending(true);
    setPinChangeError('');
    try {
      await changeEmployeePin({ newPin });
      await session.refetch();
      setNewPin('');
      setConfirmNewPin('');
    } catch {
      setPinChangeError(t('Unable to change the PIN. Try again.'));
    } finally {
      setPinChangePending(false);
    }
  }

  useEffect(() => {
    if (!employeeId && employees.data?.[0]) setEmployeeId(employees.data[0].id);
  }, [employees.data, employeeId]);

  if (session.isLoading || employees.isLoading || (session.data?.authenticated && inventory.isLoading)) return <ScreenSkeleton colors={colors} topInset={topInset} />;
  if (!session.data?.authenticated) {
    return <ScrollView contentContainerStyle={[styles.auth, { paddingTop: topInset + 48, backgroundColor: colors.background }]}>
      <View style={[styles.logo, { backgroundColor: colors.primary }]}><Feather name="smartphone" size={30} color={colors.primaryForeground} /></View>
      <Text style={[styles.brand, { color: colors.foreground }]}>MOBILINQ</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Operations, wherever you are.</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>EMPLOYEE</Text>
        <View style={styles.employeeList}>{(employees.data ?? []).map((employee) => <Pressable key={employee.id} testID={`employee-${employee.id}`} onPress={() => setEmployeeId(employee.id)} style={[styles.employee, { borderColor: employeeId === employee.id ? colors.primary : colors.border, backgroundColor: employeeId === employee.id ? colors.accent : colors.background }]}><Text style={[styles.employeeName, { color: colors.foreground }]}>{employee.name}</Text><Text style={[styles.employeeRole, { color: colors.mutedForeground }]}>{employee.role}</Text></Pressable>)}</View>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>PIN</Text>
        <TextInput testID="pin-input" value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" maxLength={8} placeholder="Enter PIN" placeholderTextColor={colors.mutedForeground} style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} />
        {!!error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}
         <Pressable testID="sign-in" disabled={signIn.isPending || !employeeId || pin.length < 4} onPress={() => { setError(''); signIn.mutate({ data: { employeeId: employeeId!, pin } }, { onError: () => setError('Sign-in failed. Check your PIN and connection.'), onSuccess: (result) => { setPin(''); setMobileScope({ employeeId: result.employee.id, storeId: null }); void persistSessionCookie(); } }); }} style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: signIn.isPending || !employeeId || pin.length < 4 ? 0.5 : 1 }]}><Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{signIn.isPending ? 'SIGNING IN…' : 'SIGN IN'}</Text></Pressable>
         <Pressable disabled={!employeeId} onPress={() => { setRecoveryMode('request'); setRecoveryMessage(''); }}><Text style={[styles.recoveryLink, { color: colors.primary }]}>{t('Forgot your PIN?')}</Text></Pressable>
         <Pressable onPress={() => { setRecoveryMode('admin'); setRecoveryMessage(''); }}><Text style={[styles.recoveryLink, { color: colors.mutedForeground }]}>{t('Administrator locked out? Use recovery code')}</Text></Pressable>
         {recoveryMode && <View style={[styles.recoveryCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
           <Text style={[styles.recoveryTitle, { color: colors.foreground }]}>{recoveryMode === 'request' ? t('PIN recovery') : t('Administrator recovery code')}</Text>
           {recoveryMode === 'request' ? <>
             <Text style={[styles.recoveryHelp, { color: colors.mutedForeground }]}>{t('The administrator will issue a temporary PIN. It expires after 15 minutes and must be replaced after sign-in.')}</Text>
             <TextInput value={recoveryNote} onChangeText={setRecoveryNote} placeholder={t('Note (optional)')} placeholderTextColor={colors.mutedForeground} multiline style={[styles.input, styles.noteInput, { borderColor: colors.border, color: colors.foreground }]} />
             <Pressable disabled={!employeeId} onPress={() => void submitResetRequest()} style={[styles.secondaryButton, { borderColor: colors.primary }]}><Text style={[styles.secondaryButtonText, { color: colors.primary }]}>{t('Ask admin for a temporary PIN')}</Text></Pressable>
           </> : <>
             <Text style={[styles.recoveryHelp, { color: colors.mutedForeground }]}>{t('There is no hidden bypass. This requires the one-time recovery code saved during setup or rotated by a signed-in administrator.')}</Text>
             <TextInput value={recoveryCode} onChangeText={setRecoveryCode} placeholder={t('Enter the recovery code')} placeholderTextColor={colors.mutedForeground} autoCapitalize="characters" style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} />
             <TextInput value={recoveryNewPin} onChangeText={setRecoveryNewPin} placeholder={t('New administrator PIN')} placeholderTextColor={colors.mutedForeground} secureTextEntry keyboardType="number-pad" maxLength={8} style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} />
             <Pressable onPress={() => void submitAdminRecovery()} style={[styles.secondaryButton, { borderColor: colors.primary }]}><Text style={[styles.secondaryButtonText, { color: colors.primary }]}>{t('Recover administrator account')}</Text></Pressable>
           </>}
           {!!recoveryMessage && <Text style={[styles.recoveryHelp, { color: colors.primary }]}>{recoveryMessage}</Text>}
           <Pressable onPress={() => setRecoveryMode(null)}><Text style={[styles.recoveryLink, { color: colors.mutedForeground }]}>{t('Close')}</Text></Pressable>
         </View>}
      </View>
      <Text style={[styles.footnote, { color: colors.mutedForeground }]}>Uses the same server session and employee permissions as the web app.</Text>
    </ScrollView>;
  }

  const employee = session.data.employee;
  if (employee.requiresPinChange) {
    return <ScrollView contentContainerStyle={[styles.auth, { paddingTop: topInset + 48, backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.recoveryTitle, { color: colors.foreground }]}>{t('Choose a new PIN to continue')}</Text>
        <Text style={[styles.recoveryHelp, { color: colors.mutedForeground }]}>{t('Your temporary PIN expires shortly. Choose a permanent PIN before continuing.')}</Text>
        <TextInput value={newPin} onChangeText={setNewPin} placeholder={t('New PIN')} placeholderTextColor={colors.mutedForeground} secureTextEntry keyboardType="number-pad" maxLength={8} style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} />
        <TextInput value={confirmNewPin} onChangeText={setConfirmNewPin} placeholder={t('Confirm new PIN')} placeholderTextColor={colors.mutedForeground} secureTextEntry keyboardType="number-pad" maxLength={8} style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} />
        {!!pinChangeError && <Text style={[styles.error, { color: colors.destructive }]}>{pinChangeError}</Text>}
        <Pressable disabled={pinChangePending} onPress={() => void submitPinChange()} style={[styles.primaryButton, { backgroundColor: colors.primary }]}><Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{t('Save new PIN')}</Text></Pressable>
      </View>
    </ScrollView>;
  }
  return <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); try { await Promise.all([session.refetch(), repairs.refetch(), sales.refetch(), inventory.refetch()]); } finally { setRefreshing(false); } }} tintColor={colors.primary} colors={[colors.primary]} />} contentContainerStyle={[styles.content, { paddingTop: topInset + 24, backgroundColor: colors.background }]}>
    <View style={styles.header}><View><Text style={[styles.kicker, { color: colors.primary }]}>MOBILINQ / LIVE</Text><Text style={[styles.title, { color: colors.foreground }]}>Good to see you, {employee.name.split(' ')[0]}.</Text></View><View style={[styles.statusDot, { backgroundColor: colors.primary }]} /></View>
      <OfflineBanner />
      <OutboxPanel />
      <View style={styles.grid}><Metric label="OPEN REPAIRS" value={String(activeRepairs.length)} icon="tool" colors={colors} /><Metric label="AT RISK" value={String(atRiskRepairs.length)} icon="alert-triangle" colors={colors} /><Metric label="LOW STOCK" value={String(lowStockCount)} icon="package" colors={colors} /></View>
      <InventoryHealth items={inventoryItems} />
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.row}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Active repair queue</Text><Text style={[styles.link, { color: colors.primary }]}>SYNCED</Text></View>{activeRepairs.slice(0, 5).map((repair) => <View key={repair.id} style={[styles.repairRow, { borderTopColor: colors.border }]}><View style={[styles.repairIcon, { backgroundColor: colors.accent }]}><Feather name="tool" size={16} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={[styles.repairName, { color: colors.foreground }]}>{repair.ticketNumber} · {repair.deviceType}</Text><Text style={[styles.repairMeta, { color: colors.mutedForeground }]}>{repair.customerName ?? 'Walk-in'} · {repair.status.replace('_', ' ')}</Text></View></View>)}{activeRepairs.length === 0 && <Text style={[styles.empty, { color: colors.mutedForeground }]}>No active repairs right now.</Text>}</View>
  </ScrollView>;
}

function isSlaRisk(repair: { status: string; priority: string; createdAt: string }) {
  if (['picked_up', 'cancelled'].includes(repair.status)) return false;
  const targetDays = repair.priority === 'urgent' ? 1 : repair.priority === 'high' ? 2 : repair.priority === 'low' ? 7 : 4;
  return new Date(repair.createdAt).getTime() + targetDays * 24 * 60 * 60 * 1000 - Date.now() <= 24 * 60 * 60 * 1000;
}

function Metric({ label, value, icon, colors }: { label: string; value: string; icon: keyof typeof Feather.glyphMap; colors: ReturnType<typeof useColors> }) {
  return <View style={[styles.metric, { backgroundColor: colors.card, borderColor: colors.border }]}><Feather name={icon} size={18} color={colors.primary} /><Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text><Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  auth: { flexGrow: 1, paddingHorizontal: 24, alignItems: 'center' },
  logo: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  brand: { fontSize: 22, fontWeight: '700', letterSpacing: 3 },
  subtitle: { fontSize: 15, marginTop: 6, marginBottom: 32 },
  card: { width: '100%', borderWidth: 1, borderRadius: 14, padding: 18 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.3, marginBottom: 8 },
  employeeList: { gap: 8, marginBottom: 18 },
  employee: { padding: 12, borderWidth: 1, borderRadius: 10 },
  employeeName: { fontSize: 15, fontWeight: '600' },
  employeeRole: { fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  input: { height: 48, borderWidth: 1, borderRadius: 9, paddingHorizontal: 14, fontSize: 16, marginBottom: 12 },
  noteInput: { height: 72, textAlignVertical: 'top', paddingTop: 12 },
  primaryButton: { height: 48, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontWeight: '700', letterSpacing: 1 },
  error: { fontSize: 13, marginBottom: 12 },
  recoveryCard: { borderWidth: 1, borderRadius: 10, padding: 14, marginTop: 14, gap: 10 },
  recoveryTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  recoveryHelp: { fontSize: 12, lineHeight: 18 },
  recoveryLink: { textAlign: 'center', fontSize: 12, marginTop: 12 },
  secondaryButton: { minHeight: 44, borderWidth: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  secondaryButtonText: { fontWeight: '700', fontSize: 12, textAlign: 'center' },
  footnote: { textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 18 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  kicker: { fontSize: 11, letterSpacing: 1.8, fontWeight: '700' },
  title: { fontSize: 25, fontWeight: '700', marginTop: 6 },
  statusDot: { width: 11, height: 11, borderRadius: 6 },
  grid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  metric: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 15 },
  metricValue: { fontSize: 32, fontWeight: '700', marginTop: 10 },
  metricLabel: { fontSize: 10, letterSpacing: 1, marginTop: 3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  link: { fontSize: 10, letterSpacing: 1, fontWeight: '700' },
  repairRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, paddingVertical: 14 },
  repairIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  repairName: { fontSize: 14, fontWeight: '600' },
  repairMeta: { fontSize: 12, marginTop: 3, textTransform: 'capitalize' },
  empty: { fontSize: 13, paddingVertical: 20 },
});