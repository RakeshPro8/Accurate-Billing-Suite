import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/BusinessUI';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useMobileOffline } from '@/context/MobileOfflineContext';

export function OfflineBanner() {
  const colors = useColors();
  const { isOnline, isStale, outbox, sync } = useMobileOffline();
  const hasWork = outbox.some((item) => item.status !== 'completed');
  return (
    <View style={[styles.wrap, { backgroundColor: isOnline ? colors.secondary : colors.accent, borderColor: colors.border }]}>
      <Feather name={isOnline ? 'wifi' : 'wifi-off'} size={14} color={isOnline ? colors.primary : colors.destructive} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {isOnline ? (isStale ? 'LAST SAFE SNAPSHOT' : 'LIVE DATA') : 'OFFLINE MODE'}
        </Text>
        <Text style={[styles.caption, { color: colors.mutedForeground }]}>
          {isOnline
            ? (hasWork ? `${outbox.filter((item) => item.status !== 'completed').length} action${outbox.filter((item) => item.status !== 'completed').length === 1 ? '' : 's'} waiting to sync` : 'Changes are protected by your store scope.')
            : 'Reads are cached. New actions queue safely for reconnect.'}
        </Text>
      </View>
      {isOnline && hasWork ? (
        <Pressable testID="sync-now" accessibilityRole="button" onPress={() => void sync()} hitSlop={8}>
          <Text style={[styles.action, { color: colors.primary }]}>SYNC</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 54, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14 },
  copy: { flex: 1 },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  caption: { fontSize: 11, marginTop: 2 },
  action: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
});