import React from 'react';
import { View, Text } from 'react-native';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';

export function TimelineReviews(): React.ReactElement {
  return (
    <View
      testID="timeline-reviews-placeholder"
      style={{ alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg }}
    >
      <Text style={{ fontSize: 40, marginBottom: spacing.md }}>⭐</Text>
      <Text
        style={{
          fontFamily:   typography.display.family,
          fontSize:     18,
          fontWeight:   'bold',
          color:        colors.ink,
          textAlign:    'center',
          marginBottom: spacing.xs,
        }}
      >
        अभी कोई समीक्षा नहीं
      </Text>
      <Text
        style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute, textAlign: 'center' }}
      >
        आपकी खरीद पर दी गई समीक्षाएं यहां दिखेंगी।
      </Text>
    </View>
  );
}
