import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { STOREFRONT_GIFT_PERSONAS } from '@goldsmith/customer-shared';

import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { RateCard } from '../../src/components/RateCard';
import { ProductCard } from '../../src/components/ProductCard';
import { StorefrontDrawer } from '../../src/components/StorefrontDrawer';
import { CategoryChipRail } from '../../src/components/CategoryChipRail';
import { HeroSection } from '../../src/components/sections/HeroSection';
import { CategoryTileGrid } from '../../src/components/sections/CategoryTileGrid';
import { StorefrontPromise } from '../../src/components/sections/StorefrontPromise';

import { getCatalogProducts } from '../../src/api/endpoints';
import { useTenantStore } from '../../src/stores/tenantStore';
import type { CatalogProductCard } from '@goldsmith/customer-shared';

// ── Section heading ────────────────────────────────────────────────────────────

interface SectionHeadingProps {
  titleHi:     string;
  eyebrowEn?:  string;
  onSeeAll?:   () => void;
}

function SectionHeading({ titleHi, eyebrowEn, onSeeAll }: SectionHeadingProps): React.ReactElement {
  return (
    <View style={styles.sectionHeader}>
      <View>
        {eyebrowEn && <Text style={styles.eyebrow}>{eyebrowEn}</Text>}
        <Text style={styles.sectionTitle}>{titleHi}</Text>
      </View>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} accessibilityRole="button" accessibilityLabel="सभी देखें">
          <Text style={styles.seeAll}>सभी देखें →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Rate strip (3-card horizontal snap) ────────────────────────────────────────

function RateStrip(): React.ReactElement {
  return (
    <View style={styles.rateStripWrap}>
      <RateCard />
    </View>
  );
}

// ── Product horizontal carousel ────────────────────────────────────────────────

interface ProductRowProps {
  products: CatalogProductCard[];
}

function ProductRow({ products }: ProductRowProps): React.ReactElement {
  const { width } = useWindowDimensions();
  const cardWidth = width * 0.44;

  return (
    <FlatList
      data={products}
      keyExtractor={(p) => p.id}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + spacing.sm}
      decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() =>
            router.push(
              `/browse/${item.id}` as Parameters<typeof router.push>[0],
            )
          }
          accessibilityRole="button"
          accessibilityLabel={item.categoryName ?? 'उत्पाद'}
        >
          <ProductCard product={item} cardWidth={cardWidth} />
        </TouchableOpacity>
      )}
    />
  );
}

// ── Gift persona chips (horizontal) ────────────────────────────────────────────

