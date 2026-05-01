import React from 'react';
import { View, Text } from 'react-native';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import type { PublicProduct } from '../api/endpoints';

export function ProductCard({ product }: { product: PublicProduct }): React.ReactElement {
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: radii.md,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        flex: 1,
      }}
    >
      <View
        style={{
          aspectRatio: 1,
          backgroundColor: colors.border,
          borderRadius: radii.sm,
          marginBottom: spacing.xs,
        }}
      />
      <Text
        numberOfLines={2}
        style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.ink }}
      >
        {product.name}
      </Text>
    </View>
  );
}
