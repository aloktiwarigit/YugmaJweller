import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { ProductResponse } from '@goldsmith/shared';
import type { BillingLineProduct, PublicRatesResponse } from '@goldsmith/ui-mobile';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { api } from '../../../api/client';

export interface BillingProductDraft {
  product: BillingLineProduct;
  ratePerGramPaise: bigint;
  makingChargePct: string;
}

interface Props {
  onAddProduct: (draft: BillingProductDraft) => void;
}

function paiseFromRupees(value: string): bigint {
  const numberValue = Number.parseFloat(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return 0n;
  return BigInt(Math.round(numberValue * 100));
}

function rateForProduct(product: ProductResponse, rates: PublicRatesResponse | undefined): bigint {
  if (!rates) return 0n;
  if (product.metal === 'SILVER') return paiseFromRupees(rates.SILVER_999.perGramRupees);
  if (product.metal === 'GOLD' && product.purity.toUpperCase().includes('24')) {
    return paiseFromRupees(rates.GOLD_24K.perGramRupees);
  }
  if (product.metal === 'GOLD') return paiseFromRupees(rates.GOLD_22K.perGramRupees);
  return paiseFromRupees(rates.GOLD_22K.perGramRupees);
}

function toBillingProduct(product: ProductResponse): BillingLineProduct {
  return {
    id: product.id,
    metal: product.metal,
    purity: product.purity,
    netWeightG: product.netWeightG,
    huid: product.huid,
    description: `${product.sku} - ${product.metal} ${product.purity}`,
  };
}

export function draftFromProduct(
  product: ProductResponse,
  rates: PublicRatesResponse | undefined,
): BillingProductDraft | null {
  const ratePerGramPaise = rateForProduct(product, rates);
  if (ratePerGramPaise <= 0n) return null;
  return {
    product: toBillingProduct(product),
    ratePerGramPaise,
    makingChargePct: product.makingChargeOverridePct ?? '10.00',
  };
}

export function BillingProductPicker({ onAddProduct }: Props): React.ReactElement {
  const [query, setQuery] = useState('');

  const productsQuery = useQuery<ProductResponse[]>({
    queryKey: ['billing-products-in-stock'],
    queryFn: async () => {
      const res = await api.get<ProductResponse[]>('/api/v1/inventory/products', {
        params: { status: 'IN_STOCK', pageSize: 100 },
      });
      return res.data;
    },
    staleTime: 30_000,
  });

  const ratesQuery = useQuery<PublicRatesResponse>({
    queryKey: ['catalog', 'rates'],
    queryFn: async () => (await api.get<PublicRatesResponse>('/api/v1/catalog/rates')).data,
    staleTime: 55_000,
  });

  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const products = productsQuery.data ?? [];
    if (!needle) return products.slice(0, 8);
    return products
      .filter((product) => {
        const haystack = [
          product.sku,
          product.metal,
          product.purity,
          product.huid ?? '',
          product.status,
        ].join(' ').toLowerCase();
        return haystack.includes(needle);
      })
      .slice(0, 12);
  }, [productsQuery.data, query]);

  const addProduct = (product: ProductResponse): void => {
    const draft = draftFromProduct(product, ratesQuery.data);
    if (draft === null) return;
    onAddProduct(draft);
    setQuery('');
  };

  const loading = productsQuery.isLoading || ratesQuery.isLoading;
  const disabled = ratesQuery.isError || ratesQuery.data == null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>उत्पाद जोड़ें</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          style={styles.input}
          placeholder="SKU, धातु, शुद्धता या HUID खोजें"
          placeholderTextColor={colors.inkSoft}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="जोड़ने के लिए उत्पाद खोजें"
        />
        {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      {disabled ? (
        <Text style={styles.helpText}>दर उपलब्ध नहीं है, इसलिए उत्पाद अभी नहीं जोड़ा जा सकता।</Text>
      ) : null}

      {visibleProducts.map((product) => (
        <Pressable
          key={product.id}
          style={({ pressed }) => [
            styles.productRow,
            pressed && styles.productRowPressed,
            disabled && styles.productRowDisabled,
          ]}
          onPress={() => addProduct(product)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`${product.sku} जोड़ें`}
        >
          <View style={styles.productText}>
            <Text style={styles.productSku}>{product.sku}</Text>
            <Text style={styles.productMeta}>
              {product.metal} {product.purity} - {product.netWeightG}g
              {product.huid ? ` - HUID ${product.huid}` : ''}
            </Text>
          </View>
          <Text style={styles.addText}>जोड़ें</Text>
        </Pressable>
      ))}

      {!loading && visibleProducts.length === 0 ? (
        <Text style={styles.helpText}>स्टॉक में उत्पाद नहीं मिला।</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  label: {
    fontFamily: typography.headingMid.family,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  inputRow: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  input: {
    flex: 1,
    fontFamily: typography.body.family,
    fontSize: 16,
    color: colors.ink,
    paddingVertical: spacing.sm,
  },
  productRow: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
  },
  productRowPressed: {
    backgroundColor: colors.primaryWash,
  },
  productRowDisabled: {
    opacity: 0.5,
  },
  productText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  productSku: {
    fontFamily: typography.body.family,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  productMeta: {
    fontFamily: typography.body.family,
    fontSize: 13,
    color: colors.inkMute,
    marginTop: 2,
  },
  addText: {
    fontFamily: typography.body.family,
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDeep,
  },
  helpText: {
    fontFamily: typography.body.family,
    fontSize: 13,
    color: colors.inkMute,
  },
});
