import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { RateCard } from '../../src/components/RateCard';
import { CategoryRow } from '../../src/components/CategoryRow';
import { ProductGrid } from '../../src/components/ProductGrid';

export default function Home(): React.ReactElement {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TenantBrandHeader />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <RateCard />
        <Text
          style={{
            fontFamily: typography.headingMid.family,
            fontSize: 18,
            color: colors.ink,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
          }}
        >
          श्रेणियाँ
        </Text>
        <CategoryRow />
        <Text
          style={{
            fontFamily: typography.headingMid.family,
            fontSize: 18,
            color: colors.ink,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
          }}
        >
          चुनिंदा उत्पाद
        </Text>
        <ProductGrid />
      </ScrollView>
    </View>
  );
}
