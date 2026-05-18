import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { colors, typography } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { useCustomerSession } from '../../src/hooks/useCustomerSession';
import { getWishlist, removeFromWishlist } from '../../src/api/endpoints';
import type { WishlistItem } from '../../src/api/endpoints';
import { captureEvent } from '../../src/lib/posthog';

export default function Wishlist(): React.ReactElement {
  const { customer } = useCustomerSession();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!customer) { setLoading(false); return; }
    try {
      setLoading(true);
      setLoadError(null);
      const data = await getWishlist();
      setItems(data);
    } catch {
      setLoadError('इच्छा सूची लोड नहीं हो सकी। कृपया फिर कोशिश करें।');
    } finally {
      setLoading(false);
    }
  }, [customer]);

  useEffect(() => { void load(); }, [load]);

  const handleRemove = async (productId: string): Promise<void> => {
    if (!customer) return;
    setRemoving(productId);
    setRemoveError(null);
    try {
      await removeFromWishlist(productId);
      captureEvent('wishlist_remove', { productId, shopId: customer.shopId });
      setItems((prev) => prev.filter((i) => i.productId !== productId));
    } catch {
      setRemoveError('उत्पाद हटाया नहीं जा सका। कृपया फिर कोशिश करें।');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <View style={styles.root}>
      <TenantBrandHeader />

      {loading ? (
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
              onPress={() => { void load(); }}
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
                onPress={() => void handleRemove(item.productId)}
                disabled={removing === item.productId}
                style={styles.removeBtn}
                accessibilityLabel="इच्छा सूची से हटाएं"
              >
                {removing === item.productId ? (
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
