import React from 'react';
import { View, Text } from 'react-native';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';

export function ComingSoon(): React.ReactElement {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
      <Text
        style={{
          fontFamily: typography.display.family,
          fontSize: 22,
          color: colors.ink,
          marginBottom: spacing.xs,
        }}
      >
        जल्द आ रहा है
      </Text>
      <Text
        style={{
          fontFamily: typography.body.family,
          fontSize: 14,
          color: colors.inkMute,
        }}
      >
        Coming soon
      </Text>
    </View>
  );
}
