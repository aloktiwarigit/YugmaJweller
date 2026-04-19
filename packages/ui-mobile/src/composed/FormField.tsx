import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';

export interface FormFieldProps {
  /** Must be pre-translated */
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  /** Must be pre-translated */
  placeholder?: string;
  /** Must be pre-translated */
  error?: string;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
  maxLength?: number;
  testID?: string;
}

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType = 'default',
  maxLength,
  testID,
}: FormFieldProps): React.ReactElement {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        maxLength={maxLength}
        testID={testID ? `${testID}-input` : undefined}
        accessibilityLabel={label}
        placeholderTextColor={colors.inkMute}
        style={styles.input}
      />
      {error ? (
        <Text style={styles.error} testID={testID ? `${testID}-error` : undefined}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    color: colors.inkMute,
    marginBottom: spacing.xs,
    fontFamily: typography.body.family,
  },
  input: {
    minHeight: 48,
    minWidth: 48,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.ink,
    backgroundColor: colors.bg,
    fontFamily: typography.body.family,
    fontSize: 18,
  },
  error: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.error,
    fontFamily: typography.body.family,
  },
});
