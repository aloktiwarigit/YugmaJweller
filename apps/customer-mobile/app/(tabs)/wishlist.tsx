import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, typography } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { useCustomerSession } from '../../src/hooks/useCustomerSession';
import { getWishlist, removeFromWishlist } from '../../src/api/endpoints';
import type { WishlistItem } from '../../src/api/endpoints';
import { captureEvent } from '../../src/lib/posthog';
import {
  removeWishlistItem,
  wishlistQueryKey,
} from '../../src/lib/wishlist-cache';

export default function Wishlist(): React.ReactElement {
  const { customer, isAuthenticated } = useCustomerSession();
  const queryClient = useQueryClient();

  const wishlistQuery = useQuery({
    queryKey: wishlistQueryKey,
    queryFn:  getWishlist,
    enabled:  isAuthenticated,
    retry:    false,
    refetchOnMount: 'always',
    staleTime: 30_000,
  });

  const removeMutation = useMutation({
    mutationFn: removeFromWishlist,
    onMutate: async (productId: string) => {
      await queryClient.cancelQueries({ queryKey: wishlistQueryKey });
      const previous = queryClient.getQueryData<WishlistItem[]>(wishlistQueryKey) ?? [];
      queryClient.setQueryData<WishlistItem[]>(wishlistQueryKey, (old = []) =>
        removeWishlistItem(old, productId),
      );
      return { previous };
    },
    onSuccess: (_result, productId) => {
      captureEvent('wishlist_remove', { productId, shopId: customer?.shopId });
    },
    onError: (_err, _productId, ctx) => {
      queryClient.setQueryData<WishlistItem[]>(wishlistQueryKey, ctx?.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: wishlistQueryKey });
    },
  });

  const items = wishlistQuery.data ?? [];
  const loadError = wishlistQuery.isError
    ? 'इच्छा सूची लोड नहीं हो सकी। कृपया फिर कोशिश करें।'
    : null;
  const removeError = removeMutation.isError
    ? 'उत्पाद हटाया नहीं जा सका। कृपया फिर कोशिश करें।'
    : null;

  return (
    <View style={styles.root}>
      <TenantBrandHeader />

      {wishlistQuery.isLoading || (wishlistQuery.isFetching && items.length === 0) ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>{loadError ?? 'इच्छा सूची खाली है'}</Text>
          <Text style={styles.emptySub}>
            {loadError ? 'नेटवर्क कनेक्शन जांचें।' : 'उत्पाद देखें और ♡ बटन दबाएं'}
          </Text>
          {loadError ? (
            <TouchableOpacity
              onPress={() => { void wishlistQuery.refetch(); }}
              style={styles.retryBtn}
              accessibilityRole="button"
              accessibilityLabel="इच्छा सूची फिर से लोड करें"
            >
              <Text style={styles.retryText}>फिर कोशिश करें</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.productId}
          contentContainerStyle={styles.list}
          ListHeaderComponent={removeError ? (
            <Text style={styles.errorText} accessibilityRole="alert">
              {removeError}
            </Text>
          ) : null}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{item.purity} {item.metal}</Text>
                <Text style={styles.cardSub}>SKU: {item.sku}</Text>
                <Text style={styles.cardSub}>
                  वज़न: {item.grossWeightG} ग्राम
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => removeMutation.mutate(item.productId)}
                disabled={removeMutation.isPending && removeMutation.variables === item.productId}
                style={styles.removeBtn}
                accessibilityLabel="इच्छा सूची से हटाएं"
              >
                {removeMutation.isPending && removeMutation.variables === item.productId ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <Text style={styles.removeBtnText}>पसंदीदा से हटाएं</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bg },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  empty:       { fontFamily: typography.headingMid.family, fontSize: 18, color: colors.ink, fontWeight: '500', textAlign: 'center' },
  emptySub:    { fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute, marginTop: 8, textAlign: 'center' },
  retryBtn:    { marginTop: 16, minHeight: 44, justifyContent: 'center' },
  retryText:   { fontFamily: typography.body.family, fontSize: 14, color: colors.primary },
  list:        { padding: 16, gap: 12 },
  errorText:   { fontFamily: typography.body.family, fontSize: 13, color: colors.error, textAlign: 'center', marginBottom: 4 },
  card:        {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    minHeight: 72,
  },
  cardInfo:    { flex: 1 },
  cardTitle:   { fontFamily: typography.headingMid.family, fontSize: 16, color: colors.ink, fontWeight: '600' },
  cardSub:     { fontFamily: typography.body.family, fontSize: 13, color: colors.inkMute, marginTop: 2 },
  removeBtn:   { marginLeft: 12, minWidth: 88, alignItems: 'center' },
  removeBtnText: { fontFamily: typography.body.family, fontSize: 13, color: colors.error },
});
