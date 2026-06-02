import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { t } from '@goldsmith/i18n';
import {
  BODY_PARTS,
  type BodyPart,
  presetsForBodyPart,
  mmLabelKeyForBodyPart,
  bodyPartLabelKey,
} from '../tryOnPresets';

export interface TryOnFieldValue {
  bodyPart: BodyPart | undefined;
  /** mm as a string (keeps the controlled-input pattern used elsewhere). */
  mm: string;
}

interface Props {
  value: TryOnFieldValue;
  onChange: (next: TryOnFieldValue) => void;
}

export function TryOnDimensionsField({ value, onChange }: Props): React.ReactElement {
  return (
    <View style={styles.wrap}>
      <Text style={styles.section}>{t('inventory.tryon_section')}</Text>
      <Text style={styles.label}>{t('inventory.tryon_bodypart_label')}</Text>

      <View style={styles.chipRow}>
        {BODY_PARTS.map((part) => {
          const selected = value.bodyPart === part;
          const label = t(bodyPartLabelKey(part));
          return (
            <Pressable
              key={part}
              testID={`bodypart-${part}`}
              onPress={() => onChange({ bodyPart: part, mm: value.bodyPart === part ? value.mm : '' })}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={label}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {value.bodyPart != null && (
        <>
          <Text style={styles.label}>{t(mmLabelKeyForBodyPart(value.bodyPart))}</Text>
          <View style={styles.presetRow}>
            {presetsForBodyPart(value.bodyPart).map((p) => (
              <Pressable
                key={p.labelKey}
                testID={`preset-${p.mm}`}
                onPress={() => onChange({ bodyPart: value.bodyPart, mm: String(p.mm) })}
                accessibilityRole="button"
                accessibilityLabel={t(p.labelKey)}
                style={styles.presetChip}
              >
                <Text style={styles.presetChipText}>{t(p.labelKey)} · {p.mm}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            testID="tryon-mm-input"
            style={styles.input}
            value={value.mm}
            onChangeText={(v) => onChange({ bodyPart: value.bodyPart, mm: v.replace(/[^\d.]/g, '') })}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel={t(mmLabelKeyForBodyPart(value.bodyPart))}
          />
          <Text style={styles.hint}>{t('inventory.tryon_mm_hint')}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg, gap: spacing.xs },
  section: { ...typography.body, color: colors.textPrimary, fontSize: 18, fontWeight: '600' },
  label: { ...typography.body, color: colors.textSecondary, fontSize: 16, marginTop: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    minHeight: 48, paddingHorizontal: spacing.md, justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: 24, backgroundColor: colors.white,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 15, color: colors.textPrimary },
  chipTextSelected: { color: colors.white, fontWeight: '600' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  presetChip: {
    minHeight: 44, paddingHorizontal: spacing.sm, justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.background,
  },
  presetChipText: { fontSize: 14, color: colors.textPrimary },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    padding: spacing.sm, minHeight: 48, fontSize: 16, color: colors.textPrimary,
  },
  hint: { fontSize: 13, color: colors.textSecondary },
});
