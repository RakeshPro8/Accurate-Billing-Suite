import React, { useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useGetCustomerRights, type CustomerRightsEntry } from '@workspace/api-client-react';
import { getTopInset, ScreenHeader, LocalizedText as Text } from '@/components/BusinessUI';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useMobileOffline } from '@/context/MobileOfflineContext';
import { useLocale } from '@/context/LocaleContext';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const provinces = ['All', 'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];
const provinceLabels: Record<string, string> = {
  AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick', NL: 'Newfoundland and Labrador',
  NS: 'Nova Scotia', NT: 'Northwest Territories', NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island',
  QC: 'Quebec', SK: 'Saskatchewan', YT: 'Yukon',
};
const topics = [
  ['All', 'All topics'],
  ['authorization-estimates', 'Authorization & estimates'],
  ['diagnostics', 'Diagnostics'],
  ['deposits-payment', 'Deposits & payment'],
  ['parts-warranty', 'Parts & warranty'],
  ['data-passwords', 'Personal data & passwords'],
  ['abandoned-pickup', 'Abandoned devices & pickup'],
  ['receipts', 'Receipts & records'],
  ['complaints', 'Complaints'],
  ['escalation', 'Escalation'],
] as const;

export default function RightsGuideScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, locale } = useLocale();
  const { isStale } = useMobileOffline();
  const [province, setProvince] = useState('All');
  const [topic, setTopic] = useState('All');
  const [search, setSearch] = useState('');
  const query = useGetCustomerRights({
    provinceCode: province === 'All' ? undefined : province,
    topic: topic === 'All' ? undefined : topic,
    language: locale,
  });
  const entries = useMemo(() => (query.data?.entries ?? []).filter((entry) => {
    const needle = search.trim().toLowerCase();
    return !needle || `${entry.title} ${entry.summary} ${entry.provinceCode}`.toLowerCase().includes(needle);
  }), [query.data?.entries, search]);
  const selectedTopicLabel = topics.find(([value]) => value === topic)?.[1] ?? 'All topics';
  const selectedProvinceLabel = province === 'All' ? t('All jurisdictions') : `${province} · ${provinceLabels[province]}`;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: getTopInset(insets.top) + 18, paddingBottom: insets.bottom + 110 }]}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}><ScreenHeader eyebrow={t('EMPLOYEE REFERENCE')} title={t('Customer Rights Guide')} subtitle={t('Plain-language prompts for repair conversations. Published guidance only; ask a manager when unsure.')} icon="book-open" colors={colors} /></View>
        <LanguageSwitcher />
      </View>
      <OfflineBanner />
      {isStale ? <View style={[styles.staleBanner, { backgroundColor: colors.accent, borderColor: colors.border }]}><Feather name="clock" size={14} color={colors.primary} /><Text style={[styles.staleText, { color: colors.foreground }]}>{t('Showing read-only cached guidance. Check the review date before relying on it.')}</Text></View> : null}
      <View style={[styles.disclaimer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="shield" size={16} color={colors.primary} />
        <Text style={[styles.disclaimerText, { color: colors.foreground }]}>{t('Internal compliance aid, not legal advice. Never promise an outcome.')}</Text>
      </View>
      <TextInput value={search} onChangeText={setSearch} placeholder={t('Search the guide')} placeholderTextColor={colors.mutedForeground} style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} />
      <View style={styles.selectionSummary} accessibilityLiveRegion="polite">
        <View style={[styles.selectionPill, { backgroundColor: colors.accent, borderColor: colors.border }]}><Text style={[styles.selectionText, { color: colors.primary }]}>{selectedProvinceLabel}</Text></View>
        <View style={[styles.selectionPill, { backgroundColor: colors.accent, borderColor: colors.border }]}><Text style={[styles.selectionText, { color: colors.primary }]}>{t(selectedTopicLabel)}</Text></View>
        <View style={[styles.selectionPill, { backgroundColor: colors.accent, borderColor: colors.border }]}><Text style={[styles.selectionText, { color: colors.primary }]}>{locale === 'fr' ? 'Français' : 'English'}</Text></View>
        <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>{entries.length} {t('published')} {entries.length === 1 ? t('entry') : t('entries')}</Text>
      </View>
      <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>{t('JURISDICTION')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{provinces.map((value) => <FilterChip key={value} value={value} selected={province === value} onPress={() => setProvince(value)} colors={colors} />)}</ScrollView>
      <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>{t('TOPIC')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{topics.map(([value, label]) => <FilterChip key={value} value={t(label)} selected={topic === value} onPress={() => setTopic(value)} colors={colors} />)}</ScrollView>
      {query.isLoading ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>{t('Loading published guidance…')}</Text>
        : query.isError ? <SafeState colors={colors} title={t('Guide unavailable')} body={t('There is no safe legal-content fallback. Reconnect or ask a manager for the approved source.')} />
        : entries.length === 0 ? <SafeState colors={colors} title={t('No published guidance matches')} body={t('Ask a manager rather than relying on an unreviewed claim.')} />
        : entries.map((entry) => <GuidanceCard key={entry.id} entry={entry} colors={colors} t={t} />)}
      <Text style={[styles.footer, { color: colors.mutedForeground }]}>{t('Read-only offline cache')} · {t('published entries include an official source and review date.')}</Text>
    </ScrollView>
  );
}

function FilterChip({ value, selected, onPress, colors }: { value: string; selected: boolean; onPress: () => void; colors: ReturnType<typeof useColors> }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border }]}><Text style={{ color: selected ? colors.primaryForeground : colors.foreground, fontSize: 12, fontWeight: '600' }}>{value}</Text></Pressable>;
}

