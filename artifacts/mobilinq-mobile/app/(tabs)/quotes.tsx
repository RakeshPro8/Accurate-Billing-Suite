import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  getGetQuotationsQueryKey,
  getGetSettingsQueryKey,
  useGetAuthSession,
  useGetQuotations,
  useGetSettings,
} from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  EmptyState,
  ErrorState,
  formatDate,
  formatMoney,
  formatStatus,
  MetricCard,
  ScreenHeader,
  ScreenSkeleton,
  SectionHeading,
  SignedOutState,
  getTopInset,
} from '@/components/BusinessUI';

function isExpired(value: string | null | undefined) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return !Number.isNaN(timestamp) && timestamp < Date.now();
}

export default function QuotesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topInset = getTopInset(insets.top);
  const session = useGetAuthSession();
  const quotations = useGetQuotations(undefined, {
    query: {
      queryKey: getGetQuotationsQueryKey(),
      enabled: !!session.data?.authenticated,
    },
  });
  const settings = useGetSettings({
    query: {
      queryKey: getGetSettingsQueryKey(),
      enabled: !!session.data?.authenticated,
    },
  });
  const [refreshing, setRefreshing] = useState(false);
  const items = useMemo(() => quotations.data ?? [], [quotations.data]);
  const currency = settings.data?.currency ?? 'USD';
  const openCount = items.filter((quote) => !['accepted', 'declined', 'expired', 'converted'].includes(quote.status)).length;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([quotations.refetch(), settings.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  if (session.isLoading || quotations.isLoading) {
    return <ScreenSkeleton colors={colors} topInset={topInset} />;
  }
  if (!session.data?.authenticated) {
    return <SignedOutState colors={colors} topInset={topInset} />;
  }
  if (quotations.isError) {
    return (
      <ErrorState
        title="Quotes unavailable"
        message="Recent quotations could not be loaded."
        onRetry={() => void quotations.refetch()}
        colors={colors}
        topInset={topInset}
      />
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      contentContainerStyle={[
        styles.content,
        { backgroundColor: colors.background, paddingTop: topInset + 20 },
      ]}
    >
      <ScreenHeader
        eyebrow="MOBILINQ / QUOTES"
        title="Quotes in motion."
        subtitle="Keep the next customer decision visible."
        icon="message-square"
        colors={colors}
      />
      <View style={styles.metrics}>
        <MetricCard label="TOTAL QUOTES" value={String(items.length)} icon="file-text" colors={colors} />
        <MetricCard label="OPEN" value={String(openCount)} icon="clock" colors={colors} />
      </View>
      <SectionHeading title="Recent quotations" caption="Latest server records" colors={colors} />
      {items.length === 0 ? (
        <EmptyState
          icon="message-square"
          title="No quotations yet"
          message="New customer quotes will appear here."
          colors={colors}
        />
      ) : (
        items.map((quote) => {
          const expiry = quote.validUntil ?? quote.expiresAt;
          const expired = isExpired(expiry);
          return (
            <View
              key={quote.id}
              style={[styles.quoteCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.quoteTop}>
                <View style={[styles.quoteIcon, { backgroundColor: colors.accent }]}>
                  <Feather name="message-square" size={16} color={colors.primary} />
                </View>
                <View style={styles.quoteCopy}>
                  <Text style={[styles.quoteNumber, { color: colors.foreground }]}>
                    {quote.quoteNumber}
                  </Text>
                  <Text style={[styles.customer, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {quote.customerName || 'Walk-in customer'}
                  </Text>
                </View>
                <Text style={[styles.total, { color: colors.foreground }]}>
                  {formatMoney(quote.total, currency)}
                </Text>
              </View>
              <View style={[styles.quoteMeta, { borderTopColor: colors.border }]}>
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {formatDate(quote.createdAt)}
                </Text>
                <View style={styles.expiry}>
                  <Feather name="calendar" size={12} color={expired ? colors.destructive : colors.primary} />
                  <Text style={[styles.metaText, { color: expired ? colors.destructive : colors.primary }]}>
                    {expiry ? `${expired ? 'EXPIRED' : 'VALID TO'} ${formatDate(expiry)}` : 'NO EXPIRY'}
                  </Text>
                </View>
                <Text style={[styles.status, { color: colors.mutedForeground }]}>
                  {formatStatus(quote.status)}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingBottom: 120,
  },
  metrics: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  quoteCard: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 14,
    marginBottom: 10,
  },
  quoteTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quoteIcon: {
    width: 35,
    height: 35,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteCopy: {
    flex: 1,
  },
  quoteNumber: {
    fontSize: 14,
    fontWeight: '700',
  },
  customer: {
    fontSize: 11,
    marginTop: 3,
  },
  total: {
    fontSize: 14,
    fontWeight: '700',
  },
  quoteMeta: {
    borderTopWidth: 1,
    marginTop: 13,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  metaText: {
    fontSize: 10,
  },
  expiry: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  status: {
    fontSize: 10,
    textTransform: 'capitalize',
  },
});