import React from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';
import type { CustomerViewItem } from './types';

interface Props {
  customerId: string;
}

function formatRelativeHindi(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'आज';
  if (days === 1) return 'कल';
  if (days < 7) return `${days} दिन पहले`;
  if (days < 30) return `${Math.floor(days / 7)} सप्ताह पहले`;
  return `${Math.floor(days / 30)} महीने पहले`;
}

function ViewItem({ item }: { item: CustomerViewItem }): React.ReactElement {
  return (
    <View style={styles.viewRow}>
      {item.primaryImageUrl ? (
        <Image
          source={{ uri: item.primaryImageUrl }}
          style={styles.thumb}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Text style={styles.thumbEmoji}>💎</Text>
        </View>
      )}
      <View style={styles.viewInfo}>
        <Text style={styles.productName} numberOfLines={2}>{item.productName}</Text>
        <Text style={styles.viewTime}>{formatRelativeHindi(item.viewedAt)}</Text>
      </View>
    </View>
  );
}

export function CustomerViewingHistoryCard({ customerId }: Props): React.ReactElement {
  const { data = [], isLoading } = useQuery<CustomerViewItem[]>({
    queryKey: ['customer-viewing-history', customerId],
    queryFn: async () =>
      (await api.get<CustomerViewItem[]>(
        `/api/v1/analytics/customers/${customerId}/views?limit=10`,
      )).data,
    enabled: !!customerId,
  });

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>हाल में देखे गए</Text>

      {isLoading && (
        <ActivityIndicator size="small" color="#B8860B" style={styles.loader} />
      )}

      {!isLoading && data.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👁️</Text>
          <Text style={styles.emptyMain}>अभी तक कोई व्यू नहीं</Text>
          <Text style={styles.emptySub}>
            जब ग्राहक उत्पाद देखेंगे, वे यहाँ दिखेंगे।
          </Text>
        </View>
      )}

      {!isLoading && data.length > 0 && (
        <FlatList
          data={data}
          keyExtractor={(item) => item.productId + item.viewedAt}
          renderItem={({ item }) => <ViewItem item={item} />}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFDF7',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#C8A951',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontFamily: 'NotoSansDevanagari_700Bold',
    fontSize: 16,
    color: '#5C3D11',
    marginBottom: 12,
  },
  loader: { marginVertical: 16 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  emptyIcon: { fontSize: 28, marginBottom: 4 },
  emptyMain: {
    fontFamily: 'NotoSansDevanagari_700Bold',
    fontSize: 15,
    color: '#8D6E63',
  },
  emptySub: {
    fontFamily: 'NotoSansDevanagari',
    fontSize: 13,
    color: '#BDBDBD',
    textAlign: 'center',
    lineHeight: 18,
  },
  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: 6,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#F5EDDD',
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmoji: { fontSize: 20 },
  viewInfo: { flex: 1 },
  productName: {
    fontFamily: 'NotoSansDevanagari',
    fontSize: 14,
    color: '#3E2723',
    lineHeight: 19,
  },
  viewTime: {
    fontFamily: 'NotoSansDevanagari',
    fontSize: 12,
    color: '#BDBDBD',
    marginTop: 2,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#F0E5C8',
  },
});
