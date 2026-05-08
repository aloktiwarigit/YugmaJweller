import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { STOREFRONT_CATEGORY_TILES } from '@goldsmith/customer-shared';

// Icon glyphs — Unicode symbols as stand-ins for SVG icons.
// TODO(Phase-E): replace with react-native-svg icon set
const ICON_MAP: Record<string, string> = {
  rings:       '💍',
  earrings:    '✨',
  pendants:    '📿',
  bangles:     '⭕',
  necklaces:   '🔗',
  mangalsutra: '❤️',
  bracelets:   '🔮',
  silver:      '⬜',
};

interface Props {
  columns?: 2 | 4;
}

export function CategoryTileGrid({ columns = 4 }: Props): React.ReactElement {
  function navigate(href: string): void {
    const mobilePath = href
      .replace('/products?', '/(tabs)/browse?')
      .replace('/products', '/(tabs)/browse');
    router.push(mobilePath as Parameters<typeof router.push>[0]);
  }

  return (
    <View style={styles.grid}>
      {STOREFRONT_CATEGORY_TILES.map((tile) => (
        <TouchableOpacity
          key={tile.key}
          onPress={() => navigate(tile.href)}
          style={[styles.tile, { width: `${100 / columns}%` as unknown as number }]}
          accessibilityRole="button"
          accessibilityLabel={tile.labelHi}
        >
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>{ICON_MAP[tile.key] ?? '💎'}</Text>
          </View>
          <Text style={styles.label}>{tile.labelHi}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
  },
  tile: {
    alignItems:    'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
  },
  iconWrap: {
    width:           52,
    height:          52,
    borderRadius:    radii.md,
    backgroundColor: colors.surface,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     colors.borderSubtle,
    marginBottom:    spacing.xs,
  },
  icon: {
    fontSize: 24,
  },
  label: {
    fontFamily: typography.body.family,
    fontSize:   12,
    color:      colors.ink,
    textAlign:  'center',
  },
});
