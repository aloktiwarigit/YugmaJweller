import React from 'react';
import { TextInput } from 'react-native';
import { colors, typography, radii, spacing } from '@goldsmith/ui-tokens';

export interface InputProps {
  value: string;
  onChangeText: (v: string) => void;
  /** Must be pre-translated */
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
  maxLength?: number;
  testID?: string;
  /** Must be pre-translated */
  accessibilityLabel?: string;
}

export function Input({
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  maxLength,
  testID,
  accessibilityLabel,
}: InputProps): React.ReactElement {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      keyboardType={keyboardType}
      maxLength={maxLength}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      placeholderTextColor={colors.inkMute}
      style={{
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
      }}
    />
  );
}
