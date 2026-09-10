import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfflineBanner } from '@/components/OfflineBanner';
import { OutboxPanel } from '@/components/OutboxPanel';
import { ScreenHeader, SignedOutState, getTopInset } from '@/components/BusinessUI';
import { LocalizedText as Text } from '@/components/BusinessUI';
import { useGetAuthSession } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

const eventTypes = [
  ['assignment', 'Assignments', 'A repair is assigned to your floor.', 'user-check'],
  ['estimate', 'Estimate approvals', 'A customer approved a repair estimate.', 'check-circle'],
  ['ready-pickup', 'Ready for pickup', 'A completed repair is ready for handoff.', 'bell'],
  ['payment', 'Payments', 'A payment or balance update needs attention.', 'credit-card'],
  ['update', 'Operations updates', 'Important store updates from the team.', 'radio'],
] as const;

export default function NotificationsScreen() {
  const colors = useColors(); const insets = useSafeAreaInsets(); const topInset = getTopInset(insets.top); const session = useGetAuthSession(); const [enabled, setEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(eventTypes.map(([key]) => [key, true])));
  useEffect(() => { const handle = (event: { url: string }) => { if (event.url.includes('repair/')) router.push(event.url.split('repair/')[1] ? `/repair/${event.url.split('repair/')[1]}` : '/(tabs)/repairs'); }; const subscription = Linking.addEventListener('url', handle); void Linking.getInitialURL(); return () => subscription.remove(); }, []);
  if (!session.data?.authenticated && !session.isLoading) return <SignedOutState colors={colors} topInset={topInset} />;
  return <View style={[styles.screen, { backgroundColor: colors.background }]}><View style={[styles.content, { paddingTop: topInset + 20, paddingBottom: insets.bottom + 110 }]}><ScreenHeader eyebrow="MOBILINQ / NOTIFICATIONS" title="The next thing, clearly." subtitle="Privacy-safe alerts keep previews generic and link you to the right workflow." icon="bell" colors={colors} /><OfflineBanner /><OutboxPanel /><View style={[styles.notice, { backgroundColor: colors.secondary, borderColor: colors.border }]}><Feather name="shield" size={16} color={colors.primary} /><Text style={[styles.noticeText, { color: colors.foreground }]}>Notification previews never include names, balances, device details, or payment data.</Text></View>{eventTypes.map(([key, title, detail, icon]) => <View key={key} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.icon, { backgroundColor: colors.accent }]}><Feather name={icon} size={16} color={colors.primary} /></View><View style={styles.copy}><Text style={[styles.title, { color: colors.foreground }]}>{title}</Text><Text style={[styles.detail, { color: colors.mutedForeground }]}>{detail}</Text></View><Pressable testID={`notification-${key}`} accessibilityRole="switch" accessibilityState={{ checked: enabled[key] }} onPress={() => setEnabled((current) => ({ ...current, [key]: !current[key] }))} style={[styles.toggle, { backgroundColor: enabled[key] ? colors.primary : colors.muted }]}><View style={[styles.knob, { backgroundColor: enabled[key] ? colors.primaryForeground : colors.mutedForeground, alignSelf: enabled[key] ? 'flex-end' : 'flex-start' }]} /></Pressable></View>)}<Text style={[styles.footer, { color: colors.mutedForeground }]}>Deep links are ready for assignment, estimate, pickup, payment, and update events. Push delivery can be enabled by the native release configuration.</Text></View></View>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flexGrow: 1, paddingHorizontal: 18 }, notice: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: 'row', gap: 9, marginBottom: 12 }, noticeText: { flex: 1, fontSize: 12, lineHeight: 17 }, row: { minHeight: 72, borderWidth: 1, borderRadius: 13, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 }, icon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1 }, title: { fontSize: 13, fontWeight: '700' }, detail: { fontSize: 11, lineHeight: 16, marginTop: 3 }, toggle: { width: 43, height: 25, borderRadius: 13, padding: 3, justifyContent: 'center' }, knob: { width: 19, height: 19, borderRadius: 10 }, footer: { fontSize: 11, lineHeight: 17, marginTop: 8 } });