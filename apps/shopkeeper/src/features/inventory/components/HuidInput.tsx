import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { t } from '@goldsmith/i18n';

interface HuidInputProps {
  value: string;
  onChangeText: (val: string) => void;
  error?: string;
}

export function HuidInput({ value, onChangeText, error }: HuidInputProps): React.ReactElement {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('inventory.label_huid')}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        value={value}
        onChangeText={(v) => onChangeText(v.toUpperCase())}
        maxLength={6}
        autoCapitalize="characters"
        placeholder="AB1234"
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={t('inventory.label_huid')}
      />
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { ...typography.body, color: colors.textPrimary, marginBottom: spacing.xs, fontSize: 16 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    padding: spacing.sm, minHeight: 48, fontSize: 16,
    color: colors.textPrimary, letterSpacing: 3,
  },
  inputError: { borderColor: colors.error },
  error: { color: colors.error, fontSize: 13, marginTop: spacing.xs },
});
