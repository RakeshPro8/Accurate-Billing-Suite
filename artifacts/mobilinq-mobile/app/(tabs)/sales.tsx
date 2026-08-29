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

export default function SalesScreen() {
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
  const items = useMemo(() => sales.data?.items ?? [], [sales.data?.items]);
  const currency = settings.data?.currency ?? 'USD';

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
        title="Sales unavailable"
        message="Recent invoices could not be loaded."
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
        eyebrow="MOBILINQ / SALES"
        title="Recent invoices."
        subtitle="Know what closed and what still needs a payment."
        icon="credit-card"
        colors={colors}
      />
      <View style={styles.metrics}>
        <MetricCard
          label="INVOICES"
          value={String(sales.data?.summary.count ?? items.length)}
          icon="file-text"
          colors={colors}
        />
        <MetricCard
          label="OUTSTANDING"
          value={formatMoney(sales.data?.summary.outstanding, currency)}
          icon="clock"
          colors={colors}
        />
      </View>
      <View style={styles.metrics}>
        <MetricCard
          label="SALES TOTAL"
          value={formatMoney(sales.data?.summary.total, currency)}
          icon="trending-up"
          colors={colors}
        />
        <MetricCard
          label="SHOWING"
          value={String(items.length)}
          detail="recent"
          icon="list"
          colors={colors}
        />
      </View>

      <SectionHeading title="Recent invoices" caption="Latest server records" colors={colors} />
      {items.length === 0 ? (
        <EmptyState
          icon="file-text"
          title="No invoices yet"
          message="Completed sales will appear here."
          colors={colors}
        />
      ) : (
        items.map((sale) => {
          const balance = Number(sale.balance ?? 0);
          const isPaid = balance <= 0 || !!sale.paidAt || sale.status === 'paid';
          return (
            <View
              key={sale.id}
              style={[styles.saleCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.saleTop}>
                <View style={styles.saleIcon}>
                  <Feather name="file-text" size={16} color={colors.primary} />
                </View>
                <View style={styles.saleCopy}>
                  <Text style={[styles.invoice, { color: colors.foreground }]}>
                    {sale.invoiceNumber}
                  </Text>
                  <Text style={[styles.customer, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {sale.customerName || 'Walk-in customer'}
                  </Text>
                </View>
                <Text style={[styles.total, { color: colors.foreground }]}>
                  {formatMoney(sale.total, currency)}
                </Text>
              </View>
              <View style={[styles.saleMeta, { borderTopColor: colors.border }]}>
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {formatDate(sale.createdAt)}
                </Text>
                <View style={styles.paymentState}>
                  <View style={[styles.dot, { backgroundColor: isPaid ? colors.primary : colors.destructive }]} />
                  <Text style={[styles.metaText, { color: isPaid ? colors.primary : colors.destructive }]}>
                    {isPaid ? 'PAID' : `${formatMoney(balance, currency)} DUE`}
                  </Text>
                </View>
                <Text style={[styles.status, { color: colors.mutedForeground }]}>
                  {formatStatus(sale.status)}
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
    marginBottom: 10,
  },
  saleCard: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 14,
    marginBottom: 10,
  },
  saleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  saleIcon: {
    width: 35,
    height: 35,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saleCopy: {
    flex: 1,
  },
  invoice: {
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
  saleMeta: {
    borderTopWidth: 1,
    marginTop: 13,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaText: {
    fontSize: 10,
  },
  paymentState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  status: {
    fontSize: 10,
    textTransform: 'capitalize',
  },
});