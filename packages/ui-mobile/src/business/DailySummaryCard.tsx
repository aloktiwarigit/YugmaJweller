import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';

export interface DailySummaryCardProps {
  label: string;
  count: number;
  weightG: string;
  value: string;
  metal?: 'GOLD' | 'SILVER' | null;
}

const BORDER_GOLD = '#FFD700';
const BORDER_SILVER = '#C0C0C0';
const BORDER_DEFAULT = colors.border ?? '#E5E7EB';

function borderColor(metal?: 'GOLD' | 'SILVER' | null): string {
  if (metal === 'GOLD') return BORDER_GOLD;
  if (metal === 'SILVER') return BORDER_SILVER;
  return BORDER_DEFAULT;
}

export function DailySummaryCard({
  label,
  count,
  weightG,
  value,
  metal,
}: DailySummaryCardProps): React.ReactElement {
  return (
    <View
      testID="daily-summary-card"
      style={[styles.card, { borderLeftColor: borderColor(metal) }]}
      accessibilityLabel={`${label}: ${count} नग, ${weightG}, ${value}`}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Text style={styles.meta}>{count} नग</Text>
        <Text style={styles.meta}>{weightG}</Text>
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white ?? '#FFFFFF',
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: spacing.md ?? 16,
    marginBottom: spacing.sm ?? 8,
    gap: spacing.xs ?? 4,
  },
  label: {
    fontFamily: typography.body.family,
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary ?? '#1C1917',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs ?? 4,
  },
  meta: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: colors.textSecondary ?? '#6B7280',
  },
  value: {
    fontFamily: typography.body.family,
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink ?? '#1C1917',
    marginTop: spacing.xs ?? 4,
  },
});
