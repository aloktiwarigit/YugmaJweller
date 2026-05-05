import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { TimelineCard } from './TimelineCard';
import { TimelineEmptyState } from './TimelineEmptyState';
import { TimelineSkeleton } from './TimelineSkeleton';
import { usePurchases } from '../../hooks/useCustomerTimeline';
import type { PurchaseHistorySummary } from '../../api/endpoints';

const PAGE = 20;

export function TimelinePurchases(): React.ReactElement {
  const [offset, setOffset]     = useState(0);
  const [allItems, setAllItems] = useState<PurchaseHistorySummary[]>([]);
  const { data, isLoading, isError, refetch } = usePurchases({ limit: PAGE, offset });

  useEffect(() => {
    if (data?.invoices) {
      setAllItems((prev) => offset === 0 ? data.invoices : [...prev, ...data.invoices]);
    }
  }, [data, offset]);

  if (isLoading && allItems.length === 0) return <TimelineSkeleton />;
  if (isError) return (
    <View style={{ padding: spacing.lg, alignItems: 'center' }}>
      <Text style={{ fontFamily: typography.body.family, color: colors.error, marginBottom: spacing.sm }}>
        डेटा लोड नहीं हो सका। पुनः प्रयास करें।
      </Text>
      <Pressable
        onPress={() => { void refetch(); }}
        style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border }}
      >
        <Text style={{ fontFamily: typography.body.family, color: colors.ink }}>पुनः प्रयास</Text>
      </Pressable>
    </View>
  );
  if (!isLoading && allItems.length === 0) return <TimelineEmptyState tab="purchases" />;

  const total   = data?.total ?? allItems.length;
  const hasMore = offset + allItems.length < total;

  return (
    <ScrollView nestedScrollEnabled contentContainerStyle={{ padding: spacing.lg }}>
      {allItems.map((inv) => (
        <TimelineCard
          key={inv.invoiceId}
          status={inv.status}
          title={inv.invoiceNumber}
          subLine={`₹${Math.round(Number(inv.totalPaise) / 100).toLocaleString('en-IN')}`}
          date={inv.issuedAt
            ? new Intl.DateTimeFormat('hi-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(inv.issuedAt))
            : '—'}
        />
      ))}
      {hasMore && (
        <Pressable
          onPress={() => setOffset((o) => o + PAGE)}
          disabled={isLoading}
          style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm }}
        >
          <Text style={{ fontFamily: typography.body.family, color: colors.ink }}>और देखें</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
