import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  getGetDashboardSummaryQueryKey,
  getGetInventorySummaryQueryKey,
  getGetRepairsQueryKey,
  getGetSettingsQueryKey,
  useGetAuthSession,
  useGetDashboardSummary,
  useGetInventorySummary,
  useGetRepairs,
  useGetSettings,
} from '@workspace/api-client-react';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  EmptyState,
  ErrorState,
  formatMoney,
  MetricCard,
  ScreenHeader,
  ScreenSkeleton,
  SectionHeading,
  SignalRow,
  SignedOutState,
  getTopInset,
} from '@/components/BusinessUI';
import { getInventoryItems } from '@/components/InventoryHealth';

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topInset = getTopInset(insets.top);
  const session = useGetAuthSession();
  const dashboard = useGetDashboardSummary({
    query: {
      queryKey: getGetDashboardSummaryQueryKey(),
      enabled: !!session.data?.authenticated,
    },
  });
  const repairs = useGetRepairs(undefined, {
    query: {
      queryKey: getGetRepairsQueryKey(),
      enabled: !!session.data?.authenticated,
    },
  });
  const inventory = useGetInventorySummary({
    query: {
      queryKey: getGetInventorySummaryQueryKey(),
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
  const activeRepairs = useMemo(
    () => (repairs.data ?? []).filter((repair) => !['picked_up', 'cancelled'].includes(repair.status)),
    [repairs.data],
  );
  const inventoryItems = useMemo(() => getInventoryItems(inventory.data), [inventory.data]);
  const lowStock = inventoryItems.filter(
    (item) =>
      item.active !== false &&
      (item.stock <= 0 ||
        item.lowStock === true ||
        (typeof item.reorderPoint === 'number' && item.stock <= item.reorderPoint)),
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        dashboard.refetch(),
        repairs.refetch(),
        inventory.refetch(),
        settings.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  if (session.isLoading || dashboard.isLoading || repairs.isLoading || inventory.isLoading) {
    return <ScreenSkeleton colors={colors} topInset={topInset} />;
  }
  if (!session.data?.authenticated) {
    return <SignedOutState colors={colors} topInset={topInset} />;
  }
  if (dashboard.isError) {
    return (
      <ErrorState
        title="Dashboard unavailable"
        message="The business summary could not be loaded."
        onRetry={() => void dashboard.refetch()}
        colors={colors}
        topInset={topInset}
      />
    );
  }

  const summary = dashboard.data;
  const currency = settings.data?.currency ?? 'USD';

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
        eyebrow={settings.data?.businessName?.toUpperCase() ?? 'MOBILINQ / OVERVIEW'}
        title="Business pulse."
        subtitle="The signals worth acting on this shift."
        icon="bar-chart-2"
        colors={colors}
      />

      <View style={[styles.revenueCard, { backgroundColor: colors.primary }]}>
        <View style={styles.revenueTop}>
          <View>
            <Text style={[styles.revenueEyebrow, { color: colors.primaryForeground }]}>
              REVENUE THIS MONTH
            </Text>
            <Text style={[styles.revenueValue, { color: colors.primaryForeground }]}>
              {formatMoney(summary?.totalRevenueMtd, currency)}
            </Text>
          </View>
          <Feather name="trending-up" size={19} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.revenueFoot, { color: colors.primaryForeground }]}>
          {formatMoney(summary?.revenueThisWeek, currency)} this week
        </Text>
      </View>

      <View style={styles.metrics}>
        <MetricCard
          label="SALES THIS MONTH"
          value={String(summary?.totalSalesMtd ?? 0)}
          icon="shopping-bag"
          colors={colors}
        />
        <MetricCard
          label="CUSTOMERS"
          value={String(summary?.totalCustomers ?? 0)}
          icon="users"
          colors={colors}
        />
      </View>
      <View style={styles.metrics}>
        <MetricCard
          label="PENDING INVOICES"
          value={String(summary?.pendingInvoices ?? 0)}
          icon="file-text"
          colors={colors}
        />
        <MetricCard
          label="OPEN QUOTES"
          value={String(summary?.openQuotations ?? 0)}
          icon="message-square"
          colors={colors}
        />
      </View>

      <SectionHeading
        title="Action signals"
        caption="Live from repairs and inventory"
        colors={colors}
      />
      <View style={[styles.signalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SignalRow
          icon="tool"
          title="Active repairs"
          detail={activeRepairs.length ? 'Work orders still in motion' : 'No open work orders'}
          value={String(activeRepairs.length)}
          colors={colors}
        />
        <SignalRow
          icon="package"
          title="Stock needs attention"
          detail={lowStock.length ? 'Parts may need a reorder' : 'No low-stock products'}
          value={String(lowStock.length)}
          colors={colors}
        />
      </View>

      {activeRepairs.length === 0 && lowStock.length === 0 ? (
        <View style={styles.clearState}>
          <EmptyState
            icon="check-circle"
            title="Floor is in good shape"
            message="There are no active repair or inventory alerts right now."
            colors={colors}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingBottom: 120,
  },
  revenueCard: {
    borderRadius: 17,
    padding: 17,
    marginBottom: 10,
  },
  revenueTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  revenueEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    opacity: 0.8,
  },
  revenueValue: {
    fontSize: 31,
    fontWeight: '700',
    letterSpacing: -0.8,
    marginTop: 8,
  },
  revenueFoot: {
    fontSize: 12,
    marginTop: 20,
    opacity: 0.8,
  },
  metrics: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  signalCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 15,
    marginBottom: 16,
  },
  clearState: {
    marginTop: 0,
  },
});