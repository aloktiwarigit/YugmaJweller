import React from 'react';
import { Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@goldsmith/ui-tokens';

export interface ToastProps {
  /** Pre-translated message */
  message: string;
  variant?: 'info' | 'error';
  testID?: string;
}

export function Toast({ message, variant = 'info', testID }: ToastProps): React.ReactElement {
  const bg = variant === 'error' ? colors.error : colors.ink;
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={{
        backgroundColor: bg,
        borderRadius: radii.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        minHeight: 48,
      }}
    >
      <Text style={{ color: colors.bg, fontFamily: typography.body.family, fontSize: 16 }}>
        {message}
      </Text>
    </View>
  );
}
