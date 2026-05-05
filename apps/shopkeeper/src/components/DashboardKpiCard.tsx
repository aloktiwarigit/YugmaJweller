import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@goldsmith/ui-mobile';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { api } from '../api/client';

interface DailySummary {
  date:          string;
  total_paise:   string;
  cash_paise:    string;
  invoice_count: number;
}

export function DashboardKpiCard(): React.ReactElement | null {
  const { data, isLoading, isError } = useQuery<DailySummary>({
    queryKey:  ['reports', 'daily-summary', 'today'],
    queryFn:   () => api.get<DailySummary>('/api/v1/reports/daily-summary').then((r) => r.data),
    staleTime: 60_000,
  });

  // Render nothing on error — KPI is informational, never breaks the home screen
  if (isError) return null;

  const totalRupees = data
    ? Math.round(Number(data.total_paise) / 100).toLocaleString('en-IN')
    : null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>आज का सारांश</Text>
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>बिक्री</Text>
          {isLoading || totalRupees === null ? (
            <Skeleton height={24} width={80} testID="kpi-sales-skeleton" />
          ) : (
            <Text style={styles.statValue} testID="kpi-sales-value">
              ₹{totalRupees}
            </Text>
          )}
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>बिल</Text>
          {isLoading || data === undefined ? (
            <Skeleton height={24} width={40} testID="kpi-invoices-skeleton" />
          ) : (
            <Text style={styles.statValue} testID="kpi-invoices-value">
              {data.invoice_count}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius:    radii.md,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing.md,
    marginTop:       spacing.md,
  },
  title: {
    fontFamily:    typography.body.family,
    fontSize:      13,
    color:         colors.inkMute,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },
  row:        { flexDirection: 'row' },
  stat:       { marginRight: spacing.xl },
  statLabel:  { fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute, marginBottom: 4 },
  statValue:  { fontFamily: typography.display.family, fontSize: 22, color: colors.ink },
});
