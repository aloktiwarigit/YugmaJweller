import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { TimelineCard } from './TimelineCard';
import { TimelineEmptyState } from './TimelineEmptyState';
import { TimelineSkeleton } from './TimelineSkeleton';
import { useRateLocks } from '../../hooks/useCustomerTimeline';
import type { CustomerRateLockItem } from '../../api/endpoints';

const PAGE = 20;

export function TimelineRateLocks(): React.ReactElement {
  const [offset, setOffset]     = useState(0);
  const [allItems, setAllItems] = useState<CustomerRateLockItem[]>([]);
  const { data, isLoading, isError, refetch } = useRateLocks({ limit: PAGE, offset });

  useEffect(() => {
    if (data?.bookings) {
      setAllItems((prev) => offset === 0 ? data.bookings : [...prev, ...data.bookings]);
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
  if (!isLoading && allItems.length === 0) return <TimelineEmptyState tab="rate-locks" />;

  const total   = data?.total ?? allItems.length;
  const hasMore = offset + allItems.length < total;

  return (
    <ScrollView nestedScrollEnabled contentContainerStyle={{ padding: spacing.lg }}>
      {allItems.map((booking) => (
        <TimelineCard
          key={booking.id}
          status={booking.status}
          title={`₹${Math.round(Number(booking.lockedRate24kPaisePerGram) / 100).toLocaleString('en-IN')}/g`}
          subLine={`जमा: ₹${Math.round(Number(booking.depositAmountPaise) / 100).toLocaleString('en-IN')}`}
          date={new Intl.DateTimeFormat('hi-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(booking.lockedAt))}
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
