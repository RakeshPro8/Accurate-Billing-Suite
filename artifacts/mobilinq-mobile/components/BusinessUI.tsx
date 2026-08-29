import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export type BusinessColors = ReturnType<typeof useColors>;

export function getTopInset(value: number) {
  return Platform.OS === 'web' ? Math.max(value, 67) : value;
}

export function formatStatus(value: string) {
  return value.replace(/_/g, ' ');
}

export function formatMoney(value: number | null | undefined, currency = 'USD') {
  const amount = Number(value ?? 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || 'USD'} ${amount.toFixed(2)}`;
  }
}

export function formatDate(value: string | null | undefined) {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  icon,
  colors,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  colors: BusinessColors;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {subtitle}
        </Text>
      </View>
      <View style={[styles.headerIcon, { backgroundColor: colors.primary }]}>
        <Feather name={icon} size={16} color={colors.primaryForeground} />
      </View>
    </View>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  icon,
  colors,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: keyof typeof Feather.glyphMap;
  colors: BusinessColors;
}) {
  return (
    <View style={[styles.metric, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.metricTop}>
        <Feather name={icon} size={15} color={colors.primary} />
        {detail ? (
          <Text style={[styles.metricDetail, { color: colors.mutedForeground }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

export function SectionHeading({
  title,
  caption,
  colors,
}: {
  title: string;
  caption?: string;
  colors: BusinessColors;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
        {caption ? (
          <Text style={[styles.sectionCaption, { color: colors.mutedForeground }]}>
            {caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function SignalRow({
  icon,
  title,
  detail,
  value,
  colors,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  detail: string;
  value: string;
  colors: BusinessColors;
}) {
  return (
    <View style={[styles.signalRow, { borderTopColor: colors.border }]}>
      <View style={[styles.signalIcon, { backgroundColor: colors.accent }]}>
        <Feather name={icon} size={15} color={colors.primary} />
      </View>
      <View style={styles.signalCopy}>
        <Text style={[styles.signalTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.signalDetail, { color: colors.mutedForeground }]} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Text style={[styles.signalValue, { color: colors.primary }]}>{value}</Text>
    </View>
  );
}

export function ScreenSkeleton({
  colors,
  topInset,
}: {
  colors: BusinessColors;
  topInset: number;
}) {
  return (
    <View style={[styles.skeletonScreen, { backgroundColor: colors.background, paddingTop: topInset + 20 }]}>
      <View style={[styles.skeletonKicker, { backgroundColor: colors.muted }]} />
      <View style={[styles.skeletonTitle, { backgroundColor: colors.muted }]} />
      <View style={[styles.skeletonLead, { backgroundColor: colors.card, borderColor: colors.border }]} />
      <View style={styles.skeletonMetrics}>
        <View style={[styles.skeletonMetric, { backgroundColor: colors.card, borderColor: colors.border }]} />
        <View style={[styles.skeletonMetric, { backgroundColor: colors.card, borderColor: colors.border }]} />
      </View>
      <View style={[styles.skeletonPanel, { backgroundColor: colors.card, borderColor: colors.border }]} />
    </View>
  );
}

export function ErrorState({
  title,
  message,
  onRetry,
  colors,
  topInset,
}: {
  title: string;
  message: string;
  onRetry: () => void;
  colors: BusinessColors;
  topInset: number;
}) {
  return (
    <View style={[styles.center, { backgroundColor: colors.background, paddingTop: topInset }]}>
      <View style={[styles.stateIcon, { backgroundColor: colors.accent }]}>
        <Feather name="wifi-off" size={20} color={colors.destructive} />
      </View>
      <Text style={[styles.stateTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.stateMessage, { color: colors.mutedForeground }]}>{message}</Text>
      <Pressable
        testID="retry-business-screen"
        accessibilityRole="button"
        onPress={onRetry}
        style={[styles.retry, { borderColor: colors.primary }]}
      >
        <Text style={[styles.retryText, { color: colors.primary }]}>TRY AGAIN</Text>
      </Pressable>
    </View>
  );
}

export function SignedOutState({
  colors,
  topInset,
}: {
  colors: BusinessColors;
  topInset: number;
}) {
  return (
    <View style={[styles.center, { backgroundColor: colors.background, paddingTop: topInset }]}>
      <View style={[styles.stateIcon, { backgroundColor: colors.accent }]}>
        <Feather name="lock" size={20} color={colors.primary} />
      </View>
      <Text style={[styles.stateTitle, { color: colors.foreground }]}>Sign in to continue</Text>
      <Text style={[styles.stateMessage, { color: colors.mutedForeground }]}>
        Choose Home to sign in with your employee PIN.
      </Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  colors,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  message: string;
  colors: BusinessColors;
}) {
  return (
    <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.stateIcon, { backgroundColor: colors.accent }]}>
        <Feather name={icon} size={19} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: colors.mutedForeground }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.7,
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
    lineHeight: 18,
    marginTop: 5,
  },
  headerIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 14,
  },
  metric: {
    flex: 1,
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
  },
  metricTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricDetail: {
    fontSize: 10,
  },
  metricValue: {
    fontSize: 23,
    fontWeight: '700',
    marginTop: 10,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
  sectionHeading: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionCaption: {
    fontSize: 11,
    marginTop: 3,
  },
  signalRow: {
    borderTopWidth: 1,
    minHeight: 62,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  signalIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signalCopy: {
    flex: 1,
  },
  signalTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  signalDetail: {
    fontSize: 11,
    marginTop: 2,
  },
  signalValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  stateIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateMessage: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
  },
  retry: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginTop: 18,
  },
  retryText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  empty: {
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyMessage: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 5,
  },
  skeletonScreen: {
    flex: 1,
    paddingHorizontal: 18,
  },
  skeletonKicker: {
    width: 130,
    height: 10,
    borderRadius: 6,
  },
  skeletonTitle: {
    width: '70%',
    height: 30,
    borderRadius: 7,
    marginTop: 10,
    marginBottom: 20,
  },
  skeletonLead: {
    height: 124,
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 10,
  },
  skeletonMetrics: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  skeletonMetric: {
    flex: 1,
    height: 98,
    borderWidth: 1,
    borderRadius: 14,
  },
  skeletonPanel: {
    height: 180,
    borderWidth: 1,
    borderRadius: 16,
  },
});