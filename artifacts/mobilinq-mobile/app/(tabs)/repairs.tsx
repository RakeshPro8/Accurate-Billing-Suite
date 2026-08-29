import React, { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import {
  getGetInventorySummaryQueryKey,
  getGetRepairsQueryKey,
  getSearchOperationProductsQueryKey,
  useGetAuthSession,
  useGetInventorySummary,
  useGetRepairs,
  useSearchOperationProducts,
  useUpdateRepairStatus,
} from '@workspace/api-client-react';
import type {
  Repair,
  RepairStatusChangeStatus,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { InventoryHealth, getInventoryItems } from '@/components/InventoryHealth';
import { getTopInset } from '@/components/BusinessUI';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const nextStatus: Partial<Record<string, RepairStatusChangeStatus>> = {
  intake: 'diagnostic',
  diagnostic: 'in_progress',
  waiting_parts: 'in_progress',
  in_progress: 'ready_qa',
  ready_qa: 'completed',
  completed: 'picked_up',
};

type Feedback = {
  tone: 'success' | 'error';
  message: string;
};

type StatusAttempt = {
  repair: Repair;
  status: RepairStatusChangeStatus;
};

export default function RepairsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topInset = getTopInset(insets.top);
  const queryClient = useQueryClient();
  const session = useGetAuthSession();
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
  const update = useUpdateRepairStatus();
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [actionRepairId, setActionRepairId] = useState<number | null>(null);
  const [lastAttempt, setLastAttempt] = useState<StatusAttempt | null>(null);
  const [search, setSearch] = useState('');
  const productParams = useMemo(
    () => (search.trim().length > 1 ? { q: search.trim() } : undefined),
    [search],
  );
  const productSearch = useSearchOperationProducts(productParams, {
    query: {
      queryKey: getSearchOperationProductsQueryKey(productParams),
      enabled: !!productParams,
    },
  });
  const inventoryItems = useMemo(
    () => getInventoryItems(inventory.data),
    [inventory.data],
  );
  const queue = useMemo(
    () =>
      [...(repairs.data ?? [])].sort(
        (a, b) => repairRiskScore(b) - repairRiskScore(a),
      ),
    [repairs.data],
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([repairs.refetch(), inventory.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const runStatusChange = (repair: Repair, status = nextStatus[repair.status]) => {
    if (!status) return;
    setActionRepairId(repair.id);
    setLastAttempt({ repair, status });
    setFeedback(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    update.mutate(
      { id: repair.id, data: { status, notify: false } },
      {
        onSuccess: (updatedRepair) => {
          queryClient.setQueryData<Repair[]>(
            repairs.queryKey,
            (current) =>
              current?.map((item) =>
                item.id === updatedRepair.id ? updatedRepair : item,
              ) ?? current,
          );
          setActionRepairId(null);
          setFeedback({
            tone: 'success',
            message: `${repair.ticketNumber} moved to ${status}.`,
          });
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onError: (error: unknown) => {
          setActionRepairId(null);
          const isConflict =
            typeof error === 'object' &&
            error !== null &&
            ('status' in error
              ? (error as { status?: number }).status === 409
              : 'response' in error &&
                (error as { response?: { status?: number } }).response?.status === 409);
          setFeedback({
            tone: 'error',
            message: isConflict
              ? 'This repair changed on another device. Refresh before trying again.'
              : 'Status did not save. Check the connection and try again.',
          });
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      },
    );
  };

  if (session.isLoading || repairs.isLoading || inventory.isLoading) {
    return <RepairsSkeleton colors={colors} topInset={topInset} />;
  }

  if (!session.data?.authenticated) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, paddingTop: topInset },
        ]}
      >
        <View style={[styles.errorIcon, { backgroundColor: colors.accent }]}>
          <Feather name="lock" size={20} color={colors.primary} />
        </View>
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>
          Sign in to see repairs
        </Text>
        <Text style={[styles.errorCopy, { color: colors.mutedForeground }]}>
          Choose Home to sign in with your employee PIN.
        </Text>
      </View>
    );
  }

  if (repairs.isError) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, paddingTop: topInset },
        ]}
      >
        <View style={[styles.errorIcon, { backgroundColor: colors.accent }]}>
          <Feather name="wifi-off" size={20} color={colors.destructive} />
        </View>
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>
          Queue unavailable
        </Text>
        <Text style={[styles.errorCopy, { color: colors.mutedForeground }]}>
          The repair floor could not reach the server.
        </Text>
        <Pressable
          testID="retry-repairs"
          accessibilityRole="button"
          onPress={() => void repairs.refetch()}
          style={[styles.retryButton, { borderColor: colors.primary }]}
        >
          <Text style={[styles.retryText, { color: colors.primary }]}>TRY AGAIN</Text>
        </Pressable>
      </View>
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
        { paddingTop: topInset + 20, backgroundColor: colors.background },
      ]}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.kicker, { color: colors.primary }]}>
            REPAIR FLOOR / LIVE
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Make the next move.
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Safe actions for the device in your hand.
          </Text>
        </View>
        <View style={[styles.liveMark, { backgroundColor: colors.primary }]}>
          <Feather name="radio" size={15} color={colors.primaryForeground} />
        </View>
      </View>

      {!!feedback && (
        <View
          style={[
            styles.feedback,
            {
              backgroundColor:
                feedback.tone === 'error' ? colors.accent : colors.secondary,
              borderColor:
                feedback.tone === 'error' ? colors.destructive : colors.primary,
            },
          ]}
        >
          <Feather
            name={feedback.tone === 'error' ? 'alert-circle' : 'check-circle'}
            size={16}
            color={feedback.tone === 'error' ? colors.destructive : colors.primary}
          />
          <Text style={[styles.feedbackText, { color: colors.foreground }]}>
            {feedback.message}
          </Text>
          {feedback.tone === 'error' && lastAttempt ? (
            <Pressable
              testID="retry-status"
              accessibilityRole="button"
              onPress={() => runStatusChange(lastAttempt.repair, lastAttempt.status)}
              hitSlop={8}
            >
              <Text style={[styles.retryText, { color: colors.primary }]}>RETRY</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <View style={styles.metrics}>
        <QueueMetric
          label="OPEN"
          value={String(queue.filter((repair) => isOpen(repair.status)).length)}
          icon="inbox"
          colors={colors}
        />
        <QueueMetric
          label="AT RISK"
          value={String(queue.filter((repair) => getSlaMeta(repair).risk).length)}
          icon="alert-triangle"
          colors={colors}
        />
        <QueueMetric
          label="PARTS HOLD"
          value={String(queue.filter((repair) => repair.status === 'waiting_parts').length)}
          icon="package"
          colors={colors}
        />
      </View>

      <InventoryHealth
        items={inventoryItems}
        searchValue={search}
        onSearchChange={setSearch}
        searchResults={productSearch.data ?? []}
        searchLoading={productSearch.isLoading}
      />

      <View style={styles.queueHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Repair queue
          </Text>
          <Text style={[styles.sectionCaption, { color: colors.mutedForeground }]}>
            Highest risk appears first
          </Text>
        </View>
        <Text style={[styles.count, { color: colors.primary }]}>
          {queue.length} {queue.length === 1 ? 'ticket' : 'tickets'}
        </Text>
      </View>

      {queue.length === 0 ? (
        <View
          style={[
            styles.empty,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}>
            <Feather name="check" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Queue is clear
          </Text>
          <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>
            New repair tickets will show here as soon as they arrive.
          </Text>
        </View>
      ) : (
        queue.map((repair) => (
          <RepairCard
            key={repair.id}
            repair={repair}
            colors={colors}
            isUpdating={actionRepairId === repair.id}
            onAdvance={() => runStatusChange(repair)}
          />
        ))
      )}
    </ScrollView>
  );
}

function RepairCard({
  repair,
  colors,
  isUpdating,
  onAdvance,
}: {
  repair: Repair;
  colors: ReturnType<typeof useColors>;
  isUpdating: boolean;
  onAdvance: () => void;
}) {
  const sla = getSlaMeta(repair);
  const status = formatStatus(repair.status);
  const partNames = repair.parts?.map((part) => part.name).slice(0, 2).join(', ');
  const context =
    repair.status === 'waiting_parts'
      ? partNames || 'Parts hold — check stock'
      : repair.technicianName || 'Unassigned technician';

  return (
    <View
      style={[
        styles.repairCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={styles.ticketBlock}>
          <View style={[styles.repairIcon, { backgroundColor: colors.accent }]}>
            <Feather name="smartphone" size={17} color={colors.primary} />
          </View>
          <View style={styles.ticketCopy}>
            <Text style={[styles.ticket, { color: colors.foreground }]}>
              {repair.ticketNumber}
            </Text>
            <Text style={[styles.device, { color: colors.mutedForeground }]} numberOfLines={1}>
              {[repair.deviceBrand, repair.deviceModel].filter(Boolean).join(' ') ||
                repair.deviceType}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.priority,
            {
              backgroundColor:
                repair.priority === 'urgent' || repair.priority === 'high'
                  ? colors.accent
                  : colors.secondary,
            },
          ]}
        >
          <Text
            style={[
              styles.priorityText,
              {
                color:
                  repair.priority === 'urgent' ? colors.destructive : colors.primary,
              },
            ]}
          >
            {repair.priority.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={[styles.detailRow, { borderTopColor: colors.border }]}>
        <Text style={[styles.customer, { color: colors.foreground }]} numberOfLines={1}>
          {repair.customerName || 'Walk-in customer'}
        </Text>
        <View style={styles.statusWrap}>
          <View style={[styles.statusDot, { backgroundColor: sla.risk ? colors.destructive : colors.primary }]} />
          <Text style={[styles.status, { color: colors.mutedForeground }]}>{status}</Text>
        </View>
      </View>

      <View style={styles.contextRow}>
        <Feather
          name={repair.status === 'waiting_parts' ? 'package' : 'user'}
          size={13}
          color={colors.mutedForeground}
        />
        <Text style={[styles.context, { color: colors.mutedForeground }]} numberOfLines={1}>
          {repair.status === 'waiting_parts' ? 'Waiting parts · ' : 'Technician · '}
          {context}
        </Text>
      </View>

      <View style={styles.slaRow}>
        <Feather name="clock" size={13} color={sla.risk ? colors.destructive : colors.primary} />
        <Text style={[styles.slaLabel, { color: sla.risk ? colors.destructive : colors.primary }]}>
          {sla.label}
        </Text>
        <Text style={[styles.slaDate, { color: colors.mutedForeground }]}>
          {sla.date}
        </Text>
      </View>

      {nextStatus[repair.status] ? (
        <Pressable
          testID={`repair-${repair.id}-advance`}
          accessibilityRole="button"
          accessibilityLabel={`Move ${repair.ticketNumber} to ${nextStatus[repair.status]}`}
          disabled={isUpdating}
          onPress={onAdvance}
          style={[
            styles.advance,
            {
              backgroundColor: isUpdating ? colors.secondary : colors.primary,
              opacity: isUpdating ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.advanceText, { color: colors.primaryForeground }]}>
            {isUpdating
              ? 'SAVING…'
              : `MOVE TO ${formatStatus(nextStatus[repair.status] ?? '')}`}
          </Text>
          <Feather name="arrow-right" size={15} color={colors.primaryForeground} />
        </Pressable>
      ) : null}
    </View>
  );
}

function QueueMetric({
  label,
  value,
  icon,
  colors,
}: {
  label: string;
  value: string;
  icon: keyof typeof Feather.glyphMap;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.metric, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name={icon} size={15} color={colors.primary} />
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function RepairsSkeleton({
  colors,
  topInset,
}: {
  colors: ReturnType<typeof useColors>;
  topInset: number;
}) {
  return (
    <View style={[styles.skeletonScreen, { backgroundColor: colors.background, paddingTop: topInset + 20 }]}>
      <View style={[styles.skeletonLine, styles.skeletonKicker, { backgroundColor: colors.muted }]} />
      <View style={[styles.skeletonLine, styles.skeletonTitle, { backgroundColor: colors.muted }]} />
      <View style={[styles.skeletonPanel, { backgroundColor: colors.card, borderColor: colors.border }]} />
      <View style={[styles.skeletonPanel, { backgroundColor: colors.card, borderColor: colors.border }]} />
      <View style={[styles.skeletonPanel, { backgroundColor: colors.card, borderColor: colors.border }]} />
    </View>
  );
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ');
}

function isOpen(status: string) {
  return !['picked_up', 'cancelled'].includes(status);
}

function repairRiskScore(repair: Repair) {
  const priority = { urgent: 4, high: 3, normal: 2, low: 1 }[repair.priority] ?? 0;
  return priority * 10 + (getSlaMeta(repair).risk ? 5 : 0);
}

function getSlaMeta(repair: Repair) {
  if (!isOpen(repair.status)) {
    return { label: 'CLOSED', date: formatStatus(repair.status), risk: false };
  }
  const extra = repair as Repair & Record<string, unknown>;
  const explicitDue = extra.dueAt ?? extra.dueDate ?? extra.slaDueAt;
  const dueDate = typeof explicitDue === 'string' ? new Date(explicitDue) : null;
  const createdAt = new Date(repair.createdAt);
  const targetDays =
    repair.priority === 'urgent'
      ? 1
      : repair.priority === 'high'
        ? 2
        : repair.priority === 'low'
          ? 7
          : 4;
  const fallbackDue = new Date(createdAt.getTime() + targetDays * 24 * 60 * 60 * 1000);
  const due = dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : fallbackDue;
  const remaining = due.getTime() - Date.now();
  const risk = remaining <= 24 * 60 * 60 * 1000;
  const date = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return {
    label: remaining < 0 ? 'OVERDUE' : risk ? 'DUE SOON' : 'SLA DUE',
    date,
    risk,
  };
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 1.7,
    fontWeight: '700',
  },
  title: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '700',
    letterSpacing: -0.8,
    marginTop: 6,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 5,
  },
  liveMark: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedback: {
    borderWidth: 1,
    borderRadius: 11,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedbackText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  retryText: {
    fontSize: 10,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  metrics: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  metric: {
    flex: 1,
    minHeight: 78,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 7,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 1,
  },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionCaption: {
    fontSize: 11,
    marginTop: 3,
  },
  count: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  repairCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 15,
    marginBottom: 11,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  ticketBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  repairIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketCopy: {
    flex: 1,
  },
  ticket: {
    fontSize: 15,
    fontWeight: '700',
  },
  device: {
    fontSize: 11,
    marginTop: 3,
  },
  priority: {
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 5,
    marginLeft: 8,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  detailRow: {
    borderTopWidth: 1,
    marginTop: 13,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  customer: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  statusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  status: {
    fontSize: 10,
    textTransform: 'capitalize',
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  context: {
    flex: 1,
    fontSize: 11,
  },
  slaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 9,
  },
  slaLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  slaDate: {
    fontSize: 10,
  },
  advance: {
    minHeight: 40,
    borderRadius: 9,
    marginTop: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  advanceText: {
    fontSize: 10,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  empty: {
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingVertical: 30,
  },
  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyCopy: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 5,
  },
  errorIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  errorCopy: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
  retryButton: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginTop: 18,
  },
  skeletonScreen: {
    flex: 1,
    paddingHorizontal: 18,
  },
  skeletonLine: {
    borderRadius: 7,
  },
  skeletonKicker: {
    width: 128,
    height: 10,
  },
  skeletonTitle: {
    width: '72%',
    height: 30,
    marginTop: 10,
    marginBottom: 20,
  },
  skeletonPanel: {
    height: 140,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
});