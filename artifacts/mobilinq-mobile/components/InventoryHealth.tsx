import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { LocalizedText as Text } from '@/components/BusinessUI';
import { Feather } from '@expo/vector-icons';
import type { Product } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

export type InventoryRecord = Product & {
  lowStock?: boolean;
  reorderPoint?: number;
  active?: boolean;
};

type InventoryHealthProps = {
  items: InventoryRecord[];
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchResults?: Product[];
  searchLoading?: boolean;
};

export function getInventoryItems(data: unknown): InventoryRecord[] {
  if (!data || typeof data !== 'object') return [];
  const items = (data as { items?: unknown }).items;
  return Array.isArray(items) ? (items as InventoryRecord[]) : [];
}

export function InventoryHealth({
  items,
  searchValue,
  onSearchChange,
  searchResults = [],
  searchLoading = false,
}: InventoryHealthProps) {
  const colors = useColors();
  const activeItems = items.filter((item) => item.active !== false);
  const outOfStock = activeItems.filter((item) => item.stock <= 0);
  const lowStock = activeItems.filter(
    (item) =>
      item.stock > 0 &&
      (item.lowStock === true ||
        (typeof item.reorderPoint === 'number' && item.stock <= item.reorderPoint)),
  );
  const hasSearch = typeof searchValue === 'string' && onSearchChange;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <View style={[styles.icon, { backgroundColor: colors.accent }]}>
            <Feather name="package" size={16} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Inventory health
            </Text>
            <Text style={[styles.caption, { color: colors.mutedForeground }]}>
              Current store stock
            </Text>
          </View>
        </View>
        <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
      </View>

      <View style={[styles.stats, { borderTopColor: colors.border }]}>
        <InventoryStat label="LOW" value={String(lowStock.length)} colors={colors} />
        <InventoryStat label="OUT" value={String(outOfStock.length)} colors={colors} />
        <InventoryStat label="SKUs" value={String(activeItems.length)} colors={colors} />
      </View>

      {hasSearch ? (
        <View style={styles.lookup}>
          <View
            style={[
              styles.searchBox,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <Feather name="search" size={15} color={colors.mutedForeground} />
            <TextInput
              testID="inventory-search"
              value={searchValue}
              onChangeText={onSearchChange}
              placeholder="Find a part or SKU"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              returnKeyType="search"
              style={[styles.searchInput, { color: colors.foreground }]}
            />
            {!!searchValue && (
              <Pressable
                testID="clear-inventory-search"
                accessibilityRole="button"
                accessibilityLabel="Clear inventory search"
                onPress={() => onSearchChange('')}
                hitSlop={10}
              >
                <Feather name="x-circle" size={16} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
          {!!searchValue && searchValue.trim().length > 1 ? (
            <View style={[styles.results, { borderColor: colors.border }]}>
              {searchLoading ? (
                <Text style={[styles.resultMessage, { color: colors.mutedForeground }]}>
                  Looking up stock…
                </Text>
              ) : searchResults.length > 0 ? (
                searchResults.slice(0, 4).map((product) => (
                  <View
                    key={product.id}
                    style={[styles.resultRow, { borderBottomColor: colors.border }]}
                  >
                    <View style={styles.resultCopy}>
                      <Text
                        numberOfLines={1}
                        style={[styles.resultName, { color: colors.foreground }]}
                      >
                        {product.name}
                      </Text>
                      <Text style={[styles.resultSku, { color: colors.mutedForeground }]}>
                        {product.sku} · {product.stock} {product.unit ?? 'units'}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.resultStock,
                        { color: product.stock <= 0 ? colors.destructive : colors.primary },
                      ]}
                    >
                      {product.stock <= 0 ? 'OUT' : 'READY'}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.resultMessage, { color: colors.mutedForeground }]}>
                  No active products found.
                </Text>
              )}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function InventoryStat({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  caption: {
    fontSize: 11,
    marginTop: 2,
  },
  stats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    marginTop: 15,
    paddingTop: 14,
  },
  stat: {
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  lookup: {
    marginTop: 15,
  },
  searchBox: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 8,
  },
  results: {
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 6,
    overflow: 'hidden',
  },
  resultRow: {
    minHeight: 47,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultCopy: {
    flex: 1,
  },
  resultName: {
    fontSize: 12,
    fontWeight: '600',
  },
  resultSku: {
    fontSize: 10,
    marginTop: 2,
  },
  resultStock: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  resultMessage: {
    fontSize: 12,
    padding: 12,
  },
});