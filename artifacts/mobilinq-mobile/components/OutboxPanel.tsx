import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/BusinessUI';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { discardMobileOperation, retryMobileOperation } from '@/lib/mobile-offline';
import { useMobileOffline } from '@/context/MobileOfflineContext';

export function OutboxPanel() {
  const colors = useColors();
  const { outbox, refreshOutbox, sync } = useMobileOffline();
  const visible = outbox.filter((item) => item.status !== 'completed');
  if (!visible.length) return null;
  return (
    <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Feather name="upload-cloud" size={16} color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground }]}>Pending actions</Text>
        </View>
        <Text style={[styles.count, { color: colors.primary }]}>{visible.length}</Text>
      </View>
      {visible.slice(0, 4).map((item) => {
        const conflict = item.status === 'conflict';
        return (
          <View key={item.operationId} style={[styles.item, { borderTopColor: colors.border }]}>
            <View style={styles.itemCopy}>
              <Text style={[styles.actionName, { color: colors.foreground }]}>{item.action.replace('_', ' ')}</Text>
              <Text style={[styles.status, { color: conflict ? colors.destructive : colors.mutedForeground }]}>
                {conflict ? 'Needs review · ' : ''}{item.lastError ?? item.status}
              </Text>
            </View>
            {item.status === 'error' || conflict ? (
              <View style={styles.buttons}>
                <Pressable testID={`retry-${item.operationId}`} accessibilityRole="button" onPress={() => void retryMobileOperation(item.operationId).then(() => sync())} hitSlop={8}>
                  <Feather name="refresh-cw" size={17} color={colors.primary} />
                </Pressable>
                <Pressable testID={`discard-${item.operationId}`} accessibilityRole="button" onPress={() => void discardMobileOperation(item.operationId).then(refreshOutbox)} hitSlop={8}>
                  <Feather name="trash-2" size={17} color={colors.destructive} />
                </Pressable>
              </View>
            ) : <Feather name="clock" size={16} color={colors.mutedForeground} />}
          </View>
        );
      })}
      {visible.length > 4 ? <Text style={[styles.more, { color: colors.mutedForeground }]}>Showing the first 4 actions. Sync resolves the rest in batches.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 14, fontWeight: '700' },
  count: { fontSize: 16, fontWeight: '700' },
  item: { borderTopWidth: 1, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemCopy: { flex: 1 },
  actionName: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  status: { fontSize: 11, marginTop: 3 },
  buttons: { flexDirection: 'row', gap: 16 },
  more: { fontSize: 11, lineHeight: 16 },
});