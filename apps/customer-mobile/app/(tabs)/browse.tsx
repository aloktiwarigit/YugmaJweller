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
import { getCatalogProducts } from '../../src/api/endpoints';
import type { CatalogProduct } from '../../src/api/endpoints';

// ---------------------------------------------------------------------------
// Metal tabs
// ---------------------------------------------------------------------------

interface MetalTab {
  value: string;
  label: string;
}

const METAL_TABS: MetalTab[] = [
  { value: '',       label: 'सभी'   },
  { value: 'GOLD',   label: 'सोना'  },
  { value: 'SILVER', label: 'चाँदी' },
];

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
      {/* Image placeholder */}
      <View style={{ aspectRatio: 1, backgroundColor: colors.border }} />

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
  const [selectedMetal, setSelectedMetal] = useState('');
  const [searchText, setSearchText]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(text.trim()), 400);
  }, []);

  const handleMetalSelect = useCallback((value: string) => {
    setSelectedMetal(value);
    setPage(1);
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['catalog-products', selectedMetal, debouncedSearch, page],
    queryFn: () => getCatalogProducts({
      metal:  selectedMetal || undefined,
      search: debouncedSearch || undefined,
      page,
      limit: 12,
    }),
    retry: false,
  });

  const products = data?.items ?? [];
  const total    = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / 12));

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

      {/* Metal filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.sm,
          gap: spacing.xs,
        }}
      >
        {METAL_TABS.map((tab) => {
          const isActive = selectedMetal === tab.value;
          return (
            <TouchableOpacity
              key={tab.value}
              onPress={() => handleMetalSelect(tab.value)}
              style={{
                backgroundColor: isActive ? colors.primary : colors.white,
                borderRadius: radii.pill,
                paddingHorizontal: spacing.md,
                borderWidth: 1,
                borderColor: isActive ? colors.primary : colors.border,
                minHeight: 44,
                justifyContent: 'center',
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              <Text
                style={{
                  fontFamily: typography.body.family,
                  fontSize: 14,
                  color: isActive ? colors.white : colors.ink,
                  fontWeight: isActive ? '600' : '400',
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

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
            {debouncedSearch || selectedMetal
              ? 'इस खोज के लिए कोई उत्पाद नहीं मिला।'
              : 'अभी कोई उत्पाद उपलब्ध नहीं है।'}
          </Text>
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
    </View>
  );
}
