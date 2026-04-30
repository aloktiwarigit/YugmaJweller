import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

interface RateLockBooking {
  id: string;
  customerId: string;
  lockedRate24kPaisePerGram: string;
  lockedAt: string;
  expiresAt: string;
  depositAmountPaise: string;
  depositPaidPaise: string;
  status: 'PENDING_PAYMENT' | 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';
}

const STATUS_LABELS: Record<RateLockBooking['status'], string> = {
  PENDING_PAYMENT: 'भुगतान लंबित',
  ACTIVE:          'सक्रिय',
  USED:            'उपयोग किया',
  EXPIRED:         'समाप्त',
  CANCELLED:       'रद्द',
};

const STATUS_COLORS: Record<RateLockBooking['status'], string> = {
  PENDING_PAYMENT: '#D97706',
  ACTIVE:          '#059669',
  USED:            '#6B7280',
  EXPIRED:         '#DC2626',
  CANCELLED:       '#9CA3AF',
};

function formatRate(paisePerGram: string): string {
  return `₹${Math.round(Number(paisePerGram) / 100).toLocaleString('en-IN')}/g`;
}

function expiryCountdown(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'समाप्त हो गया';
  const days  = Math.floor(diff / 86400_000);
  const hours = Math.floor((diff % 86400_000) / 3600_000);
  if (days > 0) return `${days} दिन बचे`;
  return `${hours} घंटे बचे`;
}

interface Props {
  customerId: string;
  onCreateNew: () => void;
  onSelectBooking: (bookingId: string) => void;
}

export function RateLockListScreen({
  customerId,
  onCreateNew,
  onSelectBooking,
}: Props): React.ReactElement {
  const {
    data: bookings = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<RateLockBooking[]>({
    queryKey: ['rate-lock-bookings', customerId],
    queryFn: () =>
      api
        .get<RateLockBooking[]>(`/api/v1/rate-lock/bookings?customerId=${customerId}`)
        .then((r) => r.data),
    enabled: !!customerId,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#B8860B" size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText} accessibilityRole="alert">
          जानकारी लोड नहीं हो सकी।
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void refetch()}>
          <Text style={styles.retryBtnText}>पुनः प्रयास</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>दर बुकिंग</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={onCreateNew}
          accessibilityLabel="नई दर बुकिंग बनाएं"
        >
          <Text style={styles.newBtnText}>+ नई बुकिंग</Text>
        </TouchableOpacity>
      </View>

      {bookings.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>कोई दर बुकिंग नहीं</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => onSelectBooking(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`${STATUS_LABELS[item.status]} — ${formatRate(item.lockedRate24kPaisePerGram)}`}
            >
              <View style={styles.cardTop}>
                <Text style={styles.rateText}>
                  {formatRate(item.lockedRate24kPaisePerGram)} (24K)
                </Text>
                <View
                  style={[
                    styles.statusChip,
                    { backgroundColor: STATUS_COLORS[item.status] },
                  ]}
                >
                  <Text style={styles.statusText}>{STATUS_LABELS[item.status]}</Text>
                </View>
              </View>
              <Text style={styles.expiryText}>{expiryCountdown(item.expiresAt)}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBF5' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header:    {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title:        { fontSize: 20, fontWeight: '700', color: '#1C1917' },
  newBtn:       {
    backgroundColor: '#B8860B',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  newBtnText:   { color: '#FFF', fontWeight: '600', fontSize: 15 },
  list:         { padding: 16, gap: 12 },
  card:         {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop:      {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rateText:     { fontSize: 17, fontWeight: '700', color: '#1C1917' },
  statusChip:   { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:   { color: '#FFF', fontSize: 12, fontWeight: '600' },
  expiryText:   { fontSize: 14, color: '#6B7280' },
  emptyText:    { fontSize: 16, color: '#6B7280' },
  errorText:    {
    fontSize: 16,
    color: '#DC2626',
    marginBottom: 12,
    textAlign: 'center',
  },
  retryBtn:     {
    backgroundColor: '#B8860B',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryBtnText: { color: '#FFF', fontWeight: '600' },
});