function GuidanceCard({ entry, colors, t }: { entry: CustomerRightsEntry; colors: ReturnType<typeof useColors>; t: (key: string, values?: Record<string, string | number>) => string }) {
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: entry.stale ? colors.destructive : colors.border }]}>
    <View style={styles.cardHeader}><View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{entry.title}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{entry.provinceCode} · {provinceLabels[entry.provinceCode]} · {t(topics.find(([value]) => value === entry.topic)?.[1] ?? entry.topic)}</Text></View><View style={[styles.status, { backgroundColor: entry.stale ? colors.destructive : colors.accent }]}><Text style={{ color: entry.stale ? colors.primaryForeground : colors.primary, fontSize: 10, fontWeight: '700' }}>{entry.stale ? t('STALE') : t('PUBLISHED')}</Text></View></View>
    <Text style={[styles.summary, { color: colors.foreground }]}>{entry.summary}</Text>
    {entry.readAloudScript ? <View style={[styles.script, { backgroundColor: colors.accent }]}><Text style={[styles.scriptLabel, { color: colors.primary }]}><Feather name="volume-2" size={13} color={colors.primary} /> {t('READ ALOUD')}</Text><Text style={[styles.scriptText, { color: colors.mutedForeground }]}>{entry.readAloudScript}</Text></View> : null}
    <View style={[styles.infographic, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <Text style={[styles.infographicTitle, { color: colors.primary }]}>{t('AT A GLANCE')}</Text>
      {entry.infographic.steps.map((step, index) => <View key={`${entry.id}-step-${index}`} style={styles.step}><View style={[styles.stepNumber, { backgroundColor: colors.primary }]}><Text style={{ color: colors.primaryForeground, fontSize: 11, fontWeight: '700' }}>{index + 1}</Text></View><Text style={[styles.stepText, { color: colors.foreground }]}>{step}</Text></View>)}
      <View style={styles.panelRow}><GuidePanel title={t('DO')} items={entry.infographic.do} colors={colors} positive /><GuidePanel title={t('AVOID')} items={entry.infographic.avoid} colors={colors} /></View>
      <View style={[styles.escalation, { backgroundColor: colors.accent }]}><Text style={[styles.panelTitle, { color: colors.primary }]}>{t('MANAGER / ESCALATION POINT')}</Text><Text style={[styles.panelText, { color: colors.foreground }]}>{entry.infographic.escalation}</Text></View>
      <Text style={[styles.aidNote, { color: colors.mutedForeground }]}>{t('Instructional aid only; it does not make a legal determination.')}</Text>
    </View>
    <Text style={[styles.meta, { color: colors.mutedForeground }]}>{t('Effective')} {entry.effectiveFrom} · {t('reviewed')} {entry.lastReviewedAt}</Text>
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(entry.sourceUrl)} style={styles.source}><Feather name="external-link" size={13} color={colors.primary} /><Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>{t('Open official source')}</Text></Pressable>
  </View>;
}

