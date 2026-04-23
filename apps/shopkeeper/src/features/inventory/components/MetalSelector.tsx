import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { t } from '@goldsmith/i18n';

type Metal = 'GOLD' | 'SILVER' | 'PLATINUM';
const METALS: Metal[] = ['GOLD', 'SILVER', 'PLATINUM'];

const METAL_LABEL: Record<Metal, string> = {
  GOLD: 'inventory.metal_gold',
  SILVER: 'inventory.metal_silver',
  PLATINUM: 'inventory.metal_platinum',
};

interface MetalSelectorProps {
  value: Metal | undefined;
  onChange: (metal: Metal) => void;
}

export function MetalSelector({ value, onChange }: MetalSelectorProps): React.ReactElement {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {METALS.map((m) => (
        <Pressable
          key={m}
          style={[styles.btn, value === m && styles.btnActive]}
          onPress={() => onChange(m)}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === m }}
          accessibilityLabel={t(METAL_LABEL[m])}
          hitSlop={8}
        >
          <Text style={[styles.btnText, value === m && styles.btnTextActive]}>
            {t(METAL_LABEL[m])}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  btn: {
    flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
  },
  btnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  btnText: { ...typography.body, color: colors.textSecondary, fontSize: 16 },
  btnTextActive: { color: colors.primary, fontWeight: '600' },
});
