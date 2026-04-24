import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { t } from '@goldsmith/i18n';

type Metal = 'GOLD' | 'SILVER' | 'PLATINUM';

const PURITY_BY_METAL: Record<Metal, string[]> = {
  GOLD:     ['24K', '22K', '18K'],
  SILVER:   ['999', '925'],
  PLATINUM: ['950', '900'],
};

const PURITY_LABEL: Record<string, string> = {
  '24K': 'inventory.purity_24k',
  '22K': 'inventory.purity_22k',
  '18K': 'inventory.purity_18k',
  '999': 'inventory.purity_999',
  '925': 'inventory.purity_925',
};

interface PuritySelectorProps {
  metal: Metal | undefined;
  value: string | undefined;
  onChange: (purity: string) => void;
}

export function PuritySelector({ metal, value, onChange }: PuritySelectorProps): React.ReactElement | null {
  if (!metal) return null;
  const options = PURITY_BY_METAL[metal];
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {options.map((p) => (
        <Pressable
          key={p}
          style={[styles.btn, value === p && styles.btnActive]}
          onPress={() => onChange(p)}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === p }}
          accessibilityLabel={PURITY_LABEL[p] ? t(PURITY_LABEL[p]) : p}
          hitSlop={8}
        >
          <Text style={[styles.btnText, value === p && styles.btnTextActive]}>
            {PURITY_LABEL[p] ? t(PURITY_LABEL[p]) : p}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  btn: {
    minHeight: 48, paddingHorizontal: spacing.md, alignItems: 'center',
    justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8,
  },
  btnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  btnText: { ...typography.body, color: colors.textSecondary, fontSize: 16 },
  btnTextActive: { color: colors.primary, fontWeight: '600' },
});
