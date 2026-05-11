import React from 'react';
import { View, Text } from 'react-native';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';

/**
 * Reviews timeline tab — placeholder.
 *
 * No customer-side endpoint exists yet to list a customer's own submitted reviews.
 * The reviews API is per-product (`GET /api/v1/reviews/products/:productId`),
 * not per-customer. Adding a customer-self listing endpoint is a backend follow-up;
 * for the demo we render a Hindi "coming soon" placeholder so the tab is visible
 * and white-label-clean.
 */
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
        जल्द ही उपलब्ध
      </Text>
      <Text
        style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute, textAlign: 'center' }}
      >
        आपकी समीक्षाएं यहां दिखेंगी (coming soon)
      </Text>
    </View>
  );
}