function GuidePanel({ title, items, colors, positive = false }: { title: string; items: string[]; colors: ReturnType<typeof useColors>; positive?: boolean }) {
  return <View style={[styles.panel, { borderColor: colors.border, backgroundColor: positive ? colors.accent : colors.background }]}><Text style={[styles.panelTitle, { color: colors.primary }]}>{title}</Text>{items.map((item, index) => <Text key={`${title}-${index}`} style={[styles.panelText, { color: colors.foreground }]}>• {item}</Text>)}</View>;
}

function SafeState({ title, body, colors }: { title: string; body: string; colors: ReturnType<typeof useColors> }) {
  return <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}><Feather name="shield" size={22} color={colors.mutedForeground} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text><Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>{body}</Text></View>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headerCopy: { flex: 1 },
  staleBanner: { borderWidth: 1, borderRadius: 10, padding: 11, flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 },
  staleText: { flex: 1, fontSize: 12, lineHeight: 17 },
  disclaimer: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: 'row', gap: 9, alignItems: 'center', marginBottom: 12 },
  disclaimerText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  search: { borderWidth: 1, borderRadius: 10, height: 44, paddingHorizontal: 13, fontSize: 14, marginBottom: 16 },
  selectionSummary: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginBottom: 15 },
  selectionPill: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5 },
  selectionText: { fontSize: 11, fontWeight: '700' },
  resultCount: { fontSize: 11, marginLeft: 2 },
  filterLabel: { fontSize: 10, letterSpacing: 1.5, fontWeight: '700', marginBottom: 8 },
  chips: { gap: 8, paddingBottom: 15 },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  card: { borderWidth: 1, borderRadius: 14, padding: 15, marginTop: 12 },
  cardHeader: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  cardTitle: { fontSize: 16, fontWeight: '700', lineHeight: 21 },
  status: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 5 },
  meta: { fontSize: 11, lineHeight: 17, marginTop: 5 },
  summary: { fontSize: 13, lineHeight: 19, marginTop: 13 },
  script: { borderRadius: 9, padding: 11, marginTop: 13 },
  scriptLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  scriptText: { fontSize: 12, lineHeight: 18, fontStyle: 'italic' },
  infographic: { borderWidth: 1, borderRadius: 10, padding: 11, marginTop: 13 },
  infographicTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 },
  step: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 8 },
  stepNumber: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  stepText: { flex: 1, fontSize: 12, lineHeight: 17 },
  panelRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  panel: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 8 },
  panelTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.7, marginBottom: 5 },
  panelText: { fontSize: 11, lineHeight: 16, marginBottom: 3 },
  escalation: { borderRadius: 8, padding: 9, marginTop: 8 },
  aidNote: { fontSize: 10, lineHeight: 14, marginTop: 8 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 11 },
  empty: { textAlign: 'center', paddingVertical: 35, fontSize: 13 },
  emptyCard: { borderWidth: 1, borderRadius: 14, padding: 24, alignItems: 'center', marginTop: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', marginTop: 9 },
  emptyBody: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  footer: { textAlign: 'center', fontSize: 11, lineHeight: 16, paddingVertical: 20 },
});