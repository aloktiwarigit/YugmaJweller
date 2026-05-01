import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';

const STATIC_CATEGORIES = ['सोना', 'हीरा', 'चांदी', 'दुल्हन', 'थोक'] as const;

export function CategoryRow(): React.ReactElement {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        gap: spacing.sm,
      }}
    >
      {STATIC_CATEGORIES.map((c) => (
        <View
          key={c}
          style={{
            backgroundColor: colors.white,
            borderRadius: radii.pill,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            borderWidth: 1,
            borderColor: colors.border,
            minHeight: 44,
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: typography.body.family, color: colors.ink }}>{c}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
