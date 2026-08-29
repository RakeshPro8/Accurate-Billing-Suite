import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  getGetSalesQueryKey,
  getGetSettingsQueryKey,
  useGetAuthSession,
  useGetSales,
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

export default function BillingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topInset = getTopInset(insets.top);
  const session = useGetAuthSession();
  const sales = useGetSales(undefined, {
    query: {
      queryKey: getGetSalesQueryKey(),
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
  const currency = settings.data?.currency ?? 'USD';
  const outstanding = useMemo(
    () =>
      (sales.data?.items ?? []).filter(
        (sale) => Number(sale.balance ?? 0) > 0 && sale.status !== 'cancelled',
      ),
    [sales.data?.items],
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([sales.refetch(), settings.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  if (session.isLoading || sales.isLoading) {
    return <ScreenSkeleton colors={colors} topInset={topInset} />;
  }
  if (!session.data?.authenticated) {
    return <SignedOutState colors={colors} topInset={topInset} />;
  }
  if (sales.isError) {
    return (
      <ErrorState
        title="Billing unavailable"
        message="Outstanding invoices could not be loaded."
        onRetry={() => void sales.refetch()}
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
        eyebrow="MOBILINQ / BILLING"
        title="Money still open."
        subtitle="A focused view of invoices that need attention."
        icon="dollar-sign"
        colors={colors}
      />
      <View style={[styles.focusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.focusLabel, { color: colors.mutedForeground }]}>OUTSTANDING BALANCE</Text>
        <Text style={[styles.focusValue, { color: colors.foreground }]}>
          {formatMoney(sales.data?.summary.outstanding, currency)}
        </Text>
        <View style={styles.focusFoot}>
          <Feather name="file-text" size={14} color={colors.primary} />
          <Text style={[styles.focusMeta, { color: colors.mutedForeground }]}>
            {outstanding.length} invoice{outstanding.length === 1 ? '' : 's'} with a balance
          </Text>
        </View>
      </View>
      <View style={styles.metrics}>
        <MetricCard
          label="RECENT SALES"
          value={String(sales.data?.items.length ?? 0)}
          icon="shopping-bag"
          colors={colors}
        />
        <MetricCard
          label="SALES TOTAL"
          value={formatMoney(sales.data?.summary.total, currency)}
          icon="trending-up"
          colors={colors}
        />
      </View>
      <SectionHeading title="Needs payment" caption="Use the web register for payment capture" colors={colors} />
      {outstanding.length === 0 ? (
        <EmptyState
          icon="check-circle"
          title="Nothing outstanding"
          message="All recent invoices have a zero balance."
          colors={colors}
        />
      ) : (
        outstanding.map((sale) => (
          <View
            key={sale.id}
            style={[styles.invoiceCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={styles.invoiceTop}>
              <View style={[styles.invoiceIcon, { backgroundColor: colors.accent }]}>
                <Feather name="clock" size={15} color={colors.destructive} />
              </View>
              <View style={styles.invoiceCopy}>
                <Text style={[styles.invoiceNumber, { color: colors.foreground }]}>
                  {sale.invoiceNumber}
                </Text>
                <Text style={[styles.customer, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {sale.customerName || 'Walk-in customer'}
                </Text>
              </View>
              <Text style={[styles.balance, { color: colors.destructive }]}>
                {formatMoney(sale.balance, currency)}
              </Text>
            </View>
            <View style={[styles.invoiceMeta, { borderTopColor: colors.border }]}>
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                Issued {formatDate(sale.createdAt)}
              </Text>
              <Text style={[styles.status, { color: colors.mutedForeground }]}>
                {formatStatus(sale.status)}
              </Text>
            </View>
          </View>
        ))
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
  focusCard: {
    borderWidth: 1,
    borderRadius: 17,
    padding: 17,
    marginBottom: 10,
  },
  focusLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  focusValue: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -1,
    marginTop: 8,
  },
  focusFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 17,
  },
  focusMeta: {
    fontSize: 12,
  },
  metrics: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  invoiceCard: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 14,
    marginBottom: 10,
  },
  invoiceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  invoiceIcon: {
    width: 35,
    height: 35,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoiceCopy: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: '700',
  },
  customer: {
    fontSize: 11,
    marginTop: 3,
  },
  balance: {
    fontSize: 14,
    fontWeight: '700',
  },
  invoiceMeta: {
    borderTopWidth: 1,
    marginTop: 13,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 10,
  },
  status: {
    fontSize: 10,
    textTransform: 'capitalize',
  },
});