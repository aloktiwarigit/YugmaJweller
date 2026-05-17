import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import {
  productDisplayName,
  formatInrFromPaise,
} from '@goldsmith/customer-shared';
import type { CatalogProductCard, CatalogImage } from '@goldsmith/customer-shared';
import { imageForCategoryName } from '../assets/storefrontImages';

function FallbackPlaceholder({ categoryName }: { categoryName: string | null }): React.ReactElement {
  const source = useMemo(() => imageForCategoryName(categoryName), [categoryName]);

  return (
    <Image
      source={source}
      contentFit="contain"
      style={[StyleSheet.absoluteFill, { borderRadius: radii.sm, backgroundColor: colors.white }]}
      accessibilityLabel={categoryName ?? 'उत्पाद'}
    />
  );
}

type RibbonVariant = 'NEW' | 'GIFT_READY' | 'LOW_STOCK';

function productRibbon(product: CatalogProductCard): RibbonVariant | null {
  if (product.quantity > 0 && product.quantity <= 3) return 'LOW_STOCK';
  const ageMs = Date.now() - new Date(product.publishedAt).getTime();
  if (ageMs < 30 * 24 * 60 * 60 * 1000) return 'NEW';
  return null;
}

const RIBBON_LABELS: Record<RibbonVariant, string> = {
  NEW:       'नया',
  GIFT_READY: 'गिफ्ट',
  LOW_STOCK: 'कम स्टॉक',
};
const RIBBON_COLORS: Record<RibbonVariant, string> = {
  NEW:       colors.accent,
  GIFT_READY: '#3B5C8A',  // infoSky
  LOW_STOCK: colors.warningSaffron,
};

interface Props {
  product: CatalogProductCard;
  cardWidth?: number;
  /** Called with (productId, newWishlistedState) after the local toggle fires */
  onWishlistPress?: (productId: string, nowWishlisted: boolean) => void;
  isWishlisted?: boolean;
}

