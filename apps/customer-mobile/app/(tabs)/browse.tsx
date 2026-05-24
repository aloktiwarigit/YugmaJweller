import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, FlatList,
  TouchableOpacity, ActivityIndicator, Pressable,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { FilterSheet, SortModal } from '../../src/components/FilterSheet';
import { getCatalogProducts } from '../../src/api/endpoints';
import type { CatalogProduct } from '../../src/api/endpoints';
import {
  EMPTY_FILTERS,
  countActiveFilters,
  activeFilterChips,
  removeFilterChip,
} from '../../src/lib/catalog-filter-utils';
import type { ActiveFilters } from '../../src/lib/catalog-filter-utils';
import { CATALOG_SORTS, productDisplayName, productMerchBadges, productSubtitle } from '@goldsmith/customer-shared';
import type { CatalogSort } from '@goldsmith/customer-shared';
import { imageForCategoryName } from '../../src/assets/storefrontImages';
import { useTenantStore } from '../../src/stores/tenantStore';

type SearchParamValue = string | string[] | undefined;
type BrowseRouteParams = Record<string, SearchParamValue>;
type ServiceMode = 'all' | 'tryAtHome' | 'storePickup' | 'fastDelivery';

const SERVICE_CHIPS: Array<{ key: ServiceMode; label: string; hint: string }> = [
  { key: 'all',          label: 'सभी',          hint: 'पूरा कैटलॉग' },
  { key: 'tryAtHome',    label: 'घर पर ट्राय',  hint: 'उपलब्ध डिज़ाइन' },
  { key: 'storePickup',  label: 'स्टोर में देखें', hint: 'दुकान पर उपलब्ध' },
  { key: 'fastDelivery', label: 'फास्ट डिलीवरी', hint: 'जल्दी उपलब्ध' },
];

const DISCOVERY_CHIPS: Array<{ label: string; params: Partial<ActiveFilters> }> = [
  { label: 'ब्राइडल', params: { style: ['BRIDAL'] } },
  { label: 'डेली वियर', params: { style: ['DAILY_WEAR'] } },
  { label: '₹50K तक', params: { priceMin: 0, priceMax: 5_000_000 } },
  { label: '2-5g', params: { weightMinG: 2, weightMaxG: 5 } },
];

interface BrowseRouteState {
  filters: ActiveFilters;
  search: string;
  sort: CatalogSort | undefined;
  collection: string | undefined;
  page: number;
  signature: string;
}

