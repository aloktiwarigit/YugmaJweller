import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { RateWidget } from '@goldsmith/ui-mobile';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { usePublicRates } from '../../src/hooks/usePublicRates';

export default function InventoryListScreen(): React.ReactElement {
  const { data: rates, isLoading } = usePublicRates();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
    >
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

      {/* Placeholder — full inventory list implemented in future story */}
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>उत्पाद सूची जल्द आ रही है</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background ?? colors.bg ?? '#F5EDDD' },
  container: { paddingBottom: spacing.xxl ?? 48 },
  rateHeader: {
    backgroundColor: colors.white ?? '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border ?? '#E5E7EB',
  },
  placeholder: {
    padding: spacing.xl ?? 32,
    alignItems: 'center',
  },
  placeholderText: {
    fontFamily: typography.body.family,
    fontSize: 16,
    color: colors.textSecondary ?? '#6B7280',
  },
});
