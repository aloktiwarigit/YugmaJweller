import React from 'react';
import { View, Text } from 'react-native';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';

export function LoyaltyPointsCard(): React.ReactElement {
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: radii.md,
        padding: spacing.md,
        marginHorizontal: spacing.lg,
        marginVertical: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text
        style={{ fontFamily: typography.headingMid.family, fontSize: 16, color: colors.ink }}
      >
        वफ़ादारी अंक
      </Text>
      <Text
        style={{
          fontFamily: typography.body.family,
          fontSize: 13,
          color: colors.inkMute,
          marginTop: spacing.xs,
        }}
      >
        फ़ोन OTP लॉगिन के बाद उपलब्ध। (Available after phone OTP login.)
      </Text>
    </View>
  );
}
