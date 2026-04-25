import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { InvoiceItemResponse } from '@goldsmith/shared';
import { colors, spacing } from '@goldsmith/ui-tokens';

function paiseToRupees(paise: string): string {
  const n = Number(paise) / 100;
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function InvoiceLineItem({ item }: { item: InvoiceItemResponse }): JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={[styles.description, styles.devanagari]}>
        {item.description}
      </Text>
      {item.huid != null && (
        <Text style={styles.huid}>HUID: {item.huid}</Text>
      )}
      {item.netWeightG != null && (
        <Text style={styles.weight}>
          {item.netWeightG} ग्राम · {item.purity}
        </Text>
      )}
      <View style={styles.breakdown}>
        <Text style={styles.lineSecondary}>सोना: ₹{paiseToRupees(item.goldValuePaise)}</Text>
        <Text style={styles.lineSecondary}>मेकिंग: ₹{paiseToRupees(item.makingChargePaise)}</Text>
        <Text style={styles.lineSecondary}>
          GST (3%+5%): ₹{paiseToRupees(item.gstMetalPaise)} + ₹{paiseToRupees(item.gstMakingPaise)}
        </Text>
      </View>
      <Text style={[styles.lineTotal, styles.devanagari]}>
        ₹{paiseToRupees(item.lineTotalPaise)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
  },
  description: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: colors.textPrimary,
  },
  huid: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  weight: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  breakdown: {
    marginTop: spacing.sm,
  },
  lineSecondary: {
    fontSize: 12,
    color: colors.inkMute,
  },
  lineTotal: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.sm,
    color: colors.primary,
  },
  devanagari: {
    fontFamily: 'NotoSansDevanagari',
  },
});
