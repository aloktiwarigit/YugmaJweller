import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors, spacing, typography, radii } from '@goldsmith/ui-tokens';
import { RateHistoryChart } from '@goldsmith/ui-mobile';
import type { RateHistoryPoint } from '@goldsmith/ui-mobile';
import { api } from '../../src/api/client';

type Range = '30d' | '90d' | '365d';

const RANGE_OPTIONS: { key: Range; label: string }[] = [
  { key: '30d', label: '30 दिन' },
  { key: '90d', label: '90 दिन' },
  { key: '365d', label: '365 दिन' },
];

const PURITY_OPTIONS = [
  { key: 'GOLD_22K', label: '22K' },
  { key: 'GOLD_24K', label: '24K' },
  { key: 'SILVER_999', label: 'चाँदी 999' },
] as const;

type PurityOption = (typeof PURITY_OPTIONS)[number]['key'];

export default function RateHistoryScreen(): React.ReactElement {
  const [range, setRange] = useState<Range>('30d');
  const [purity, setPurity] = useState<PurityOption>('GOLD_22K');

  const { data, isLoading } = useQuery<RateHistoryPoint[]>({
    queryKey: ['rates', 'history', range, purity],
    queryFn: async () => {
      const res = await api.get<RateHistoryPoint[]>(
        `/api/v1/rates/history?range=${range}&purity=${purity}`,
      );
      return res.data;
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Range selector */}
      <View style={styles.segmentRow} accessibilityRole="radiogroup">
        {RANGE_OPTIONS.map((opt) => {
          const active = range === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
              onPress={() => setRange(opt.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={opt.label}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Purity selector */}
      <View style={styles.segmentRow} accessibilityRole="radiogroup">
        {PURITY_OPTIONS.map((opt) => {
          const active = purity === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
              onPress={() => setPurity(opt.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={opt.label}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Chart */}
      <View style={styles.chartCard}>
        <RateHistoryChart
          data={data ?? []}
          purity={purity}
          range={range}
          loading={isLoading}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl ?? 32,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs ?? 4,
    marginBottom: spacing.sm ?? 8,
  },
  segmentBtn: {
    minHeight: 48,
    paddingHorizontal: spacing.sm ?? 8,
    paddingVertical: 12,
    borderRadius: radii.sm ?? 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  segmentText: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: colors.textPrimary,
  },
  segmentTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  chartCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md ?? 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginTop: spacing.sm ?? 8,
  },
});
