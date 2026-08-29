import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getGetRepairsQueryKey, getGetSalesQueryKey, getGetSignInEmployeesQueryKey, useGetAuthSession, useGetRepairs, useGetSales, useGetSignInEmployees, useSignInEmployee } from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const session = useGetAuthSession();
  const employees = useGetSignInEmployees({ query: { queryKey: getGetSignInEmployeesQueryKey(), enabled: !session.data?.authenticated } });
  const repairs = useGetRepairs(undefined, { query: { queryKey: getGetRepairsQueryKey(), enabled: !!session.data?.authenticated } });
  const sales = useGetSales(undefined, { query: { queryKey: getGetSalesQueryKey(), enabled: !!session.data?.authenticated } });
  const signIn = useSignInEmployee();
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const activeRepairs = useMemo(() => (repairs.data ?? []).filter((repair) => !['picked_up', 'cancelled'].includes(repair.status)), [repairs.data]);

  useEffect(() => {
    if (!employeeId && employees.data?.[0]) setEmployeeId(employees.data[0].id);
  }, [employees.data, employeeId]);

  if (session.isLoading || employees.isLoading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  if (!session.data?.authenticated) {
    return <ScrollView contentContainerStyle={[styles.auth, { paddingTop: insets.top + 48, backgroundColor: colors.background }]}>
      <View style={[styles.logo, { backgroundColor: colors.primary }]}><Feather name="smartphone" size={30} color={colors.primaryForeground} /></View>
      <Text style={[styles.brand, { color: colors.foreground }]}>MOBILINQ</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Operations, wherever you are.</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>EMPLOYEE</Text>
        <View style={styles.employeeList}>{(employees.data ?? []).map((employee) => <Pressable key={employee.id} testID={`employee-${employee.id}`} onPress={() => setEmployeeId(employee.id)} style={[styles.employee, { borderColor: employeeId === employee.id ? colors.primary : colors.border, backgroundColor: employeeId === employee.id ? colors.accent : colors.background }]}><Text style={[styles.employeeName, { color: colors.foreground }]}>{employee.name}</Text><Text style={[styles.employeeRole, { color: colors.mutedForeground }]}>{employee.role}</Text></Pressable>)}</View>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>PIN</Text>
        <TextInput testID="pin-input" value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" maxLength={8} placeholder="Enter PIN" placeholderTextColor={colors.mutedForeground} style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} />
        {!!error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}
        <Pressable testID="sign-in" disabled={signIn.isPending || !employeeId || pin.length < 4} onPress={() => { setError(''); signIn.mutate({ data: { employeeId: employeeId!, pin } }, { onError: () => setError('Sign-in failed. Check your PIN and connection.'), onSuccess: () => setPin('') }); }} style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: signIn.isPending || !employeeId || pin.length < 4 ? 0.5 : 1 }]}><Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{signIn.isPending ? 'SIGNING IN…' : 'SIGN IN'}</Text></Pressable>
      </View>
      <Text style={[styles.footnote, { color: colors.mutedForeground }]}>Uses the same server session and employee permissions as the web app.</Text>
    </ScrollView>;
  }

  const employee = session.data.employee;
  return <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await Promise.all([session.refetch(), repairs.refetch(), sales.refetch()]); setRefreshing(false); }} tintColor={colors.primary} />} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, backgroundColor: colors.background }]}>
    <View style={styles.header}><View><Text style={[styles.kicker, { color: colors.primary }]}>MOBILINQ / LIVE</Text><Text style={[styles.title, { color: colors.foreground }]}>Good to see you, {employee.name.split(' ')[0]}.</Text></View><View style={[styles.statusDot, { backgroundColor: colors.primary }]} /></View>
    <View style={styles.grid}><Metric label="OPEN REPAIRS" value={String(activeRepairs.length)} icon="tool" colors={colors} /><Metric label="SALES TODAY" value={String(sales.data?.items?.length ?? 0)} icon="credit-card" colors={colors} /></View>
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.row}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Active repair queue</Text><Text style={[styles.link, { color: colors.primary }]}>SYNCED</Text></View>{activeRepairs.slice(0, 5).map((repair) => <View key={repair.id} style={[styles.repairRow, { borderTopColor: colors.border }]}><View style={[styles.repairIcon, { backgroundColor: colors.accent }]}><Feather name="tool" size={16} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={[styles.repairName, { color: colors.foreground }]}>{repair.ticketNumber} · {repair.deviceType}</Text><Text style={[styles.repairMeta, { color: colors.mutedForeground }]}>{repair.customerName ?? 'Walk-in'} · {repair.status.replace('_', ' ')}</Text></View></View>)}{activeRepairs.length === 0 && <Text style={[styles.empty, { color: colors.mutedForeground }]}>No active repairs right now.</Text>}</View>
  </ScrollView>;
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
  primaryButton: { height: 48, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontWeight: '700', letterSpacing: 1 },
  error: { fontSize: 13, marginBottom: 12 },
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