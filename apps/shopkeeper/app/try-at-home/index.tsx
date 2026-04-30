import React from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import type { TryAtHomeBookingResponse, BookingStatus } from '../../src/features/try-at-home/types';
import { STATUS_LABELS, STATUS_COLORS } from '../../src/features/try-at-home/types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('hi-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusChip({ status }: { status: BookingStatus }): React.ReactElement {
  return (
    <View style={[styles.chip, { backgroundColor: STATUS_COLORS[status] + '22', borderColor: STATUS_COLORS[status] }]}>
      <Text style={[styles.chipText, { color: STATUS_COLORS[status] }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

function BookingCard({ booking }: { booking: TryAtHomeBookingResponse }): React.ReactElement {
  return (
    <Pressable
      style={styles.card}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onPress={() => router.push(`/try-at-home/${booking.id}` as any)}
      android_ripple={{ color: '#D4A85A33' }}
    >
      <View style={styles.cardRow}>
        <Text style={styles.piecesLabel}>{booking.productIds.length} आइटम</Text>
        <StatusChip status={booking.status} />
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.metaText}>{formatDate(booking.requestedAt)}</Text>
        {booking.dispatchAt && (
          <Text style={styles.metaText}>भेजा: {formatDate(booking.dispatchAt)}</Text>
        )}
      </View>
      {booking.notes && (
        <Text style={styles.notes} numberOfLines={1}>{booking.notes}</Text>
      )}
    </Pressable>
  );
}

export default function TryAtHomeListScreen(): React.ReactElement {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['try-at-home-bookings'],
    queryFn: async () =>
      (await api.get<{ bookings: TryAtHomeBookingResponse[]; total: number }>(
        '/api/v1/try-at-home/bookings?limit=50',
      )).data,
  });

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.fab}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onPress={() => router.push('/try-at-home/new' as any)}
        android_ripple={{ color: '#fff3' }}
      >
        <Text style={styles.fabText}>+ नई बुकिंग</Text>
      </Pressable>

      {isLoading && <ActivityIndicator style={styles.loader} size="large" color="#D4A85A" />}
      {isError && <Text style={styles.error}>डेटा लोड नहीं हो सका।</Text>}

      {data && (
        <FlatList
          data={data.bookings}
          keyExtractor={(b) => b.id}
          renderItem={({ item }) => <BookingCard booking={item} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>कोई बुकिंग नहीं। नई बुकिंग बनाएँ।</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#FAF6F0' },
  list:        { padding: 16, paddingBottom: 100 },
  card:        { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#3E2723', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 },
  cardRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  piecesLabel: { fontSize: 16, fontWeight: '700', color: '#3E2723' },
  chip:        { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  chipText:    { fontSize: 12, fontWeight: '600' },
  cardMeta:    { flexDirection: 'row', justifyContent: 'space-between' },
  metaText:    { fontSize: 13, color: '#8D6E63' },
  notes:       { fontSize: 13, color: '#9E9E9E', marginTop: 4 },
  fab:         { position: 'absolute', bottom: 24, right: 20, zIndex: 10, backgroundColor: '#D4A85A', borderRadius: 28, paddingHorizontal: 20, paddingVertical: 14, elevation: 6 },
  fabText:     { color: '#FFF', fontSize: 15, fontWeight: '700' },
  loader:      { marginTop: 48 },
  error:       { textAlign: 'center', color: '#C62828', marginTop: 48, fontSize: 15 },
  empty:       { textAlign: 'center', color: '#BDBDBD', marginTop: 48, fontSize: 15 },
});