function firstParam(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function numericParam(value: SearchParamValue): number | undefined {
  const raw = firstParam(value);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function pageParam(value: SearchParamValue): number {
  const parsed = numericParam(value);
  return parsed && parsed > 0 ? Math.floor(parsed) : 1;
}

function boolParam(value: SearchParamValue): boolean {
  const raw = firstParam(value);
  return raw === 'true' || raw === '1';
}

function sortParam(value: SearchParamValue): CatalogSort | undefined {
  const raw = firstParam(value);
  return CATALOG_SORTS.includes(raw as CatalogSort) ? raw as CatalogSort : undefined;
}

function routeStateFromParams(params: BrowseRouteParams): BrowseRouteState {
  const giftPersona = firstParam(params['giftPersona']);
  const style = firstParam(params['style']);
  const occasion = firstParam(params['occasion']);

  const filters: ActiveFilters = {
    ...EMPTY_FILTERS,
    metal:       firstParam(params['metal']),
    purity:      firstParam(params['purity']) ? [firstParam(params['purity'])!] : [],
    priceMin:    numericParam(params['priceMin']),
    priceMax:    numericParam(params['priceMax']),
    weightMinG:  numericParam(params['weightMinG']),
    weightMaxG:  numericParam(params['weightMaxG']),
    style:       style ? [style] : [],
    occasion:    occasion ? [occasion] : [],
    inStockOnly: boolParam(params['inStockOnly']),
  };

  if (giftPersona && filters.style.length === 0 && filters.occasion.length === 0) {
    if (giftPersona === 'BRIDE') filters.style = ['BRIDAL'];
    else if (giftPersona === 'SELF') filters.style = ['DAILY_WEAR'];
    else filters.occasion = ['GIFT'];
  }

  const state = {
    filters,
    search: firstParam(params['search']) ?? '',
    sort:   sortParam(params['sort']),
    collection: firstParam(params['collection']),
    page:   pageParam(params['page']),
  };

  return {
    ...state,
    signature: JSON.stringify(state),
  };
}
// ───────────────────────────────────────────────────────────────────────────────

// ---------------------------------------------------------------------------
// Product card (browse variant)
// ---------------------------------------------------------------------------

function BrowseProductCard({ product }: { product: CatalogProduct }): React.ReactElement {
  const isUnavailable = product.quantity === 0;
  const label = productDisplayName(product);
  const subtitle = product.subtitle ?? productSubtitle(product);
  const badges = product.badges ?? productMerchBadges(product);
  const fallbackImage = useMemo(() => imageForCategoryName(product.categoryName), [product.categoryName]);

  return (
    <Pressable
      // Always navigate — the PDP renders its own out-of-stock banner. Blocking
      // the tap on isUnavailable made about half the listing un-openable (the
      // catalog API returns quantity:0 for ~50% of seeded products), which read
      // as a "PDP nav regression" during the 2026-05-12 device sweep.
      onPress={() => router.push(`/browse/${product.id}`)}
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        overflow: 'hidden',
        opacity: isUnavailable ? 0.6 : 1,
      }}
      accessible
      accessibilityLabel={`${label}${isUnavailable ? ', उपलब्ध नहीं' : ''}`}
      accessibilityRole="button"
    >
      <View style={{ position: 'relative', aspectRatio: 4 / 5, backgroundColor: product.primaryImage ? colors.border : colors.white }}>
        {product.primaryImage ? (
          <Image
            source={{ uri: product.primaryImage.url }}
            placeholder={{ uri: product.primaryImage.placeholderUrl }}
            contentFit="cover"
            transition={250}
            style={{ width: '100%', height: '100%' }}
            accessibilityLabel={product.primaryImage.alt ?? label}
          />
        ) : (
          <Image
            source={fallbackImage}
            contentFit="contain"
            style={{ width: '100%', height: '100%' }}
            accessibilityLabel={label}
          />
        )}

        {badges.length > 0 && (
          <View style={{ position: 'absolute', left: spacing.xs, right: spacing.xs, bottom: spacing.xs, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {badges.slice(0, 2).map((badge) => (
              <View
                key={badge}
                style={{
                  backgroundColor: badge === 'HUID' ? colors.successWash : 'rgba(255,255,255,0.88)',
                  borderRadius: radii.pill,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ fontFamily: typography.body.family, fontSize: 10, color: badge === 'HUID' ? colors.successJade : colors.ink }}>
                  {badge}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={{ padding: spacing.sm, minHeight: 112 }}>
        <Text
          style={{ fontFamily: typography.headingMid.family, fontSize: 14, color: colors.ink, lineHeight: 18 }}
          numberOfLines={2}
        >
          {label}
        </Text>
        <Text
          style={{ fontFamily: typography.body.family, fontSize: 11, color: colors.inkMute, marginTop: 2 }}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
        {product.priceAvailable && product.estimatedPrice ? (
          <Text
            style={{ fontFamily: typography.headingMid.family, fontSize: 15, color: colors.ink, marginTop: 6 }}
          >
            {product.estimatedPrice.totalFormatted}
          </Text>
        ) : (
          <Text style={{ fontFamily: typography.body.family, fontSize: 11, color: colors.inkMute, marginTop: 4 }}>
            मूल्य हेतु संपर्क करें
          </Text>
        )}
        {!isUnavailable && (
          <Text style={{ fontFamily: typography.body.family, fontSize: 11, color: colors.primaryDeep, marginTop: 4 }}>
            घर पर ट्राय उपलब्ध
          </Text>
        )}
        {isUnavailable && (
          <Text style={{ fontFamily: typography.body.family, fontSize: 11, color: '#DC2626', marginTop: 4 }}>
            उपलब्ध नहीं
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Browse screen
// ---------------------------------------------------------------------------

export default function Browse(): React.ReactElement {
  const branding     = useTenantStore((s) => s.tenant?.branding);
  const primaryColor = branding?.primaryColor ?? colors.primary;
  const primaryWash  = primaryColor + '20';

  const routeParams = useLocalSearchParams() as BrowseRouteParams;
  const routeState = useMemo(() => routeStateFromParams(routeParams), [routeParams]);
  const lastAppliedRouteSignature = useRef(routeState.signature);

  const [searchText, setSearchText]             = useState(routeState.search);
  const [debouncedSearch, setDebouncedSearch]   = useState(routeState.search);
  const [page, setPage]                         = useState(routeState.page);
  const [filters, setFilters]                   = useState<ActiveFilters>(routeState.filters);
  const [filterSheetOpen, setFilterSheetOpen]   = useState(false);
  const [sortModalOpen, setSortModalOpen]        = useState(false);
  const [sort, setSort]                         = useState<CatalogSort | undefined>(routeState.sort);
  const [collection, setCollection]             = useState<string | undefined>(routeState.collection);
  const [serviceMode, setServiceMode]           = useState<ServiceMode>('all');
  const [pincode, setPincode]                   = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (lastAppliedRouteSignature.current === routeState.signature) return;
    lastAppliedRouteSignature.current = routeState.signature;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchText(routeState.search);
    setDebouncedSearch(routeState.search);
    setFilters(routeState.filters);
    setSort(routeState.sort);
    setCollection(routeState.collection);
    setServiceMode(routeState.filters.inStockOnly ? 'tryAtHome' : 'all');
    setPage(routeState.page);
  }, [routeState]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(text.trim()), 400);
  }, []);

  const handleApplyFilters = useCallback((newFilters: ActiveFilters) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  const handleSortSelect = useCallback((newSort: CatalogSort) => {
    setSort(newSort);
    setPage(1);
  }, []);

  const handleServiceMode = useCallback((mode: ServiceMode) => {
    setServiceMode(mode);
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      inStockOnly: mode === 'all' ? false : true,
    }));
    if (mode === 'fastDelivery') setSort('newest');
  }, []);

  const handleDiscoveryChip = useCallback((params: Partial<ActiveFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...params,
    }));
    setPage(1);
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['catalog-products', filters, sort, debouncedSearch, collection, page],
    queryFn: () => getCatalogProducts({
      metal:       filters.metal || undefined,
      purity:      filters.purity.length === 1 ? filters.purity[0] : undefined,
      search:      debouncedSearch || undefined,
      priceMin:    filters.priceMin,
      priceMax:    filters.priceMax,
      weightMinG:  filters.weightMinG,
      weightMaxG:  filters.weightMaxG,
      inStockOnly: filters.inStockOnly || undefined,
      style:       filters.style.length === 1 ? filters.style[0] : undefined,
      occasion:    filters.occasion.length === 1 ? filters.occasion[0] : undefined,
      giftPersona: firstParam(routeParams['giftPersona']),
      collection,
      sort:        sort,
      page,
      limit: 12,
    }),
    retry: 2,
  });

  const products  = data?.items ?? [];
  const total     = data?.total ?? 0;
  const lastPage  = Math.max(1, Math.ceil(total / 12));
  const filterCount = countActiveFilters(filters) + (sort ? 1 : 0) + (collection ? 1 : 0);
  const chips     = activeFilterChips(filters);
  const collectionLabel = collection
    ? collection.split('-').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TenantBrandHeader />

      {/* Search bar */}
      <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.white,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.sm,
            minHeight: 48,
          }}
        >
          <Text style={{ fontSize: 16, marginRight: spacing.xs, color: colors.inkMute }}>🔍</Text>
          <TextInput
            value={searchText}
            onChangeText={handleSearchChange}
            placeholder="SKU, धातु, शुद्धता खोजें..."
            placeholderTextColor={colors.inkMute}
            style={{
              flex: 1,
              fontFamily: typography.body.family,
              fontSize: 14,
              color: colors.ink,
            }}
            returnKeyType="search"
            accessibilityLabel="उत्पाद खोज"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Market-leader service rail: mirrors pincode / TAH / store availability affordances. */}
      <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xs }}
        >
          {SERVICE_CHIPS.map((chip) => {
            const isActive = serviceMode === chip.key;
            return (
              <TouchableOpacity
                key={chip.key}
                onPress={() => handleServiceMode(chip.key)}
                style={{
                  backgroundColor: isActive ? colors.ink : colors.white,
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  borderColor: isActive ? colors.ink : colors.border,
                  paddingHorizontal: spacing.md,
                  minHeight: 40,
                  justifyContent: 'center',
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={chip.label}
              >
                <Text style={{
                  fontFamily: typography.headingMid.family,
                  fontSize: 12,
                  color: isActive ? colors.white : colors.ink,
                }}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceElevated,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            paddingHorizontal: spacing.sm,
            minHeight: 44,
          }}
        >
          <Text style={{ fontSize: 15, marginRight: spacing.xs, color: colors.primaryDeep }}>⌖</Text>
          <TextInput
            value={pincode}
            onChangeText={(value) => setPincode(value.replace(/\D/g, '').slice(0, 6))}
            placeholder="PIN code for store / home trial"
            placeholderTextColor={colors.inkMute}
            keyboardType="number-pad"
            maxLength={6}
            style={{
              flex: 1,
              fontFamily: typography.body.family,
              fontSize: 13,
              color: colors.ink,
            }}
            accessibilityLabel="PIN code availability"
          />
          <Text style={{ fontFamily: typography.body.family, fontSize: 11, color: pincode.length === 6 ? colors.successJade : colors.inkMute }}>
            {pincode.length === 6 ? 'चेक होगा' : 'वैकल्पिक'}
          </Text>
        </View>
      </View>

      {/* Filter + Sort buttons */}
      <View style={{
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.xs,
      }}>
        {/* Filter button */}
        <TouchableOpacity
          onPress={() => setFilterSheetOpen(true)}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
            backgroundColor: filterCount > 0 ? primaryWash : colors.white,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: filterCount > 0 ? primaryColor : colors.border,
            minHeight: 44,
          }}
          accessibilityLabel={`फ़िल्टर${filterCount > 0 ? ` (${filterCount} सक्रिय)` : ''}`}
          accessibilityRole="button"
        >
          <Text style={{
            fontFamily: typography.body.family, fontSize: 14,
            color: filterCount > 0 ? primaryColor : colors.ink,
            fontWeight: filterCount > 0 ? '600' : '400',
          }}>
            ⚙ फ़िल्टर{filterCount > 0 ? ` (${filterCount})` : ''}
          </Text>
        </TouchableOpacity>

        {/* Sort button */}
        <TouchableOpacity
          onPress={() => setSortModalOpen(true)}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
            backgroundColor: sort ? primaryWash : colors.white,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: sort ? primaryColor : colors.border,
            minHeight: 44,
          }}
          accessibilityLabel="क्रमबद्ध करें"
          accessibilityRole="button"
        >
          <Text style={{
            fontFamily: typography.body.family, fontSize: 14,
            color: sort ? primaryColor : colors.ink,
            fontWeight: sort ? '600' : '400',
          }}>
            ↕ क्रमबद्ध करें
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active filter chips */}
      {(chips.length > 0 || collectionLabel) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.xs,
            gap: spacing.xs,
          }}
        >
          {collectionLabel && (
            <TouchableOpacity
              onPress={() => {
                setCollection(undefined);
                setPage(1);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: primaryWash,
                borderRadius: radii.pill,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                gap: 4,
                minHeight: 32,
              }}
              accessibilityLabel={`${collectionLabel} कलेक्शन हटाएं`}
              accessibilityRole="button"
            >
              <Text style={{
                fontFamily: typography.body.family, fontSize: 12,
                color: primaryColor, fontWeight: '600',
              }}>
                {collectionLabel}
              </Text>
              <Text style={{ fontSize: 11, color: primaryColor }}>×</Text>
            </TouchableOpacity>
          )}
          {chips.map((chip) => (
            <TouchableOpacity
              key={chip.key}
              onPress={() => {
                setFilters((prev) => removeFilterChip(prev, chip.key));
                if (chip.key === 'inStock') setServiceMode('all');
                setPage(1);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: primaryWash,
                borderRadius: radii.pill,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                gap: 4,
                minHeight: 32,
              }}
              accessibilityLabel={`${chip.labelHi} फ़िल्टर हटाएं`}
              accessibilityRole="button"
            >
              <Text style={{
                fontFamily: typography.body.family, fontSize: 12,
                color: primaryColor, fontWeight: '600',
              }}>
                {chip.labelHi}
              </Text>
              <Text style={{ fontSize: 11, color: primaryColor }}>×</Text>
            </TouchableOpacity>
          ))}

          {/* Clear all */}
          <TouchableOpacity
            onPress={() => { setFilters(EMPTY_FILTERS); setSort(undefined); setCollection(undefined); setServiceMode('all'); setPage(1); }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.white,
              borderRadius: radii.pill,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              minHeight: 32,
            }}
            accessibilityLabel="सभी फ़िल्टर हटाएं"
            accessibilityRole="button"
          >
            <Text style={{ fontFamily: typography.body.family, fontSize: 12, color: colors.inkMute }}>
              सभी हटाएं
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs }}>
        <Text style={{ fontFamily: typography.body.family, fontSize: 11, color: colors.inkSoft, textTransform: 'uppercase' }}>
          {collection ? 'Curated collection' : debouncedSearch ? 'Search results' : 'Catalogue'}
        </Text>
        <Text style={{ fontFamily: typography.display.family, fontSize: 24, lineHeight: 30, color: colors.ink }}>
          {collection
            ? collection.split('-').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
            : debouncedSearch
              ? `"${debouncedSearch}"`
              : 'Jewellery designs'}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xs, paddingTop: spacing.xs, paddingBottom: spacing.xs }}
        >
          {DISCOVERY_CHIPS.map((chip) => (
            <TouchableOpacity
              key={chip.label}
              onPress={() => handleDiscoveryChip(chip.params)}
              style={{
                backgroundColor: colors.white,
                borderRadius: radii.pill,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: spacing.sm,
                minHeight: 34,
                justifyContent: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel={`${chip.label} फ़िल्टर लगाएं`}
            >
              <Text style={{ fontFamily: typography.body.family, fontSize: 12, color: colors.ink }}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Result count */}
      <Text
        style={{
          fontFamily: typography.body.family,
          fontSize: 12,
          color: colors.inkMute,
          paddingHorizontal: spacing.md,
          marginBottom: spacing.xs,
        }}
        accessibilityLiveRegion="polite"
      >
        {isLoading ? 'लोड हो रहा है...' : `${total} उत्पाद`}
      </Text>

      {/* Content */}
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
      ) : isError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute, textAlign: 'center' }}>
            उत्पाद लोड नहीं हो पाए। कृपया बाद में पुनः प्रयास करें।
          </Text>
        </View>
      ) : products.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute, textAlign: 'center' }}>
            {debouncedSearch || filterCount > 0
              ? 'इस खोज के लिए कोई उत्पाद नहीं मिला।'
              : 'अभी कोई उत्पाद उपलब्ध नहीं है।'}
          </Text>
          {filterCount > 0 && (
            <TouchableOpacity
              onPress={() => { setFilters(EMPTY_FILTERS); setSort(undefined); setCollection(undefined); setServiceMode('all'); setPage(1); }}
              style={{ marginTop: spacing.md, minHeight: 44, justifyContent: 'center' }}
              accessibilityLabel="सभी फ़िल्टर हटाएं"
            >
              <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.primary }}>
                सभी फ़िल्टर हटाएं
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.xl,
            gap: spacing.sm,
          }}
          columnWrapperStyle={{ gap: spacing.sm }}
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <BrowseProductCard product={item} />
            </View>
          )}
          ListFooterComponent={
            lastPage > 1 ? (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginTop: spacing.md }}>
                {page > 1 && (
                  <TouchableOpacity
                    onPress={() => setPage((p) => Math.max(1, p - 1))}
                    style={{
                      backgroundColor: colors.white,
                      borderRadius: radii.md,
                      borderWidth: 1,
                      borderColor: colors.border,
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.sm,
                      minHeight: 44,
                      justifyContent: 'center',
                    }}
                    accessibilityLabel="पिछला पृष्ठ"
                  >
                    <Text style={{ fontFamily: typography.body.family, color: colors.primary }}>← पिछला</Text>
                  </TouchableOpacity>
                )}
                {page < lastPage && (
                  <TouchableOpacity
                    onPress={() => setPage((p) => p + 1)}
                    style={{
                      backgroundColor: colors.primary,
                      borderRadius: radii.md,
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.sm,
                      minHeight: 44,
                      justifyContent: 'center',
                    }}
                    accessibilityLabel="और उत्पाद देखें"
                  >
                    <Text style={{ fontFamily: typography.body.family, color: colors.white }}>और देखें →</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null
          }
        />
      )}

      {/* FilterSheet */}
      <FilterSheet
        visible={filterSheetOpen}
        initialFilters={filters}
        totalCount={total}
        onClose={() => setFilterSheetOpen(false)}
        onApply={handleApplyFilters}
      />

      {/* Sort modal */}
      <SortModal
        visible={sortModalOpen}
        current={sort}
        onSelect={handleSortSelect}
        onClose={() => setSortModalOpen(false)}
      />
    </View>
  );
}
