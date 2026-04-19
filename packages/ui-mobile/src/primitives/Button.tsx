import React from 'react';
import { Pressable, Text } from 'react-native';
import { colors, typography, radii, spacing } from '@goldsmith/ui-tokens';

export interface ButtonProps {
  /** MUST be pre-translated — caller passes t('key') */
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  testID,
}: ButtonProps): React.ReactElement {
  const bg = variant === 'primary' ? colors.primary : 'transparent';
  const borderColor = variant === 'secondary' ? colors.border : 'transparent';
  const fg = colors.ink;
  return (
    <Pressable
      onPress={disabled === true || loading === true ? undefined : onPress}
      disabled={disabled === true || loading === true}
      testID={testID}
      accessibilityRole="button"
      style={{
        minHeight: 48,
        minWidth: 48,
        borderRadius: radii.md,
        paddingHorizontal: spacing.md,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor,
        opacity: disabled === true ? 0.5 : 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: typography.body.family, fontSize: 18, color: fg }}>{label}</Text>
    </Pressable>
  );
}
