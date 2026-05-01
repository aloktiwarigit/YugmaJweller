import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { colors } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { useCustomerSession } from '../../src/hooks/useCustomerSession';
import { getWishlist, removeFromWishlist } from '../../src/api/endpoints';
import type { WishlistItem } from '../../src/api/endpoints';

export default function Wishlist(): React.ReactElement {
  const { customer } = useCustomerSession();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!customer) { setLoading(false); return; }
    try {
      setLoading(true);
      const data = await getWishlist(customer.id);
      setItems(data);
    } catch {
      // network failure — show empty state
    } finally {
      setLoading(false);
    }
  }, [customer]);

  useEffect(() => { void load(); }, [load]);

  const handleRemove = async (productId: string): Promise<void> => {
    if (!customer) return;
    setRemoving(productId);
    try {
      await removeFromWishlist(customer.id, productId);
      setItems((prev) => prev.filter((i) => i.productId !== productId));
    } catch {
      // silently ignore
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
          <Text style={styles.empty}>इच्छा सूची खाली है</Text>
          <Text style={styles.emptySub}>उत्पाद देखें और ♡ बटन दबाएं</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.productId}
          contentContainerStyle={styles.list}
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
                  <Text style={styles.removeBtnText}>बैग से हटाएं</Text>
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
  empty:       { fontSize: 18, color: colors.ink, fontWeight: '500', textAlign: 'center' },
  emptySub:    { fontSize: 14, color: colors.inkMute, marginTop: 8, textAlign: 'center' },
  list:        { padding: 16, gap: 12 },
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
  cardTitle:   { fontSize: 16, color: colors.ink, fontWeight: '600' },
  cardSub:     { fontSize: 13, color: colors.inkMute, marginTop: 2 },
  removeBtn:   { marginLeft: 12, minWidth: 88, alignItems: 'center' },
  removeBtnText: { fontSize: 13, color: colors.error },
});
