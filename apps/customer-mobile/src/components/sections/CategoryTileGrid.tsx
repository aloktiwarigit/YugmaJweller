import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground } from 'react-native';
import { router } from 'expo-router';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { STOREFRONT_CATEGORY_TILES } from '@goldsmith/customer-shared';
import { categoryTileImages, storefrontFallbackImage } from '../../assets/storefrontImages';

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
          <ImageBackground
            source={categoryTileImages[tile.key] ?? storefrontFallbackImage}
            resizeMode="cover"
            style={styles.imageWrap}
            imageStyle={styles.tileImage}
          >
            <View style={styles.labelBand}>
              <Text numberOfLines={2} style={styles.label}>{tile.labelHi}</Text>
            </View>
          </ImageBackground>
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
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  imageWrap: {
    width:           '100%',
    height:          90,
    borderRadius:    radii.md,
    backgroundColor: colors.white,
    borderWidth:     1,
    borderColor:     colors.borderSubtle,
    overflow:        'hidden',
    justifyContent:  'flex-end',
  },
  tileImage: {
    borderRadius: radii.md,
  },
  labelBand: {
    backgroundColor: 'rgba(30,36,64,0.66)',
    minHeight:       25,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 4,
  },
  label: {
    fontFamily: typography.body.family,
    fontSize:   11,
    lineHeight: 14,
    color:      colors.white,
    textAlign:  'center',
  },
});
