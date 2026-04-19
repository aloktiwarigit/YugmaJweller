import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { Input } from '../primitives/Input';

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
      <Input
        value={value}
        onChangeText={onChangeText}
        {...(placeholder !== undefined ? { placeholder } : {})}
        keyboardType={keyboardType}
        {...(maxLength !== undefined ? { maxLength } : {})}
        {...(testID !== undefined ? { testID: `${testID}-input` } : {})}
        accessibilityLabel={label}
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
  error: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: colors.error ?? '#B91C1C',
    fontFamily: typography.body.family,
  },
});
