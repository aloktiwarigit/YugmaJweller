import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { STOREFRONT_BROWSE_NAV } from '@goldsmith/customer-shared';

interface Props {
  onOpenDrawer: () => void;
}

export function CategoryChipRail({ onOpenDrawer }: Props): React.ReactElement {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  function handleChipPress(href: string, key: string): void {
    setActiveKey(key);
    const mobilePath = href
      .replace('/products?', '/(tabs)/browse?')
      .replace('/products', '/(tabs)/browse')
      .replace('/collections', '/(tabs)/browse');
    router.push(mobilePath as Parameters<typeof router.push>[0]);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* "सभी" pill — opens StorefrontDrawer */}
        <TouchableOpacity
          onPress={onOpenDrawer}
          style={styles.allPill}
          accessibilityRole="button"
          accessibilityLabel="सभी श्रेणियाँ"
        >
          <Text style={styles.allPillText}>सभी</Text>
        </TouchableOpacity>

        {STOREFRONT_BROWSE_NAV.map((item) => {
          const isActive = activeKey === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => handleChipPress(item.href, item.key)}
              style={[styles.chip, isActive && styles.chipActive]}
              accessibilityRole="button"
              accessibilityLabel={item.labelHi}
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {item.labelHi}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceRecessed,
    paddingVertical: 8,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    gap:               spacing.xs,
    alignItems:        'center',
  },
  allPill: {
    backgroundColor: colors.primaryDeep,
    borderRadius:    radii.pill,
    paddingHorizontal: spacing.md,
    height:          36,
    justifyContent:  'center',
    marginRight:     spacing.xs,
  },
  allPillText: {
    fontFamily: typography.headingMid.family,
    fontSize:   13,
    color:      colors.white,
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius:    radii.pill,
    paddingHorizontal: spacing.md,
    height:          36,
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     colors.border,
    marginRight:     spacing.xs,
  },
  chipActive: {
    backgroundColor: colors.primaryDeep,
    borderColor:     colors.primaryDeep,
  },
  chipText: {
    fontFamily: typography.headingMid.family,
    fontSize:   13,
    color:      colors.ink,
  },
  chipTextActive: {
    color: colors.white,
  },
});
