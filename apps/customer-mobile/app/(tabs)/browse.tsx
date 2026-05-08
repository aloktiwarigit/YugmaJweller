'use client';
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, FlatList,
  TouchableOpacity, ActivityIndicator, Pressable,
} from 'react-native';
import { router } from 'expo-router';
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
import type { CatalogSort } from '@goldsmith/customer-shared';

// ─── Colour tokens not yet on origin/main (land with D1D2D5) ───────────────────
const PRIMARY_DEEP  = '#8C6628';
const PRIMARY_WASH  = colors.primaryLight; // '#EFE3BE'
// ───────────────────────────────────────────────────────────────────────────────

// ---------------------------------------------------------------------------
// Product card (browse variant)
// ---------------------------------------------------------------------------

function BrowseProductCard({ product }: { product: CatalogProduct }): React.ReactElement {
  const isUnavailable = product.quantity === 0;

  function metalLabel(purity: string): string {
    const metalKey = purity.split('_')[0] ?? '';
    const metals: Record<string, string> = { GOLD: 'सोना', SILVER: 'चाँदी', PLATINUM: 'प्लेटिनम' };
    const purities: Record<string, string> = {
      GOLD_24K: '24K', GOLD_22K: '22K', GOLD_20K: '20K', GOLD_18K: '18K', GOLD_14K: '14K',
      SILVER_999: '999', SILVER_925: '925',
    };
    const m = metals[metalKey] ?? '';
    const k = purities[purity] ?? purity;
    return m ? `${m} ${k}` : k;
  }

  return (
    <Pressable
      onPress={() => !isUnavailable && router.push(`/browse/${product.id}`)}
      style={{
        flex: 1,
        backgroundColor: colors.white,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        opacity: isUnavailable ? 0.6 : 1,
      }}
      accessible
      accessibilityLabel={`${metalLabel(product.purity)} — ${product.sku}${isUnavailable ? ', उपलब्ध नहीं' : ''}`}
      accessibilityRole="button"
    >
      {/* Image placeholder / primaryImage */}
      {product.primaryImage ? (
        <View style={{ aspectRatio: 4 / 5, backgroundColor: colors.border }} />
      ) : (
        <View style={{ aspectRatio: 4 / 5, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 28, color: colors.inkMute }}>💎</Text>
        </View>
      )}

      <View style={{ padding: spacing.sm }}>
        <Text
          style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.ink, fontWeight: '600' }}
          numberOfLines={1}
        >
          {metalLabel(product.purity)}
        </Text>
        <Text
          style={{ fontFamily: typography.body.family, fontSize: 12, color: colors.inkMute, marginTop: 2 }}
          numberOfLines={1}
        >
          {product.sku}
        </Text>
        {product.huid && (
          <Text
            style={{ fontFamily: typography.body.family, fontSize: 11, color: colors.primary, marginTop: 4 }}
            numberOfLines={1}
          >
            हॉलमार्क ✓
          </Text>
        )}
        {product.priceAvailable && product.estimatedPrice ? (
          <Text
            style={{ fontFamily: typography.body.family, fontSize: 13, color: colors.ink, fontWeight: '600', marginTop: 4 }}
          >
            {product.estimatedPrice.totalFormatted}
          </Text>
        ) : (
          <Text style={{ fontFamily: typography.body.family, fontSize: 11, color: colors.inkMute, marginTop: 4 }}>
            मूल्य हेतु संपर्क करें
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
  const [searchText, setSearchText]             = useState('');
  const [debouncedSearch, setDebouncedSearch]   = useState('');
  const [page, setPage]                         = useState(1);
  const [filters, setFilters]                   = useState<ActiveFilters>(EMPTY_FILTERS);
  const [filterSheetOpen, setFilterSheetOpen]   = useState(false);
  const [sortModalOpen, setSortModalOpen]        = useState(false);
  const [sort, setSort]                         = useState<CatalogSort | undefined>(undefined);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const { data, isLoading, isError } = useQuery({
    queryKey: ['catalog-products', filters, sort, debouncedSearch, page],
    queryFn: () => getCatalogProducts({
      metal:       filters.metal || undefined,
      purity:      filters.purity.length === 1 ? filters.purity[0] : undefined,
      search:      debouncedSearch || undefined,
      priceMin:    filters.priceMin,
      priceMax:    filters.priceMax,
      inStockOnly: filters.inStockOnly || undefined,
      style:       filters.style.length === 1 ? filters.style[0] : undefined,
      occasion:    filters.occasion.length === 1 ? filters.occasion[0] : undefined,
      sort:        sort,
      page,
      limit: 12,
    }),
    retry: false,
  });

  const products  = data?.items ?? [];
  const total     = data?.total ?? 0;
  const lastPage  = Math.max(1, Math.ceil(total / 12));
  const filterCount = countActiveFilters(filters) + (sort ? 1 : 0);
  const chips     = activeFilterChips(filters);

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
            backgroundColor: filterCount > 0 ? PRIMARY_WASH : colors.white,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: filterCount > 0 ? PRIMARY_DEEP : colors.border,
            minHeight: 44,
          }}
          accessibilityLabel={`फ़िल्टर${filterCount > 0 ? ` (${filterCount} सक्रिय)` : ''}`}
          accessibilityRole="button"
        >
          <Text style={{
            fontFamily: typography.body.family, fontSize: 14,
            color: filterCount > 0 ? PRIMARY_DEEP : colors.ink,
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
            backgroundColor: sort ? PRIMARY_WASH : colors.white,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: sort ? PRIMARY_DEEP : colors.border,
            minHeight: 44,
          }}
          accessibilityLabel="क्रमबद्ध करें"
          accessibilityRole="button"
        >
          <Text style={{
            fontFamily: typography.body.family, fontSize: 14,
            color: sort ? PRIMARY_DEEP : colors.ink,
            fontWeight: sort ? '600' : '400',
          }}>
            ↕ क्रमबद्ध करें
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active filter chips */}
      {chips.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.xs,
            gap: spacing.xs,
          }}
        >
          {chips.map((chip) => (
            <TouchableOpacity
              key={chip.key}
              onPress={() => {
                setFilters((prev) => removeFilterChip(prev, chip.key));
                setPage(1);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: PRIMARY_WASH,
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
                color: PRIMARY_DEEP, fontWeight: '600',
              }}>
                {chip.labelHi}
              </Text>
              <Text style={{ fontSize: 11, color: PRIMARY_DEEP }}>×</Text>
            </TouchableOpacity>
          ))}

          {/* Clear all */}
          <TouchableOpacity
            onPress={() => { setFilters(EMPTY_FILTERS); setSort(undefined); setPage(1); }}
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
              onPress={() => { setFilters(EMPTY_FILTERS); setSort(undefined); setPage(1); }}
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
