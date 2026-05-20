import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/api/client';
import type { ModerationReviewItem } from '../../src/features/reviews/types';

export default function ReviewDetailScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reviewId = id ?? '';
  const qc = useQueryClient();

  const { data: review, isLoading } = useQuery<ModerationReviewItem>({
    queryKey: ['review', reviewId],
    queryFn: async () => {
      const all = qc.getQueryData<ModerationReviewItem[]>(['reviews-moderation']) ?? [];
      const cached = all.find((r) => r.id === reviewId);
      if (cached) return cached;
      // fallback: fetch full list and find
      const res = await api.get<ModerationReviewItem[]>('/api/v1/reviews');
      return res.data.find((r) => r.id === reviewId) as ModerationReviewItem;
    },
    enabled: !!reviewId,
  });

  const visibilityMutation = useMutation({
    mutationFn: async (visible: boolean) =>
      api.patch(`/api/v1/reviews/${reviewId}/visibility`, { visible }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reviews-moderation'] });
      void qc.invalidateQueries({ queryKey: ['review', reviewId] });
    },
  });

  if (isLoading) return <ActivityIndicator style={styles.loader} size="large" color="#D4A85A" />;
  if (!review) return <Text style={styles.error}>समीक्षा नहीं मिली।</Text>;

  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.stars}>{stars}</Text>
        {review.productName ? <Text style={styles.productName}>{review.productName}</Text> : null}
        {review.customerFirstName ? (
          <Text style={styles.customer}>{review.customerFirstName}</Text>
        ) : null}
        {review.reviewText ? (
          <Text style={styles.reviewText}>{review.reviewText}</Text>
        ) : (
          <Text style={styles.noText}>कोई टिप्पणी नहीं</Text>
        )}
        <Text style={styles.date}>
          {new Date(review.createdAt).toLocaleDateString('hi-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, styles.approveBtn, review.isPubliclyVisible && styles.btnActive]}
          onPress={() => visibilityMutation.mutate(true)}
          disabled={visibilityMutation.isPending || review.isPubliclyVisible}
          android_ripple={{ color: '#fff3' }}
          accessibilityRole="button"
          accessibilityLabel="समीक्षा स्वीकृत करें"
        >
          <Text style={styles.btnText}>✓ स्वीकृत करें</Text>
        </Pressable>

        <Pressable
          style={[styles.btn, styles.rejectBtn, !review.isPubliclyVisible && styles.btnActive]}
          onPress={() => visibilityMutation.mutate(false)}
          disabled={visibilityMutation.isPending || !review.isPubliclyVisible}
          android_ripple={{ color: '#fff3' }}
          accessibilityRole="button"
          accessibilityLabel="समीक्षा अस्वीकृत करें"
        >
          <Text style={styles.btnText}>✗ अस्वीकृत करें</Text>
        </Pressable>
      </View>

      {visibilityMutation.isError && (
        <Text style={styles.error}>कार्रवाई विफल रही। पुनः प्रयास करें।</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF6F0' },
  content: { padding: 16, gap: 16 },
  loader: { marginTop: 64 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#3E2723',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  stars: { fontSize: 24, color: '#D4A85A', letterSpacing: 3, marginBottom: 12 },
  productName: { fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 16, color: '#3E2723', marginBottom: 4 },
  customer: { fontFamily: 'NotoSansDevanagari', fontSize: 14, color: '#8D6E63', marginBottom: 12 },
  reviewText: { fontFamily: 'NotoSansDevanagari', fontSize: 16, color: '#4E342E', lineHeight: 26, marginBottom: 12 },
  noText: { fontFamily: 'NotoSansDevanagari', fontSize: 14, color: '#BDBDBD', fontStyle: 'italic', marginBottom: 12 },
  date: { fontFamily: 'NotoSansDevanagari', fontSize: 13, color: '#BDBDBD' },
  actions: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, minHeight: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  approveBtn: { borderColor: '#4CAF50', backgroundColor: '#F1F8E9' },
  rejectBtn: { borderColor: '#FF7043', backgroundColor: '#FBE9E7' },
  btnActive: { opacity: 0.4 },
  btnText: { fontFamily: 'NotoSansDevanagari_700Bold', fontSize: 16, color: '#3E2723' },
  error: { textAlign: 'center', color: '#C62828', marginTop: 12, fontSize: 14, fontFamily: 'NotoSansDevanagari' },
});
