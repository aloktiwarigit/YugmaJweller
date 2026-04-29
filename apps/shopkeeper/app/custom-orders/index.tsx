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
import type { CustomOrderResponse, CustomOrderStatus } from '../../src/features/custom-orders/types';
import { STATUS_LABELS, STATUS_COLORS } from '../../src/features/custom-orders/types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('hi-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatPaise(paise: string | null): string {
  if (!paise) return '—';
  return `₹${(Number(paise) / 100).toLocaleString('hi-IN', { maximumFractionDigits: 0 })}`;
}

function StatusChip({ status }: { status: CustomOrderStatus }): React.ReactElement {
  return (
    <View style={[styles.chip, { backgroundColor: STATUS_COLORS[status] + '22', borderColor: STATUS_COLORS[status] }]}>
      <Text style={[styles.chipText, { color: STATUS_COLORS[status] }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

function OrderCard({ order }: { order: CustomOrderResponse }): React.ReactElement {
  return (
    <Pressable
      style={styles.card}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onPress={() => router.push(`/custom-orders/${order.id}` as any)}
      android_ripple={{ color: '#D4A85A33' }}
    >
      <View style={styles.cardRow}>
        <Text style={styles.description} numberOfLines={2}>{order.description}</Text>
        <StatusChip status={order.status as CustomOrderStatus} />
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.metaText}>अनुमान: {formatPaise(order.quotedAmountPaise)}</Text>
        <Text style={styles.metaText}>{formatDate(order.createdAt)}</Text>
      </View>
      {order.estimatedDeliveryDate && (
        <Text style={styles.deliveryDate}>डिलीवरी: {order.estimatedDeliveryDate}</Text>
      )}
    </Pressable>
  );
}

export default function CustomOrderListScreen(): React.ReactElement {
  const { data, isLoading } = useQuery<{ orders: CustomOrderResponse[]; total: number }>({
    queryKey: ['custom-orders'],
    queryFn: async () => (await api.get<{ orders: CustomOrderResponse[]; total: number }>('/api/v1/custom-orders?limit=50')).data,
  });

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>कस्टम ऑर्डर</Text>
        <Pressable
          style={styles.newBtn}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPress={() => router.push('/custom-orders/new' as any)}
        >
          <Text style={styles.newBtnText}>+ नया</Text>
        </Pressable>
      </View>

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#B8860B" />
        </View>
      )}

      <FlatList
        data={data?.orders ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <OrderCard order={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>कोई कस्टम ऑर्डर नहीं</Text>
              <Text style={styles.emptySubtext}>नया ऑर्डर बनाने के लिए + नया दबाएँ</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: '#F5EDDD' },
  headerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#D4A85A', backgroundColor: '#FDF6EC' },
  screenTitle:  { fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 20, color: '#5C3D11' },
  newBtn:       { backgroundColor: '#B8860B', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  newBtnText:   { color: '#fff', fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 14 },
  list:         { padding: 12, gap: 10, paddingBottom: 40 },
  card:         { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E8D5A3', gap: 8 },
  cardRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  description:  { fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 15, color: '#3D2000', flex: 1 },
  chip:         { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, flexShrink: 0 },
  chipText:     { fontSize: 12, fontFamily: 'NotoSansDevanagari_400Regular' },
  cardMeta:     { flexDirection: 'row', justifyContent: 'space-between' },
  metaText:     { fontSize: 13, color: '#7A5400' },
  deliveryDate: { fontSize: 12, color: '#7A5400', fontStyle: 'italic' },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText:    { fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 16, color: '#7A5400', marginBottom: 6 },
  emptySubtext: { fontSize: 14, color: '#9E7A40', textAlign: 'center' },
});
