import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { DailySummaryCard } from '@goldsmith/ui-mobile';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { api } from '../../src/api/client';

interface CategoryItem {
  category:         string;
  productCount:     number;
  totalWeightG:     string;
  marketValuePaise: string;
  formattedValue:   string;
  primaryMetal:     string | null;
}

interface ValuationResponse {
  categories:          CategoryItem[];
  grandTotalPaise:     string;
  grandTotalFormatted: string;
  ratesFreshAt:        string;
  ratesStale:          boolean;
  computedAt:          string;
}

async function fetchValuation(): Promise<ValuationResponse> {
  const res = await api.get<ValuationResponse>('/api/v1/inventory/valuation');
  return res.data;
}

export default function ValuationScreen(): React.ReactElement {
  const { data, isLoading } = useQuery({
    queryKey: ['inventory', 'valuation'],
    queryFn: fetchValuation,
    refetchInterval: 5 * 60 * 1000,
  });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>स्टॉक मूल्यांकन</Text>

      {data?.ratesStale && (
        <View style={styles.staleBanner} accessibilityRole="alert">
          <Text style={styles.staleBannerText}>
            भाव 30 मिनट से पुराना है — अनुमानित मूल्य
          </Text>
        </View>
      )}

      {isLoading && (
        <View style={styles.loadingContainer}>
          {[1, 2, 3].map((n) => (
            <View key={n} style={styles.skeletonCard} />
          ))}
        </View>
      )}

      {!isLoading && data && (
        <>
          {data.categories.map((cat) => (
            <DailySummaryCard
              key={cat.category}
              label={cat.category}
              count={cat.productCount}
              weightG={cat.totalWeightG}
              value={cat.formattedValue}
              metal={
                cat.primaryMetal === 'GOLD' ? 'GOLD'
                  : cat.primaryMetal === 'SILVER' ? 'SILVER'
                  : null
              }
            />
          ))}

          <View style={styles.footer}>
            <Text style={styles.footerLabel}>कुल स्टॉक मूल्य</Text>
            <Text style={styles.footerValue}>{data.grandTotalFormatted}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background ?? colors.bg ?? '#F5EDDD' },
  container: { padding: spacing.md ?? 16, paddingBottom: spacing.xxl ?? 48 },
  title: {
    fontFamily: typography.headingMid?.family ?? typography.body.family,
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary ?? '#1C1917',
    marginBottom: spacing.md ?? 16,
  },
  staleBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: spacing.sm ?? 8,
    marginBottom: spacing.md ?? 16,
  },
  staleBannerText: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
  },
  loadingContainer: { gap: spacing.sm ?? 8 },
  skeletonCard: {
    backgroundColor: colors.white ?? '#FFFFFF',
    borderRadius: 12,
    height: 88,
    opacity: 0.5,
  },
  footer: {
    marginTop: spacing.lg ?? 24,
    padding: spacing.md ?? 16,
    backgroundColor: colors.white ?? '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
  },
  footerLabel: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: colors.textSecondary ?? '#6B7280',
  },
  footerValue: {
    fontFamily: typography.body.family,
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary ?? '#1C1917',
    marginTop: spacing.xs ?? 4,
  },
});
