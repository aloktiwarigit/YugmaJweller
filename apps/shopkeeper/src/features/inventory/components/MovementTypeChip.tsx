import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, typography } from '@goldsmith/ui-tokens';
import type { MovementType } from '@goldsmith/shared';

const LABELS: Record<MovementType, { hi: string; fg: string; bg: string }> = {
  PURCHASE:        { hi: 'खरीद',    fg: '#0F5132', bg: '#D1E7DD' },
  SALE:            { hi: 'बिक्री',  fg: '#084298', bg: '#CFE2FF' },
  ADJUSTMENT_IN:   { hi: 'जोड़',    fg: '#664D03', bg: '#FFF3CD' },
  ADJUSTMENT_OUT:  { hi: 'घटाव',    fg: '#842029', bg: '#F8D7DA' },
  TRANSFER_IN:     { hi: 'प्राप्त', fg: '#055160', bg: '#CFF4FC' },
  TRANSFER_OUT:    { hi: 'भेजा',    fg: '#52306B', bg: '#E0CFFC' },
};

interface Props {
  type: MovementType;
}

export function MovementTypeChip({ type }: Props): React.ReactElement {
  const meta = LABELS[type];
  return (
    <View
      style={[styles.chip, { backgroundColor: meta.bg }]}
      accessibilityLabel={meta.hi}
    >
      <Text style={[styles.text, { color: meta.fg }]}>{meta.hi}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    minHeight: 32,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'NotoSansDevanagari_400Regular',
  },
});
