import React from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import type { ModerationReviewItem } from '../../src/features/reviews/types';

function StarRating({ rating }: { rating: number }): React.ReactElement {
  return <Text style={styles.stars}>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</Text>;
}

function VisibilityBadge({ visible }: { visible: boolean }): React.ReactElement {
  return (
    <View style={[styles.badge, { backgroundColor: visible ? '#E8F5E9' : '#FFF3E0', borderColor: visible ? '#4CAF50' : '#FF9800' }]}>
      <Text style={[styles.badgeText, { color: visible ? '#2E7D32' : '#E65100' }]}>
        {visible ? 'सार्वजनिक' : 'छुपा हुआ'}
      </Text>
    </View>
  );
}

function ReviewCard({ item }: { item: ModerationReviewItem }): React.ReactElement {
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/reviews/${item.id}` as never)}
      android_ripple={{ color: '#D4A85A33' }}
    >
      <View style={styles.cardRow}>
        <StarRating rating={item.rating} />
        <VisibilityBadge visible={item.isPubliclyVisible} />
      </View>
      {item.productName ? <Text style={styles.productName} numberOfLines={1}>{item.productName}</Text> : null}
      {item.customerFirstName ? <Text style={styles.customerName}>{item.customerFirstName}</Text> : null}
      {item.reviewText ? <Text style={styles.reviewText} numberOfLines={2}>{item.reviewText}</Text> : null}
      <Text style={styles.date}>
        {new Date(item.createdAt).toLocaleDateString('hi-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
      </Text>
    </Pressable>
  );
}

export default function ReviewsListScreen(): React.ReactElement {
  const { data = [], isLoading, isError, refetch } = useQuery<ModerationReviewItem[]>({
    queryKey: ['reviews-moderation'],
    queryFn: async () => (await api.get<ModerationReviewItem[]>('/api/v1/reviews')).data,
  });

  return (
    <View style={styles.container}>
      {isLoading && <ActivityIndicator style={styles.loader} size="large" color="#D4A85A" />}
      {isError && <Text style={styles.error}>डेटा लोड नहीं हो सका।</Text>}
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReviewCard item={item} />}
        contentContainerStyle={styles.list}
        onRefresh={refetch}
        refreshing={isLoading}
        ListEmptyComponent={
          !isLoading ? <Text style={styles.empty}>अभी तक कोई समीक्षा नहीं।</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF6F0' },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#3E2723',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  stars: { fontSize: 16, color: '#D4A85A', letterSpacing: 2 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  badgeText: { fontSize: 12, fontFamily: 'NotoSansDevanagari', fontWeight: '600' },
  productName: { fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 14, color: '#3E2723', marginBottom: 2 },
  customerName: { fontFamily: 'NotoSansDevanagari', fontSize: 13, color: '#8D6E63', marginBottom: 4 },
  reviewText: { fontFamily: 'NotoSansDevanagari', fontSize: 14, color: '#5D4037', lineHeight: 20 },
  date: { fontSize: 12, color: '#BDBDBD', marginTop: 6, fontFamily: 'NotoSansDevanagari' },
  loader: { marginTop: 48 },
  error: { textAlign: 'center', color: '#C62828', marginTop: 48, fontSize: 15 },
  empty: { textAlign: 'center', color: '#BDBDBD', marginTop: 64, fontSize: 16, fontFamily: 'NotoSansDevanagari' },
});
