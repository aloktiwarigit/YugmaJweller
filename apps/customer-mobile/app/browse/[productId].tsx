import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { colors } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { useCustomerSession } from '../../src/hooks/useCustomerSession';
import {
  getProductReviews,
  addToWishlist,
  removeFromWishlist,
  getWishlist,
} from '../../src/api/endpoints';
import type { ReviewItem } from '../../src/api/endpoints';

function StarRow({ rating }: { rating: number }): React.ReactElement {
  return (
    <Text accessibilityLabel={`${rating} स्टार`} style={styles.stars}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </Text>
  );
}

export default function ProductDetail(): React.ReactElement {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const router = useRouter();
  const { customer } = useCustomerSession();

  const [wishlisted, setWishlisted]     = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);

  // Fetch reviews
  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ['reviews', productId],
    queryFn:  () => getProductReviews(productId ?? ''),
    enabled:  Boolean(productId),
  });

  // Check if wishlisted
  useEffect(() => {
    if (!customer || !productId) return;
    void getWishlist(customer.id).then((items) => {
      setWishlisted(items.some((i) => i.productId === productId));
    }).catch(() => undefined);
  }, [customer, productId]);

  const toggleWishlist = async (): Promise<void> => {
    if (!customer || !productId) return;
    setWishlistBusy(true);
    try {
      if (wishlisted) {
        await removeFromWishlist(customer.id, productId);
        setWishlisted(false);
      } else {
        await addToWishlist(customer.id, productId);
        setWishlisted(true);
      }
    } catch {
      // ignore
    } finally {
      setWishlistBusy(false);
    }
  };

  if (!productId) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      <TenantBrandHeader />
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="वापस जाएं">
          <Text style={styles.backText}>← वापस</Text>
        </TouchableOpacity>

        {/* Image placeholder */}
        <View style={styles.imagePlaceholder} />

        {/* Wishlist toggle */}
        <TouchableOpacity
          onPress={() => void toggleWishlist()}
          disabled={wishlistBusy || !customer}
          style={[styles.wishlistBtn, wishlisted && styles.wishlistBtnActive]}
          accessibilityLabel={wishlisted ? 'इच्छा सूची से हटाएं' : 'इच्छा सूची में जोड़ें'}
          accessibilityRole="togglebutton"
        >
          {wishlistBusy ? (
            <ActivityIndicator size="small" color={wishlisted ? '#fff' : colors.primary} />
          ) : (
            <Text style={[styles.wishlistBtnText, wishlisted && styles.wishlistBtnTextActive]}>
              {wishlisted ? '♥ इच्छा सूची में है' : '♡ इच्छा सूची में जोड़ें'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Reviews section */}
        <View style={styles.reviewsSection}>
          <Text style={styles.sectionTitle}>ग्राहक समीक्षाएं</Text>

          {reviewsData && reviewsData.averageRating !== null && (
            <View style={styles.avgRow}>
              <StarRow rating={Math.round(reviewsData.averageRating)} />
              <Text style={styles.avgText}>
                {' '}{reviewsData.averageRating} ({reviewsData.total})
              </Text>
            </View>
          )}

          {reviewsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
          ) : reviewsData?.reviews.length === 0 ? (
            <Text style={styles.noReviews}>अभी तक कोई समीक्षा नहीं।</Text>
          ) : (
            reviewsData?.reviews.slice(0, 5).map((r: ReviewItem) => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <StarRow rating={r.rating} />
                  <Text style={styles.reviewAuthor}>
                    {r.customerFirstName ?? 'ग्राहक'}
                  </Text>
                </View>
                {r.reviewText ? (
                  <Text style={styles.reviewText}>{r.reviewText}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:              { flex: 1, backgroundColor: colors.bg },
  scroll:            { padding: 16, paddingBottom: 40 },
  backBtn:           { marginBottom: 16 },
  backText:          { fontSize: 14, color: colors.primary },
  imagePlaceholder:  {
    width: '100%', aspectRatio: 1,
    backgroundColor: colors.border,
    borderRadius: 12, marginBottom: 16,
  },
  wishlistBtn: {
    borderWidth: 1.5, borderColor: colors.primary,
    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
    backgroundColor: '#fff', marginBottom: 24,
    minHeight: 48,
  },
  wishlistBtnActive:    { backgroundColor: colors.primary },
  wishlistBtnText:      { fontSize: 15, color: colors.primary, fontWeight: '500' },
  wishlistBtnTextActive: { color: '#fff' },
  reviewsSection:    { marginTop: 8 },
  sectionTitle:      { fontSize: 18, color: colors.ink, fontWeight: '700', marginBottom: 12 },
  avgRow:            { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  stars:             { color: '#F59E0B', fontSize: 18 },
  avgText:           { fontSize: 14, color: colors.inkMute },
  noReviews:         { fontSize: 14, color: colors.inkMute, textAlign: 'center', paddingVertical: 16 },
  reviewCard: {
    backgroundColor: '#fff', borderRadius: 8, borderWidth: 1,
    borderColor: colors.border, padding: 12, marginBottom: 10,
  },
  reviewHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  reviewAuthor:     { fontSize: 12, color: colors.inkMute },
  reviewText:       { fontSize: 14, color: colors.ink },
});
