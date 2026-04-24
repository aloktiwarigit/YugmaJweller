import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';

interface WeightFieldProps {
  label: string;
  value: string;
  onChangeText: (val: string) => void;
  error?: string;
}

export function WeightField({ label, value, onChangeText, error }: WeightFieldProps): React.ReactElement {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder="0.0000"
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={label}
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
    padding: spacing.sm, minHeight: 48, fontSize: 16, color: colors.textPrimary,
  },
  inputError: { borderColor: colors.error },
  error: { color: colors.error, fontSize: 13, marginTop: spacing.xs },
});
