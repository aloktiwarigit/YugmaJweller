import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { t } from '@goldsmith/i18n';
import { HuidExemptionCategory } from '@goldsmith/compliance';

const OPTIONS: HuidExemptionCategory[] = [
  HuidExemptionCategory.None,
  HuidExemptionCategory.KundanPolkiJadau,
  HuidExemptionCategory.Under2g,
];

const OPTION_KEY: Record<HuidExemptionCategory, string> = {
  [HuidExemptionCategory.None]:             'inventory.huid_exemption_none',
  [HuidExemptionCategory.KundanPolkiJadau]: 'inventory.huid_exemption_kundan',
  [HuidExemptionCategory.Under2g]:          'inventory.huid_exemption_under2g',
};

interface HuidExemptionPickerProps {
  value: HuidExemptionCategory;
  onChange: (cat: HuidExemptionCategory) => void;
}

export function HuidExemptionPicker({ value, onChange }: HuidExemptionPickerProps): React.ReactElement {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('inventory.label_huid_exemption')}</Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {OPTIONS.map((opt) => (
          <Pressable
            key={opt}
            style={[styles.btn, value === opt && styles.btnActive]}
            onPress={() => onChange(opt)}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === opt }}
            accessibilityLabel={t(OPTION_KEY[opt])}
            hitSlop={8}
          >
            <Text style={[styles.btnText, value === opt && styles.btnTextActive]}>
              {t(OPTION_KEY[opt])}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xs, fontSize: 16 },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  btn: {
    flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: spacing.xs,
  },
  btnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  btnText: { ...typography.body, color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  btnTextActive: { color: colors.primary, fontWeight: '600' },
});
