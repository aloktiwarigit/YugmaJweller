import React from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { RateWidget } from '@goldsmith/ui-mobile';
import { colors, spacing } from '@goldsmith/ui-tokens';
import { usePublicRates } from '../../src/hooks/usePublicRates';
import { InventorySearch } from '../../src/features/inventory/components/InventorySearch';

export default function InventoryListScreen(): React.ReactElement {
  const { data: rates, isLoading } = usePublicRates();

  return (
    <View style={styles.screen}>
      {/* Live rate compact header — quick reference while browsing inventory */}
      <View style={styles.rateHeader}>
        <RateWidget
          variant="compact"
          rates={rates ?? null}
          loading={isLoading}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPress={() => router.push('/rates/history' as any)}
        />
      </View>

      {/* Inventory search + results */}
      <View style={styles.searchContainer}>
        <InventorySearch />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  rateHeader: {
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  searchContainer: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
});
