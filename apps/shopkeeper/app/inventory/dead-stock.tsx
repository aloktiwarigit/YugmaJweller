import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { Stack } from 'expo-router';
import { colors, spacing, typography, radii } from '@goldsmith/ui-tokens';
import { api } from '../../src/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeadStockProduct {
  id: string;
  sku: string;
  metal: string;
  purity: string;
  weightG: string;
  status: string;
  firstListedAt: string; // ISO string from JSON
  daysInStock: number;
  estimatedValueFormatted?: string;
  suggestedAction: 'DISCOUNT' | 'KARIGAR' | 'REPURPOSE';
}

// ---------------------------------------------------------------------------
// Chip configuration
// ---------------------------------------------------------------------------

interface ActionChipConfig {
  label: string;
  bg: string;
  text: string;
  border: string;
}

const ACTION_CHIP: Record<DeadStockProduct['suggestedAction'], ActionChipConfig> = {
  DISCOUNT: {
    label: 'छूट दें',
    bg: '#FFF8E1',
    text: '#F57F17',
    border: '#FFD54F',
  },
  KARIGAR: {
    label: 'कारीगर',
    bg: '#E3F2FD',
    text: '#1565C0',
    border: '#90CAF9',
  },
  REPURPOSE: {
    label: 'पुनः उपयोग',
    bg: '#F5F5F5',
    text: '#616161',
    border: '#BDBDBD',
  },
};

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState(): React.ReactElement {
  return (
    <View style={styles.emptyContainer} accessible accessibilityLiveRegion="polite">
      <Text style={styles.emptyIcon}>✓</Text>
      <Text style={styles.emptyText}>कोई पुराना स्टॉक नहीं — बढ़िया!</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

function DeadStockRow({ item }: { item: DeadStockProduct }): React.ReactElement {
  const chip = ACTION_CHIP[item.suggestedAction];
  const weightDisplay = `${parseFloat(item.weightG).toFixed(2)}g`;
  const daysDisplay = `${item.daysInStock} दिन`;
  const valueDisplay = item.estimatedValueFormatted ?? '—';

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${item.sku}, ${daysDisplay} से स्टॉक में, ${weightDisplay}`}
    >
      {/* Left: SKU + meta */}
      <View style={styles.rowLeft}>
        <Text style={styles.sku} numberOfLines={1}>
          {item.sku}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {daysDisplay} · {weightDisplay}
        </Text>
        <Text style={styles.value} numberOfLines={1} accessibilityLabel={`अनुमानित मूल्य: ${valueDisplay}`}>
          {valueDisplay}
        </Text>
      </View>

      {/* Right: suggestedAction chip */}
      <View
        style={[styles.chip, { backgroundColor: chip.bg, borderColor: chip.border }]}
        accessibilityLabel={`सुझाव: ${chip.label}`}
      >
        <Text style={[styles.chipText, { color: chip.text }]}>{chip.label}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function DeadStockScreen(): React.ReactElement {
  const [items, setItems] = useState<DeadStockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback((): void => {
    setLoading(true);
    setError(false);

    void api
      .get<DeadStockProduct[]>('/api/v1/inventory/dead-stock')
      .then((res) => {
        // Sort by daysInStock DESC — oldest first (most problematic)
        const sorted = [...res.data].sort((a, b) => b.daysInStock - a.daysInStock);
        setItems(sorted);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  // Fetch on mount
  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'पुराना स्टॉक',
          headerStyle: { backgroundColor: '#5D4037' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontFamily: typography.body.family,
            fontWeight: '700',
            fontSize: 18,
          },
        }}
      />

      {loading && (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="लोड हो रहा है" />
        </View>
      )}

      {!loading && error && (
        <View style={styles.centeredContainer}>
          <Text style={styles.errorText}>डेटा लोड नहीं हो सका</Text>
          <Pressable
            style={styles.retryBtn}
            onPress={fetchData}
            accessibilityRole="button"
            accessibilityLabel="पुनः प्रयास करें"
          >
            <Text style={styles.retryBtnText}>पुनः प्रयास करें</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && items.length === 0 && <EmptyState />}

      {!loading && !error && items.length > 0 && (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <DeadStockRow item={item} />}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FDF6EC',
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg ?? 24,
  },
  listContent: {
    paddingBottom: spacing.xl ?? 32,
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg ?? 24,
    gap: spacing.sm ?? 8,
  },
  emptyIcon: {
    fontSize: 48,
    color: '#2E7D32',
  },
  emptyText: {
    fontFamily: typography.body.family,
    fontSize: 18,
    color: '#2E7D32',
    textAlign: 'center',
  },
  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm ?? 12,
    backgroundColor: '#FFFFFF',
  },
  rowLeft: {
    flex: 1,
    gap: 4,
    marginRight: spacing.sm ?? 8,
  },
  sku: {
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  meta: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: colors.textSecondary,
  },
  value: {
    fontFamily: typography.body.family,
    fontSize: 13,
    color: '#5D4037',
  },
  chip: {
    borderWidth: 1,
    borderRadius: radii.md ?? 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
  chipText: {
    fontFamily: 'NotoSansDevanagari_400Regular',
    fontSize: 13,
    fontWeight: '600',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.md,
  },
  // Error state
  errorText: {
    fontFamily: typography.body.family,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  retryBtn: {
    minHeight: 48,
    paddingHorizontal: spacing.lg ?? 24,
    paddingVertical: 12,
    backgroundColor: '#5D4037',
    borderRadius: radii.md ?? 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: {
    fontFamily: typography.body.family,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
