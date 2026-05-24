import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

import { getNewArrivalProducts, getTopSellerProducts, getCollections, addToWishlist, removeFromWishlist, getWishlist } from '../../src/api/endpoints';
import type { WishlistItem } from '../../src/api/endpoints';
import { useTenantStore } from '../../src/stores/tenantStore';
import { useCustomerSession } from '../../src/hooks/useCustomerSession';
import type { CatalogProductCard, Collection } from '@goldsmith/customer-shared';
import { storefrontFallbackImage } from '../../src/assets/storefrontImages';
import {
  optimisticallySetWishlist,
  wishlistItemFromProduct,
  wishlistQueryKey,
} from '../../src/lib/wishlist-cache';

// ── Section heading ────────────────────────────────────────────────────────────

interface SectionHeadingProps {
  titleHi:     string;
  eyebrowLabel?: string;
  onSeeAll?:   () => void;
}

function SectionHeading({ titleHi, eyebrowLabel, onSeeAll }: SectionHeadingProps): React.ReactElement {
  return (
    <View style={styles.sectionHeader}>
      <View>
        {eyebrowLabel && <Text style={styles.eyebrow}>{eyebrowLabel}</Text>}
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

function HomeSearchBar(): React.ReactElement {
  const [query, setQuery] = useState('');

  function submitSearch(): void {
    const trimmed = query.trim();
    const destination = trimmed
      ? `/(tabs)/browse?search=${encodeURIComponent(trimmed)}`
      : '/(tabs)/browse';
    router.push(destination as Parameters<typeof router.push>[0]);
  }

  return (
    <View style={styles.searchWrap}>
      <TouchableOpacity
        onPress={submitSearch}
        style={styles.searchIconButton}
        accessibilityRole="button"
        accessibilityLabel="खोजें"
      >
        <Text style={styles.searchIcon}>⌕</Text>
      </TouchableOpacity>
      <TextInput
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={submitSearch}
        returnKeyType="search"
        placeholder="अंगूठी, चूड़ी, 22K, ब्राइडल खोजें"
        placeholderTextColor={colors.inkMute}
        style={styles.searchInput}
        accessibilityLabel="उत्पाद खोज"
      />
    </View>
  );
}

const SERVICE_SHORTCUTS = [
  {
    label: 'घर पर ट्राय',
    meta: '5 डिज़ाइन तक',
    href: '/try-at-home' as Parameters<typeof router.push>[0],
  },
  {
    label: 'स्टोर में देखें',
    meta: 'उपलब्धता पूछें',
    href: '/browse/support' as Parameters<typeof router.push>[0],
  },
  {
    label: 'रेट लॉक',
    meta: 'आज का भाव',
    href: '/rate-lock' as Parameters<typeof router.push>[0],
  },
  {
    label: 'BIS/HUID',
    meta: 'विश्वास प्रमाण',
    href: '/browse/policy' as Parameters<typeof router.push>[0],
  },
] as const;

function ServiceShortcutRail(): React.ReactElement {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.serviceShortcutRail}
    >
      {SERVICE_SHORTCUTS.map((shortcut) => (
        <TouchableOpacity
          key={shortcut.label}
          onPress={() => router.push(shortcut.href)}
          style={styles.serviceShortcut}
          accessibilityRole="button"
          accessibilityLabel={shortcut.label}
        >
          <Text style={styles.serviceShortcutLabel}>{shortcut.label}</Text>
          <Text style={styles.serviceShortcutMeta}>{shortcut.meta}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ── Product horizontal carousel ────────────────────────────────────────────────

interface ProductRowProps {
  products: CatalogProductCard[];
  wishlistedIds?: Set<string>;
  onWishlistPress?: (productId: string, nowWishlisted: boolean) => void;
}

function ProductRow({ products, wishlistedIds, onWishlistPress }: ProductRowProps): React.ReactElement {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(184, Math.max(156, width * 0.44));

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
          <ProductCard
            product={item}
            cardWidth={cardWidth}
            onWishlistPress={onWishlistPress}
            isWishlisted={wishlistedIds?.has(item.id) ?? false}
          />
        </TouchableOpacity>
      )}
    />
  );
}

function ProductRailStatus({ message }: { message: string }): React.ReactElement {
  return (
    <View style={styles.railStatus}>
      <Text style={styles.railStatusText}>{message}</Text>
    </View>
  );
}

function CollectionRail({ collections }: { collections: Collection[] }): React.ReactElement {
  const featured = collections.filter((collection) => collection.heroImage).slice(0, 8);
  if (featured.length === 0) return <ProductRailStatus message="कलेक्शन जल्द उपलब्ध होंगे" />;

  return (
    <FlatList
      data={featured}
      keyExtractor={(collection) => collection.id}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() =>
            router.push(
              `/(tabs)/browse?collection=${encodeURIComponent(item.slug)}` as Parameters<typeof router.push>[0],
            )
          }
          style={styles.collectionCard}
          accessibilityRole="button"
          accessibilityLabel={item.titleHi}
        >
          <Image
            source={item.heroImage ? { uri: item.heroImage.url } : storefrontFallbackImage}
            placeholder={item.heroImage?.placeholderUrl ? { uri: item.heroImage.placeholderUrl } : undefined}
            contentFit="cover"
            transition={250}
            style={StyleSheet.absoluteFill}
            accessibilityLabel={item.heroImage?.alt ?? item.titleHi}
          />
          <View style={styles.collectionScrim} />
          <View style={styles.collectionMeta}>
            <Text style={styles.collectionEyebrow}>{item.isPremium ? 'Premium edit' : 'Curated edit'}</Text>
            <Text numberOfLines={2} style={styles.collectionTitle}>{item.titleHi}</Text>
            <Text style={styles.collectionCount}>{item.productCount} designs</Text>
          </View>
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
      <Text style={styles.giftEyebrow}>उपहार</Text>
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

function PremiumStrip({ collections }: { collections: Collection[] }): React.ReactElement {
  const premiumCollections = collections
    .filter((collection) => collection.isPremium && collection.heroImage)
    .slice(0, 4);

  return (
    <View style={styles.premiumContainer}>
      <Text style={styles.premiumTitle}>प्रीमियम कलेक्शन</Text>
      <Text style={styles.premiumSubtitle}>खास मौकों के लिए बेहतरीन</Text>
      <View style={styles.premiumLinks}>
        {(premiumCollections.length > 0 ? premiumCollections : PREMIUM_LINKS).map((link) => {
          function navigate(): void {
            if ('slug' in link) {
              router.push(`/(tabs)/browse?collection=${encodeURIComponent(link.slug)}` as Parameters<typeof router.push>[0]);
              return;
            }
            const mobilePath = link.href
                .replace('/products?', '/(tabs)/browse?')
                .replace('/products', '/(tabs)/browse');
              router.push(mobilePath as Parameters<typeof router.push>[0]);
          }
          const label = 'titleHi' in link ? link.titleHi : link.labelHi;
          const count = 'productCount' in link ? `${link.productCount} designs` : 'देखें';
          return (
            <TouchableOpacity
              key={label}
              onPress={navigate}
              style={styles.premiumLink}
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <Text style={styles.premiumLinkText}>{label} →</Text>
              <Text style={styles.premiumLinkMeta}>{count}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Footer accordion (collapsed) ──────────────────────────────────────────────

interface FooterLink {
  label: string;
  href: Parameters<typeof router.push>[0];
}

const FOOTER_COLS: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: 'खरीदारी',
    links: [
      { label: 'सोना', href: '/(tabs)/browse?metal=GOLD' as Parameters<typeof router.push>[0] },
      { label: 'हीरा', href: '/(tabs)/browse?metal=DIAMOND' as Parameters<typeof router.push>[0] },
      { label: 'चाँदी', href: '/(tabs)/browse?metal=SILVER' as Parameters<typeof router.push>[0] },
      { label: 'ब्राइडल', href: '/(tabs)/browse?style=BRIDAL' as Parameters<typeof router.push>[0] },
    ],
  },
  {
    title: 'सहायता',
    links: [
      { label: 'हमसे संपर्क करें', href: '/browse/support' as Parameters<typeof router.push>[0] },
      { label: 'वापसी नीति', href: '/browse/policy' as Parameters<typeof router.push>[0] },
      { label: 'ट्रैक ऑर्डर', href: '/(tabs)/profile' as Parameters<typeof router.push>[0] },
    ],
  },
  {
    title: 'सेवाएं',
    links: [
      { label: 'साइज़ गाइड', href: '/browse/size-guide' as Parameters<typeof router.push>[0] },
      { label: 'दर-लॉक', href: '/rate-lock' as Parameters<typeof router.push>[0] },
      { label: 'ट्राई-एट-होम', href: '/try-at-home' as Parameters<typeof router.push>[0] },
    ],
  },
];

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
                  <TouchableOpacity
                    key={link.label}
                    onPress={() => router.push(link.href)}
                    style={styles.footerLinkButton}
                    accessibilityRole="button"
                    accessibilityLabel={link.label}
                  >
                    <Text style={styles.footerLink}>{link.label}</Text>
                  </TouchableOpacity>
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
  const { isAuthenticated } = useCustomerSession();
  const queryClient = useQueryClient();

  const { data: wishlistData } = useQuery({
    queryKey: wishlistQueryKey,
    queryFn:  getWishlist,
    enabled:  isAuthenticated,
    retry:    false,
    staleTime: 2 * 60 * 1000,
  });

  const wishlistedIds = new Set((wishlistData ?? []).map((w: WishlistItem) => w.productId));

  const wishlistMutation = useMutation({
    mutationFn: ({ productId, add, item }: { productId: string; add: boolean; item: WishlistItem }) =>
      add ? addToWishlist(productId, item) : removeFromWishlist(productId),
    onMutate: ({ add, item }) => optimisticallySetWishlist(queryClient, item, add),
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData<WishlistItem[]>(wishlistQueryKey, ctx?.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: wishlistQueryKey });
    },
  });

  const newArrivals = useQuery({
    queryKey: ['catalog-new-arrivals', slug],
    queryFn:  () => getNewArrivalProducts(8),
    retry:    2,
    staleTime: 5 * 60 * 1000,
  });

  const topSellers = useQuery({
    queryKey: ['catalog-top-sellers', slug],
    queryFn:  () => getTopSellerProducts(8),
    retry:    2,
    staleTime: 5 * 60 * 1000,
  });

  const collections = useQuery({
    queryKey: ['catalog-collections', slug],
    queryFn:  getCollections,
    retry:    2,
    staleTime: 10 * 60 * 1000,
  });

  const newArrivalItems = (newArrivals.data?.items ?? []) as CatalogProductCard[];
  const topSellerItems  = (topSellers.data?.items ?? []) as CatalogProductCard[];
  const collectionItems  = collections.data ?? [];

  const handleWishlistToggle = (productId: string, nowWishlisted: boolean): void => {
    if (!isAuthenticated) return;
    const product =
      newArrivalItems.find((item) => item.id === productId) ??
      topSellerItems.find((item) => item.id === productId);
    wishlistMutation.mutate({
      productId,
      add: nowWishlisted,
      item: wishlistItemFromProduct(product ?? { id: productId }),
    });
  };

  return (
    <View style={styles.root}>
      {/* Section 0: Brand header (above scroll) */}
      <TenantBrandHeader />

      {/* Section 0b: Persistent chip rail (above scroll) */}
      <CategoryChipRail onOpenDrawer={() => setDrawerOpen(true)} />

      {/* Section 0c: Search entry (above scroll, app-store style) */}
      <HomeSearchBar />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: Hero */}
        <HeroSection />

        {/* Section 1b: Service shortcuts */}
        <ServiceShortcutRail />

        {/* Section 2: Live rate utility */}
        <View style={styles.rateSection}>
          <RateStrip />
        </View>

        {/* Section 2b: Curated collections */}
        {collectionItems.length > 0 && (
          <View style={styles.sectionGap}>
            <SectionHeading
              titleHi="क्यूरेटेड कलेक्शन"
              eyebrowLabel="EDITOR'S PICKS"
              onSeeAll={() => router.push('/(tabs)/browse?sort=bestseller' as Parameters<typeof router.push>[0])}
            />
            <CollectionRail collections={collectionItems} />
          </View>
        )}

        {/* Section 3: Latest arrivals */}
        <View style={styles.sectionGap}>
          <SectionHeading
            titleHi="नए आए डिज़ाइन"
            eyebrowLabel="LATEST ARRIVALS"
            onSeeAll={() => router.push('/(tabs)/browse?sort=newest' as Parameters<typeof router.push>[0])}
          />
          {newArrivals.isLoading ? (
            <ProductRailStatus message="नई वस्तुएँ लोड हो रही हैं" />
          ) : newArrivalItems.length > 0 ? (
            <ProductRow products={newArrivalItems} wishlistedIds={wishlistedIds} onWishlistPress={handleWishlistToggle} />
          ) : (
            <ProductRailStatus message="अभी नई वस्तुएँ उपलब्ध नहीं हैं" />
          )}
        </View>

        {/* Section 4: Spotlight — hidden until curation is configured */}
        {/* hasCuration: false — rendered server-side once storefront-config ships (D4) */}

        {/* Section 5: Shop by category */}
        <View style={styles.sectionGap}>
          <SectionHeading titleHi="श्रेणी अनुसार" eyebrowLabel="खरीदारी" />
          <CategoryTileGrid columns={4} />
        </View>

        {/* Section 6: Premium strip */}
        <View style={styles.sectionGap}>
          <PremiumStrip collections={collectionItems} />
        </View>

        {/* Section 7: Gift personas */}
        <View style={styles.sectionGap}>
          <SectionHeading titleHi="प्रियजनों के लिए" eyebrowLabel="उपहार" />
          <GiftPersonasRow />
        </View>

        {/* Section 8: Top sellers */}
        {topSellerItems.length > 0 && (
          <View style={styles.sectionGap}>
            <SectionHeading titleHi="टॉप सेलर" eyebrowLabel="लोकप्रिय" />
            <ProductRow products={topSellerItems} wishlistedIds={wishlistedIds} onWishlistPress={handleWishlistToggle} />
          </View>
        )}

        {/* Section 9: Everyday collection */}
        <View style={styles.sectionGap}>
          <SectionHeading titleHi="रोज़मर्रा की पसंद" eyebrowLabel="रोज़मर्रा" />
          <EverydayCollectionGrid />
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
  searchWrap: {
    flexDirection:    'row',
    alignItems:      'center',
    marginHorizontal: spacing.md,
    marginTop:       spacing.sm,
    marginBottom:    spacing.xs,
    minHeight:       48,
    borderRadius:    radii.md,
    borderWidth:     1,
    borderColor:     colors.border,
    backgroundColor: colors.surface,
    overflow:        'hidden',
  },
  searchIconButton: {
    width:          46,
    minHeight:      48,
    alignItems:     'center',
    justifyContent: 'center',
  },
  searchIcon: {
    fontSize:  20,
    color:     colors.primaryDeep,
  },
  searchInput: {
    flex:       1,
    minHeight:  48,
    fontFamily: typography.body.family,
    fontSize:   14,
    color:      colors.ink,
    paddingRight: spacing.sm,
  },
  rateSection: {
    marginTop: spacing.md,
  },
  serviceShortcutRail: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.sm,
    gap:               spacing.sm,
  },
  serviceShortcut: {
    width:           132,
    minHeight:       66,
    borderRadius:    radii.md,
    borderWidth:     1,
    borderColor:     colors.borderSubtle,
    backgroundColor: colors.surfaceElevated,
    padding:         spacing.sm,
    justifyContent:  'center',
  },
  serviceShortcutLabel: {
    fontFamily: typography.headingMid.family,
    fontSize:   13,
    color:      colors.ink,
  },
  serviceShortcutMeta: {
    fontFamily: typography.body.family,
    fontSize:   11,
    color:      colors.inkMute,
    marginTop:  2,
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
  railStatus: {
    marginHorizontal: spacing.lg,
    minHeight:        132,
    borderRadius:     radii.md,
    borderWidth:      1,
    borderColor:      colors.borderSubtle,
    backgroundColor:  colors.surfaceElevated,
    alignItems:       'center',
    justifyContent:   'center',
    padding:          spacing.lg,
  },
  railStatusText: {
    fontFamily: typography.body.family,
    fontSize:   13,
    color:      colors.inkMute,
    textAlign:  'center',
  },
  collectionCard: {
    width:          216,
    height:         156,
    borderRadius:   radii.md,
    overflow:       'hidden',
    backgroundColor: colors.ink,
    borderWidth:    1,
    borderColor:    colors.borderSubtle,
  },
  collectionScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(22,24,36,0.28)',
  },
  collectionMeta: {
    position:       'absolute',
    left:           spacing.md,
    right:          spacing.md,
    bottom:         spacing.md,
  },
  collectionEyebrow: {
    fontFamily:    typography.body.family,
    fontSize:      10,
    color:         'rgba(255,255,255,0.78)',
    textTransform: 'uppercase',
    marginBottom:  3,
  },
  collectionTitle: {
    fontFamily: typography.display.family,
    fontSize:   21,
    lineHeight: 25,
    color:      colors.white,
  },
  collectionCount: {
    fontFamily: typography.body.family,
    fontSize:   11,
    color:      colors.primaryWash,
    marginTop:  4,
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
    // inkMute (#4A526E) is invisible on the ink (#1E2440) container — use the
    // cream foreground at reduced opacity to keep hierarchy under the title.
    color:        'rgba(245, 237, 221, 0.72)',
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
  premiumLinkMeta: {
    fontFamily: typography.body.family,
    fontSize:   11,
    color:      'rgba(245,237,221,0.62)',
    marginTop:  2,
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
  footerLinkButton: {
    minHeight:       36,
    justifyContent:  'center',
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
