import React, { useState, useEffect } from 'react';
import { Text, Pressable, ScrollView } from 'react-native';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { TimelineCard } from './TimelineCard';
import { TimelineEmptyState } from './TimelineEmptyState';
import { TimelineSkeleton } from './TimelineSkeleton';
import { useTryAtHomeBookings } from '../../hooks/useCustomerTimeline';
import type { CustomerTryAtHomeItem } from '../../api/endpoints';

const PAGE = 20;

export function TimelineTryAtHome(): React.ReactElement {
  const [offset, setOffset]     = useState(0);
  const [allItems, setAllItems] = useState<CustomerTryAtHomeItem[]>([]);
  const { data, isLoading, isError } = useTryAtHomeBookings({ limit: PAGE, offset });

  useEffect(() => {
    if (data?.bookings) {
      setAllItems((prev) => offset === 0 ? data.bookings : [...prev, ...data.bookings]);
    }
  }, [data, offset]);

  if (isLoading && allItems.length === 0) return <TimelineSkeleton />;
  if (isError || (!isLoading && allItems.length === 0)) {
    return <TimelineEmptyState tab="try-at-home" />;
  }

  const total   = data?.total ?? allItems.length;
  const hasMore = offset + allItems.length < total;

  return (
    <ScrollView nestedScrollEnabled contentContainerStyle={{ padding: spacing.lg }}>
      {allItems.map((booking) => (
        <TimelineCard
          key={booking.id}
          status={booking.status}
          title={`${booking.productIds.length} वस्तु${booking.productIds.length > 1 ? 'एं' : ''}`}
          subLine={booking.notes ?? ''}
          date={new Intl.DateTimeFormat('hi-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(booking.requestedAt))}
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