function GiftPersonasRow(): React.ReactElement {
  return (
    <View>
      {/* TODO(Phase-E): Fraunces Italic eyebrow font not yet bundled; using system italic */}
      <Text style={styles.giftEyebrow}>Gift / उपहार</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
      >
        {STOREFRONT_GIFT_PERSONAS.map((persona) => {
          function navigate(): void {
            const mobilePath = persona.href
              .replace('/products?', '/(tabs)/browse?')
              .replace('/products', '/(tabs)/browse');
            router.push(mobilePath as Parameters<typeof router.push>[0]);
          }
          return (
            <TouchableOpacity
              key={persona.key}
              onPress={navigate}
              style={styles.personaChip}
              accessibilityRole="button"
              accessibilityLabel={persona.labelHi}
            >
              <Text style={styles.personaLabel}>{persona.labelHi}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Everyday collection grid (compact 2×3 tiles) ───────────────────────────────

const EVERYDAY_LINKS = [
  { labelHi: 'रोज़ाना',    href: '/products?style=DAILY_WEAR'    },
  { labelHi: 'ऑफिस',      href: '/products?style=OFFICE'        },
  { labelHi: 'मंदिर',     href: '/products?style=TEMPLE'        },
  { labelHi: 'सादा',      href: '/products?style=DAILY_WEAR'    },
  { labelHi: 'स्टूड्स',   href: '/products?search=studs'        },
  { labelHi: 'हल्के हार', href: '/products?search=necklace'     },
] as const;

function EverydayCollectionGrid(): React.ReactElement {
  return (
    <View style={styles.everydayGrid}>
      {EVERYDAY_LINKS.map((link) => {
        function navigate(): void {
          const mobilePath = link.href
            .replace('/products?', '/(tabs)/browse?')
            .replace('/products', '/(tabs)/browse');
          router.push(mobilePath as Parameters<typeof router.push>[0]);
        }
        return (
          <TouchableOpacity
            key={link.labelHi}
            onPress={navigate}
            style={styles.everydayTile}
            accessibilityRole="button"
            accessibilityLabel={link.labelHi}
          >
            <Text style={styles.everydayLabel}>{link.labelHi}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Premium strip ──────────────────────────────────────────────────────────────

const PREMIUM_LINKS = [
  { labelHi: 'ब्राइडल कलेक्शन',    href: '/products?style=BRIDAL'    },
  { labelHi: 'डायमंड सेट',          href: '/products?search=diamond'  },
  { labelHi: 'हेवी नेकलेस',         href: '/products?search=necklace' },
  { labelHi: 'स्टेटमेंट ज्वेलरी',  href: '/products?style=STATEMENT' },
] as const;

function PremiumStrip(): React.ReactElement {
  return (
    <View style={styles.premiumContainer}>
      <Text style={styles.premiumTitle}>प्रीमियम कलेक्शन</Text>
      <Text style={styles.premiumSubtitle}>खास मौकों के लिए बेहतरीन</Text>
      <View style={styles.premiumLinks}>
        {PREMIUM_LINKS.map((link) => {
          function navigate(): void {
            const mobilePath = link.href
              .replace('/products?', '/(tabs)/browse?')
              .replace('/products', '/(tabs)/browse');
            router.push(mobilePath as Parameters<typeof router.push>[0]);
          }
          return (
            <TouchableOpacity
              key={link.labelHi}
              onPress={navigate}
              style={styles.premiumLink}
              accessibilityRole="button"
              accessibilityLabel={link.labelHi}
            >
              <Text style={styles.premiumLinkText}>{link.labelHi} →</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Footer accordion (collapsed) ──────────────────────────────────────────────

const FOOTER_COLS = [
  { title: 'खरीदारी',  links: ['सोना', 'हीरा', 'चाँदी', 'ब्राइडल'] },
  { title: 'सहायता',   links: ['हमसे संपर्क करें', 'वापसी नीति', 'ट्रैक ऑर्डर'] },
  { title: 'कंपनी',    links: ['हमारे बारे में', 'करियर', 'प्रेस'] },
] as const;

function FooterAccordion(): React.ReactElement {
  const [openCol, setOpenCol] = useState<string | null>(null);
  return (
    <View style={styles.footer}>
      {FOOTER_COLS.map((col) => {
        const isOpen = openCol === col.title;
        return (
          <View key={col.title} style={styles.footerCol}>
            <TouchableOpacity
              onPress={() => setOpenCol(isOpen ? null : col.title)}
              style={styles.footerColHeader}
              accessibilityRole="button"
              accessibilityLabel={col.title}
              accessibilityState={{ expanded: isOpen }}
            >
              <Text style={styles.footerColTitle}>{col.title}</Text>
              <Text style={styles.footerChevron}>{isOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {isOpen && (
              <View style={styles.footerLinks}>
                {col.links.map((link) => (
                  <Text key={link} style={styles.footerLink}>{link}</Text>
                ))}
              </View>
            )}
          </View>
        );
      })}
      <Text style={styles.footerCopyright}>
        © 2026 · BIS लाइसेंस धारक · सभी अधिकार सुरक्षित
      </Text>
    </View>
  );
}

// ── Main Home screen ───────────────────────────────────────────────────────────

export default function Home(): React.ReactElement {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const slug = useTenantStore((s) => s.slug);

  const newArrivals = useQuery({
    queryKey: ['catalog-products', slug, 'new-arrivals'],
    queryFn:  () => getCatalogProducts({ limit: 8 }),
    retry:    false,
    staleTime: 5 * 60 * 1000,
  });

  const topSellers = useQuery({
    queryKey: ['catalog-products', slug, 'top-sellers'],
    queryFn:  () => getCatalogProducts({ limit: 8 }),
    retry:    false,
    staleTime: 5 * 60 * 1000,
  });

  const newArrivalItems = (newArrivals.data?.items ?? []) as CatalogProductCard[];
  const topSellerItems  = (topSellers.data?.items ?? []) as CatalogProductCard[];

  return (
    <View style={styles.root}>
      {/* Section 0: Brand header (above scroll) */}
      <TenantBrandHeader />

      {/* Section 0b: Persistent chip rail (above scroll) */}
      <CategoryChipRail onOpenDrawer={() => setDrawerOpen(true)} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: Hero */}
        <HeroSection />

        {/* Section 2: Rate strip */}
        <View style={styles.sectionGap}>
          <SectionHeading titleHi="आज की दर" eyebrowEn="Live Rates" />
          <RateStrip />
        </View>

        {/* Section 3: Shop by category */}
        <View style={styles.sectionGap}>
          <SectionHeading titleHi="श्रेणी अनुसार" eyebrowEn="Browse" />
          <CategoryTileGrid columns={4} />
        </View>

        {/* Section 4: New arrivals */}
        {newArrivalItems.length > 0 && (
          <View style={styles.sectionGap}>
            <SectionHeading
              titleHi="नई कलेक्शन"
              eyebrowEn="New Arrivals"
              onSeeAll={() => router.push('/(tabs)/browse' as Parameters<typeof router.push>[0])}
            />
            <ProductRow products={newArrivalItems} />
          </View>
        )}

        {/* Section 5: Spotlight — hidden until curation is configured */}
        {/* hasCuration: false — rendered server-side once storefront-config ships (D4) */}

        {/* Section 6: Gift personas */}
        <View style={styles.sectionGap}>
          <SectionHeading titleHi="प्रियजनों के लिए" eyebrowEn="Gift by Person" />
          <GiftPersonasRow />
        </View>

        {/* Section 7: Top sellers */}
        {topSellerItems.length > 0 && (
          <View style={styles.sectionGap}>
            <SectionHeading titleHi="टॉप सेलर" eyebrowEn="Best Selling" />
            <ProductRow products={topSellerItems} />
          </View>
        )}

        {/* Section 8: Everyday collection */}
        <View style={styles.sectionGap}>
          <SectionHeading titleHi="रोज़मर्रा की पसंद" eyebrowEn="Everyday" />
          <EverydayCollectionGrid />
        </View>

        {/* Section 9: Premium strip */}
        <View style={styles.sectionGap}>
          <PremiumStrip />
        </View>

        {/* Section 10: Recommended — hidden until API delivers data (D4) */}

        {/* Section 11: Promise pillars */}
        <View style={styles.sectionGap}>
          <StorefrontPromise />
        </View>

        {/* Section 12: Footer */}
        <FooterAccordion />
      </ScrollView>

      {/* Storefront drawer (D5) */}
      <StorefrontDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  sectionGap: {
    marginTop: spacing.lg,
  },
  // Section headings
  sectionHeader: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'flex-end',
    paddingHorizontal: spacing.lg,
    marginBottom:    spacing.sm,
  },
  eyebrow: {
    fontFamily:    typography.body.family,
    fontSize:      11,
    color:         colors.inkSoft,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontFamily: typography.display.family,
    fontSize:   22,
    color:      colors.ink,
  },
  seeAll: {
    fontFamily: typography.body.family,
    fontSize:   13,
    color:      colors.primary,
  },
  // Rate strip
  rateStripWrap: {
    paddingHorizontal: 0,
  },
  // Gift eyebrow
  giftEyebrow: {
    fontFamily:    typography.body.family,
    fontSize:      12,
    fontStyle:     'italic',
    color:         colors.inkSoft,
    paddingHorizontal: spacing.lg,
    marginBottom:  spacing.sm,
  },
  // Persona chip
  personaChip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius:    radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight:       48,
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     colors.borderSubtle,
  },
  personaLabel: {
    fontFamily: typography.headingMid.family,
    fontSize:   13,
    color:      colors.ink,
  },
  // Everyday grid
  everydayGrid: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    paddingHorizontal: spacing.lg,
    gap:            spacing.sm,
  },
  everydayTile: {
    width:           '30%',
    backgroundColor: colors.surfaceElevated,
    borderRadius:    radii.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     colors.borderSubtle,
    minHeight:       48,
    justifyContent:  'center',
  },
  everydayLabel: {
    fontFamily: typography.body.family,
    fontSize:   12,
    color:      colors.ink,
    textAlign:  'center',
  },
  // Premium strip
  premiumContainer: {
    backgroundColor: colors.ink,
    marginHorizontal: spacing.lg,
    borderRadius:    radii.lg,
    padding:         spacing.lg,
  },
  premiumTitle: {
    fontFamily:   typography.display.family,
    fontSize:     24,
    color:        colors.bg,
    marginBottom: 4,
  },
  premiumSubtitle: {
    fontFamily:   typography.body.family,
    fontSize:     13,
    color:        colors.inkMute,
    marginBottom: spacing.md,
  },
  premiumLinks: {
    gap: spacing.sm,
  },
  premiumLink: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(217,201,168,0.2)',
    minHeight:       44,
    justifyContent:  'center',
  },
  premiumLinkText: {
    fontFamily: typography.headingMid.family,
    fontSize:   14,
    color:      colors.primaryWash,
  },
  // Footer
  footer: {
    backgroundColor: colors.surfaceRecessed,
    padding:         spacing.lg,
    marginTop:       spacing.lg,
  },
  footerCol: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  footerColHeader: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingVertical: 14,
    minHeight:       48,
  },
  footerColTitle: {
    fontFamily: typography.headingMid.family,
    fontSize:   14,
    color:      colors.ink,
  },
  footerChevron: {
    color:    colors.inkMute,
    fontSize: 12,
  },
  footerLinks: {
    paddingBottom: spacing.sm,
    gap:           spacing.xs,
  },
  footerLink: {
    fontFamily:  typography.body.family,
    fontSize:    13,
    color:       colors.inkMute,
    paddingVertical: 4,
  },
  footerCopyright: {
    fontFamily:  typography.body.family,
    fontSize:    11,
    color:       colors.inkSoft,
    textAlign:   'center',
    marginTop:   spacing.lg,
  },
});
