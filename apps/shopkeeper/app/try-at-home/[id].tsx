import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import type { TryAtHomeBookingResponse } from '../../src/features/try-at-home/types';
import { STATUS_LABELS, STATUS_COLORS } from '../../src/features/try-at-home/types';
import { ReturnSheet } from '../../src/features/try-at-home/components/ReturnSheet';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('hi-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function TryAtHomeDetailScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [returnSheetVisible, setReturnSheetVisible] = useState(false);

  const { data: booking, isLoading } = useQuery<TryAtHomeBookingResponse>({
    queryKey: ['try-at-home-booking', id],
    queryFn:  async () =>
      (await api.get<TryAtHomeBookingResponse>(`/api/v1/try-at-home/bookings/${id}`)).data,
    enabled:  !!id,
  });

  const dispatchMutation = useMutation<TryAtHomeBookingResponse>({
    mutationFn: async () =>
      (await api.patch<TryAtHomeBookingResponse>(`/api/v1/try-at-home/bookings/${id}/dispatch`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['try-at-home-booking', id] });
      void qc.invalidateQueries({ queryKey: ['try-at-home-bookings'] });
    },
    onError: () => {
      Alert.alert('त्रुटि', 'भेजा नहीं जा सका। पुनः प्रयास करें।');
    },
  });

  if (isLoading) {
    return <ActivityIndicator style={styles.loader} size="large" color="#D4A85A" />;
  }
  if (!booking) {
    return <Text style={styles.error}>बुकिंग नहीं मिली।</Text>;
  }

  const status = booking.status;
  const color  = STATUS_COLORS[status];

  return (
    <ScrollView style={styles.container}>
      {/* Status badge */}
      <View style={[styles.statusBanner, { borderColor: color, backgroundColor: color + '15' }]}>
        <Text style={[styles.statusText, { color }]}>{STATUS_LABELS[status]}</Text>
      </View>

      {/* Details */}
      <View style={styles.card}>
        <Row label="ग्राहक ID" value={booking.customerId.slice(0, 8) + '…'} />
        <Row label="आइटम संख्या" value={String(booking.productIds.length)} />
        <Row label="अनुरोध तिथि" value={formatDate(booking.requestedAt)} />
        {booking.dispatchAt  && <Row label="भेजी गई" value={formatDate(booking.dispatchAt)} />}
        {booking.returnDueAt && <Row label="वापसी तक" value={formatDate(booking.returnDueAt)} />}
        {booking.notes && <Row label="नोट" value={booking.notes} />}
      </View>

      {/* Product IDs */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>आइटम</Text>
        {booking.productIds.map((pid, i) => (
          <Text key={pid} style={styles.productId}>{i + 1}. {pid}</Text>
        ))}
      </View>

      {/* Actions */}
      {status === 'REQUESTED' && (
        <Pressable
          style={[styles.actionBtn, dispatchMutation.isPending && styles.btnDisabled]}
          onPress={() => dispatchMutation.mutate()}
          disabled={dispatchMutation.isPending}
        >
          {dispatchMutation.isPending
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.actionBtnText}>भेजें (Dispatch)</Text>
          }
        </Pressable>
      )}

      {status === 'DISPATCHED' && (
        <Pressable
          style={[styles.actionBtn, styles.returnBtn]}
          onPress={() => setReturnSheetVisible(true)}
        >
          <Text style={styles.actionBtnText}>वापसी दर्ज करें</Text>
        </Pressable>
      )}

      {booking && (
        <ReturnSheet
          booking={booking}
          visible={returnSheetVisible}
          onClose={() => setReturnSheetVisible(false)}
        />
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#FAF6F0' },
  statusBanner:  { margin: 16, borderRadius: 10, borderWidth: 1.5, padding: 12, alignItems: 'center' },
  statusText:    { fontSize: 18, fontWeight: '700' },
  card:          { backgroundColor: '#FFF', borderRadius: 12, margin: 16, marginTop: 0, padding: 16, elevation: 2, shadowColor: '#3E2723', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: '#3E2723', marginBottom: 10 },
  row:           { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F5F0E8' },
  rowLabel:      { fontSize: 14, color: '#8D6E63' },
  rowValue:      { fontSize: 14, color: '#3E2723', fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  productId:     { fontSize: 13, color: '#5D4037', paddingVertical: 4, fontFamily: 'monospace' },
  actionBtn:     { margin: 16, marginTop: 0, paddingVertical: 16, borderRadius: 12, backgroundColor: '#D4A85A', alignItems: 'center' },
  returnBtn:     { backgroundColor: '#1565C0' },
  actionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  btnDisabled:   { opacity: 0.5 },
  loader:        { flex: 1, marginTop: 80 },
  error:         { textAlign: 'center', color: '#C62828', marginTop: 80, fontSize: 15 },
});
