import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { computeProductPrice } from '@goldsmith/money';
import { colors, spacing } from '@goldsmith/ui-tokens';

export interface BillingLineProduct {
  id: string;
  metal: string;
  purity: string;
  netWeightG: string;
  huid: string | null;
  description: string;
}

export interface BillingLineValue {
  productId: string;
  description: string;
  huid: string | null;
  makingChargePct: string;
}

export interface BillingLineBuilderProps {
  product: BillingLineProduct;
  ratePerGramPaise: bigint;
  makingChargePct: string;
  onChange: (next: BillingLineValue) => void;
}

export function BillingLineBuilder({
  product,
  ratePerGramPaise,
  makingChargePct,
  onChange,
}: BillingLineBuilderProps): JSX.Element {
  const [pct, setPct] = useState<string>(makingChargePct);

  const priceTotal = useMemo<string>(() => {
    try {
      const result = computeProductPrice({
        netWeightG: product.netWeightG,
        ratePerGramPaise,
        makingChargePct: pct,
        stoneChargesPaise: 0n,
        hallmarkFeePaise: 0n,
      });
      return result.totalFormatted;
    } catch {
      return '—';
    }
  }, [product.netWeightG, ratePerGramPaise, pct]);

  const handlePctChange = useCallback(
    (text: string) => {
      setPct(text);
      onChange({
        productId: product.id,
        description: product.description,
        huid: product.huid,
        makingChargePct: text,
      });
    },
    [product.id, product.description, product.huid, onChange],
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.description, { fontFamily: 'NotoSansDevanagari' }]}>
        {product.description}
      </Text>
      <Text style={styles.meta}>
        {product.netWeightG} ग्राम · {product.purity}
      </Text>
      {product.huid !== null && (
        <Text style={styles.huid}>HUID: {product.huid}</Text>
      )}
      <View style={styles.makingRow}>
        <Text style={[styles.makingLabel, { fontFamily: 'NotoSansDevanagari' }]}>
          मेकिंग चार्ज %:
        </Text>
        <TextInput
          testID="making-pct-input"
          value={pct}
          onChangeText={handlePctChange}
          keyboardType="decimal-pad"
          style={styles.pctInput}
          accessibilityLabel="Making charge percent"
        />
      </View>
      <Text style={styles.totalPrice}>
        {priceTotal}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: colors.textPrimary,
  },
  meta: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  huid: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  makingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  makingLabel: {
    fontSize: 14,
    marginRight: spacing.sm,
    color: colors.textPrimary,
  },
  pctInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    width: 80,
    fontSize: 16,
    minHeight: 48, // 48dp minimum touch target (project requirement for 45-65 shopkeeper UX)
    color: colors.textPrimary,
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: spacing.sm,
    color: colors.primary, // aged gold — warm, trust-heavy brand colour
  },
});
