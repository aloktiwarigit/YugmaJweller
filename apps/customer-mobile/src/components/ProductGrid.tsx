import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { getCatalogProducts } from '../api/endpoints';
import { useTenantStore } from '../stores/tenantStore';
import { ProductCard } from './ProductCard';

export function ProductGrid(): React.ReactElement {
  const slug = useTenantStore((s) => s.slug);
  const q = useQuery({
    queryKey: ['catalog-products', slug, 6],
    queryFn: () => getCatalogProducts({ limit: 6 }),
    retry: false,
  });

  if (q.isLoading) return <ActivityIndicator style={{ marginVertical: spacing.lg }} />;

  if (q.isError) {
    return (
      <View
        testID="product-grid-error"
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.xl,
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: typography.serif.family,
            fontSize: 14,
            color: colors.inkMute,
            textAlign: 'center',
          }}
        >
          उत्पाद अभी लोड नहीं हो पाए। कृपया बाद में पुनः प्रयास करें।
        </Text>
      </View>
    );
  }

  if (!q.data || q.data.items.length === 0) {
    return (
      <View
        testID="product-grid-empty"
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.xl,
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: typography.serif.family,
            fontSize: 14,
            color: colors.inkMute,
            textAlign: 'center',
          }}
        >
          अभी कोई उत्पाद उपलब्ध नहीं है। दुकानदार जल्द जोड़ेंगे।
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, gap: spacing.sm }}
    >
      {q.data.items.map((p) => (
        <View key={p.id} style={{ width: '48%' }}>
          <ProductCard product={p} />
        </View>
      ))}
    </View>
  );
}
