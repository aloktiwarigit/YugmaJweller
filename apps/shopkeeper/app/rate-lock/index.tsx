import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { api } from '../../src/api/client';

interface RateLockBooking {
  id:                        string;
  customerId:                string;
  lockedRate24kPaisePerGram: string;
  lockedAt:                  string;
  expiresAt:                 string;
  depositAmountPaise:        string;
  status:                    string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'भुगतान लंबित',
  ACTIVE:          'सक्रिय',
  USED:            'उपयोग किया',
  EXPIRED:         'समाप्त',
  CANCELLED:       'रद्द',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: '#D97706',
  ACTIVE:          '#059669',
  USED:            '#6B7280',
  EXPIRED:         '#DC2626',
  CANCELLED:       '#9CA3AF',
};

function formatRate(paisePerGram: string): string {
  return `₹${Math.round(Number(paisePerGram) / 100).toLocaleString('en-IN')}/g`;
}

export default function RateLockIndexScreen(): React.ReactElement {
  const { data: bookings = [], isLoading, isError, refetch } = useQuery<RateLockBooking[]>({
    queryKey:  ['rate-lock-bookings-shop'],
    queryFn:   () => api.get<RateLockBooking[]>('/api/v1/rate-lock/bookings').then((r) => r.data),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>जानकारी लोड नहीं हो सकी।</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.retryBtn}
          onPress={() => void refetch()}
        >
          <Text style={styles.retryBtnText}>पुनः प्रयास</Text>
        </Pressable>
      </View>
    );
  }

  if (bookings.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>कोई दर-लॉक बुकिंग नहीं है।</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {bookings.map((b) => (
        <Pressable
          key={b.id}
          accessibilityRole="button"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPress={() => router.push(`/rate-lock/${b.id}` as any)}
          style={styles.card}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.statusChip, { backgroundColor: STATUS_COLORS[b.status] ?? '#6B7280' }]}>
              <Text style={styles.statusChipText}>
                {STATUS_LABELS[b.status] ?? b.status}
              </Text>
            </View>
            <Text style={styles.rateText}>{formatRate(b.lockedRate24kPaisePerGram)}</Text>
          </View>
          <Text style={styles.depositText}>
            जमा: ₹{Math.round(Number(b.depositAmountPaise) / 100).toLocaleString('en-IN')}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: colors.bg },
  content:      { padding: spacing.md },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  errorText:    { fontFamily: typography.body.family, color: colors.error, marginBottom: spacing.sm, fontSize: 16 },
  emptyText:    { fontFamily: typography.body.family, color: colors.inkMute, fontSize: 16 },
  retryBtn:     { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md },
  retryBtnText: { fontFamily: typography.body.family, color: colors.ink, fontSize: 16 },
  card: {
    backgroundColor: colors.white,
    borderRadius:    radii.md,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing.md,
    marginBottom:    spacing.sm,
    minHeight:       72,
  },
  cardHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  statusChip:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  statusChipText: { fontFamily: typography.body.family, color: colors.white, fontSize: 12 },
  rateText:       { fontFamily: typography.display.family, fontSize: 16, color: colors.ink },
  depositText:    { fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute },
});