export function ProductCard({
  product,
  cardWidth,
  onWishlistPress,
  isWishlisted = false,
}: Props): React.ReactElement {
  const { width: screenWidth } = useWindowDimensions();
  const width  = cardWidth ?? (screenWidth - spacing.lg * 2 - spacing.sm) / 2;
  const height = width * 5 / 4;  // 4:5 portrait ratio

  const ribbon = productRibbon(product);
  const isUnavailable = product.quantity === 0;
  const displayName   = productDisplayName(product);
  const img: CatalogImage | null = product.primaryImage;

  function handleWishlist(): void {
    onWishlistPress?.(product.id, !isWishlisted);
  }

  const priceText = product.estimatedPrice
    ? formatInrFromPaise(Number(product.estimatedPrice.totalPaise))
    : null;

  return (
    <View style={[styles.card, { width }]}>
      {/* Image area */}
      <View style={[styles.imageWrap, { height }]}>
        {img ? (
          <Image
            source={{ uri: img.url }}
            placeholder={{ uri: img.placeholderUrl }}
            transition={250}
            contentFit="cover"
            style={[StyleSheet.absoluteFill, { borderRadius: radii.sm }]}
            accessibilityLabel={img.alt ?? displayName}
          />
        ) : (
          <FallbackPlaceholder categoryName={product.categoryName} />
        )}

        {/* Out-of-stock overlay */}
        {isUnavailable && (
          <View style={styles.unavailableOverlay}>
            <Text style={styles.unavailableText}>उपलब्ध नहीं</Text>
          </View>
        )}

        {/* Top-left ribbon */}
        {ribbon && !isUnavailable && (
          <View style={[styles.ribbon, { backgroundColor: RIBBON_COLORS[ribbon] }]}>
            <Text style={styles.ribbonText}>{RIBBON_LABELS[ribbon]}</Text>
          </View>
        )}

        {/* Top-right wishlist heart — 44×44 touch target */}
        <TouchableOpacity
          onPress={handleWishlist}
          style={styles.wishlistBtn}
          accessibilityRole="button"
          accessibilityLabel={isWishlisted ? 'पसंदीदा से हटाएं' : 'पसंदीदा में जोड़ें'}
          accessibilityState={{ checked: isWishlisted }}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Text style={[styles.heartIcon, isWishlisted && styles.heartIconFilled]}>
            {isWishlisted ? '♥' : '♡'}
          </Text>
        </TouchableOpacity>

        {/* Bottom-left: HUID + purity pills */}
        <View style={styles.badgeRow}>
          {product.huid && (
            <View style={[styles.badge, styles.badgeJade]}>
              <Text style={[styles.badgeText, styles.badgeTextJade]}>HUID ✓</Text>
            </View>
          )}
          <View style={[styles.badge, styles.badgeGold]}>
            <Text style={styles.badgeText}>{product.purity.replace('_', ' ')}</Text>
          </View>
        </View>
      </View>

      {/* Text below image */}
      <View style={styles.meta}>
        <Text
          numberOfLines={1}
          style={styles.productName}
          accessibilityLabel={displayName}
        >
          {displayName}
        </Text>
        <Text numberOfLines={1} style={styles.sku}>
          {product.sku}
        </Text>
        {priceText && (
          <>
            <Text style={styles.price}>{priceText}</Text>
            <Text style={styles.priceCaption}>अनुमानित · आज की दर पर</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius:    radii.md,
    borderWidth:     1,
    borderColor:     colors.borderSubtle,
    overflow:        'hidden',
  },
  imageWrap: {
    position:        'relative',
    backgroundColor: colors.surfaceRecessed,
    borderTopLeftRadius:  radii.md,
    borderTopRightRadius: radii.md,
    overflow:        'hidden',
  },
  unavailableOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245,237,221,0.6)',
    alignItems:      'center',
    justifyContent:  'flex-end',
    paddingBottom:   spacing.sm,
  },
  unavailableText: {
    fontFamily:      typography.headingMid.family,
    fontSize:        12,
    color:           colors.ink,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius:    radii.pill,
    overflow:        'hidden',
  },
  ribbon: {
    position:    'absolute',
    top:         spacing.xs,
    left:        spacing.xs,
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical:   3,
  },
  ribbonText: {
    fontFamily: typography.headingMid.family,
    fontSize:   10,
    color:      colors.white,
  },
  wishlistBtn: {
    position:        'absolute',
    top:             spacing.xs,
    right:           spacing.xs,
    width:           44,
    height:          44,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius:    22,
  },
  heartIcon: {
    fontSize: 20,
    color:    colors.inkMute,
  },
  heartIconFilled: {
    color: colors.accent,
  },
  badgeRow: {
    position:        'absolute',
    bottom:          spacing.xs,
    left:            spacing.xs,
    flexDirection:   'row',
    gap:             4,
  },
  badge: {
    borderRadius:    radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeJade: {
    backgroundColor: '#DCEEE3',  // successWash
  },
  badgeGold: {
    backgroundColor: colors.primaryWash,
  },
  badgeText: {
    fontFamily: typography.body.family,
    fontSize:   10,
    color:      colors.ink,
  },
  badgeTextJade: {
    color: '#2F7D5B',  // successJade
  },
  meta: {
    padding: spacing.sm,
    gap:     2,
  },
  productName: {
    fontFamily: typography.headingMid.family,
    fontSize:   14,
    color:      colors.ink,
  },
  sku: {
    fontFamily: typography.body.family,
    fontSize:   12,
    color:      colors.inkSoft,
  },
  price: {
    fontFamily: typography.headingMid.family,
    fontSize:   15,
    color:      colors.ink,
  },
  priceCaption: {
    fontFamily: typography.body.family,
    fontSize:   11,
    color:      colors.inkSoft,
  },
});
