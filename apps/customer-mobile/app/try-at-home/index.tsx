import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator, FlatList,
} from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { purityLabel } from '@goldsmith/customer-shared';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { useCustomerSession } from '../../src/hooks/useCustomerSession';
import {
  listPublicProducts,
  createCustomerTryAtHomeBooking,
} from '../../src/api/endpoints';
import type { PublicProduct, TryAtHomeBookingResponse } from '../../src/api/endpoints';
import { useTenantStore } from '../../src/stores/tenantStore';
import { captureEvent } from '../../src/lib/posthog';

// Hindi labels for the metal axis. The catalog API returns the raw enum
// (GOLD/SILVER/DIAMOND/PLATINUM) — we render the Hindi customer-facing name
// inline. Unknown enums fall through to the raw value so we never display
// blank UI.
const METAL_HI: Record<string, string> = {
  GOLD:     'सोना',
  SILVER:   'चाँदी',
  DIAMOND:  'हीरा',
  PLATINUM: 'प्लैटिनम',
};

function formatWeight(grams: string): string {
  const n = Number.parseFloat(grams);
  if (!Number.isFinite(n)) return grams;
  // Trim trailing zeros: "18.0000" → "18", "2.8500" → "2.85"
  return `${n.toFixed(2).replace(/\.?0+$/, '')}g`;
}

function localizedCategoryName(categoryName: string | null | undefined): string {
  if (!categoryName) return 'आभूषण';
  const known: Record<string, string> = {
    'gold rings': 'सोने की अंगूठियां',
    'diamond rings': 'हीरे की अंगूठियां',
    'silver rings': 'चांदी की अंगूठियां',
    'gold earrings': 'सोने के झुमके',
    'diamond earrings': 'हीरे के झुमके',
    'gold pendants': 'सोने के पेंडेंट',
    'diamond pendants': 'हीरे के पेंडेंट',
    'gold bangles': 'सोने की चूड़ियां',
    'silver anklets': 'चांदी की पायल',
    'gold necklaces': 'सोने के हार',
    'mangalsutra': 'मंगलसूत्र',
    'bracelets': 'ब्रैसलेट',
  };
  return known[categoryName.trim().toLowerCase()] ?? categoryName;
}

function productPrimaryLabel(p: PublicProduct): string {
  return purityLabel(p.purity, p.metal) || (METAL_HI[p.metal] ?? p.metal);
}

function productSecondaryLabel(p: PublicProduct): string {
  return `${localizedCategoryName(p.categoryName)} · ${formatWeight(p.grossWeightG)} · ${p.sku}`;
}

const MAX_PIECES_FALLBACK = 3;

function ConfirmedCard({
  booking,
  primaryColor,
}: {
  booking: TryAtHomeBookingResponse;
  primaryColor: string;
}): React.ReactElement {
  const primaryWash = primaryColor + '20';
  const dispatched = booking.dispatchAt
    ? new Date(booking.dispatchAt).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' })
    : null;
  const returnDue = booking.returnDueAt
    ? new Date(booking.returnDueAt).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' })
    : null;

  return (
    <View
      style={{
        backgroundColor: primaryWash,
        borderRadius: radii.md,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
      }}
    >
      <Text
        style={{
          fontFamily: typography.headingMid.family,
          fontSize: 18,
          color: primaryColor,
          marginBottom: spacing.md,
        }}
      >
        अनुरोध स्वीकार हुआ
      </Text>
      <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.ink, marginBottom: spacing.xs }}>
        {booking.productIds.length} उत्पाद अनुरोधित
      </Text>
      {dispatched ? (
        <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute }}>
          भेजा गया: {dispatched}
        </Text>
      ) : (
        <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute }}>
          शीघ्र भेजा जाएगा।
        </Text>
      )}
      {returnDue ? (
        <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.inkMute }}>
          वापसी की अंतिम तिथि: {returnDue}
        </Text>
      ) : null}
    </View>
  );
}

export default function TryAtHomeScreen(): React.ReactElement {
  const branding     = useTenantStore((s) => s.tenant?.branding);
  const primaryColor = branding?.primaryColor ?? colors.primary;

  const { isAuthenticated } = useCustomerSession();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [booking, setBooking]   = useState<TryAtHomeBookingResponse | null>(null);
  const maxPieces = MAX_PIECES_FALLBACK;

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['public-products-tah'],
    queryFn:  () => listPublicProducts({ limit: 30 }),
    staleTime: 60_000,
  });

  const { mutate: submit, isPending, isError, error } = useMutation({
    mutationFn: (ids: string[]) => createCustomerTryAtHomeBooking(ids),
    onSuccess:  (result) => {
      captureEvent('booking_create', { bookingType: 'try_at_home', shopId: customer?.shopId, pieceCount: selected.size });
      setBooking(result);
    },
  });

  const apiError = isError
    ? (() => {
        const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
        if (code === 'try_at_home.feature_disabled') return 'यह सुविधा अभी उपलब्ध नहीं है।';
        if (code === 'try_at_home.piece_limit_exceeded') return `अधिकतम ${maxPieces} उत्पाद चुनें।`;
        if (code === 'try_at_home.product_not_available') return 'कोई उत्पाद उपलब्ध नहीं है।';
        return 'अनुरोध नहीं हो सका। पुनः प्रयास करें।';
      })()
    : null;

  function toggleProduct(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < maxPieces) {
        next.add(id);
      }
      return next;
    });
  }

  function handleSubmit(): void {
    if (selected.size === 0) return;
    submit([...selected]);
  }

  if (!isAuthenticated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TenantBrandHeader />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
          <Text
            style={{
              fontFamily: typography.body.family,
              fontSize: 16,
              color: colors.inkMute,
              textAlign: 'center',
            }}
          >
            घर पर आज़माने के लिए कृपया लॉग इन करें।
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TenantBrandHeader />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <Text
          style={{
            fontFamily: typography.display.family,
            fontSize: 22,
            color: colors.ink,
            marginBottom: spacing.xs,
          }}
        >
          घर पर आज़माएं
        </Text>
        <Text
          style={{
            fontFamily: typography.body.family,
            fontSize: 14,
            color: colors.inkMute,
            marginBottom: spacing.lg,
          }}
        >
          अधिकतम {maxPieces} उत्पाद चुनें। हम आपके घर भेजेंगे।
        </Text>

        {booking ? (
          <ConfirmedCard booking={booking} primaryColor={primaryColor} />
        ) : (
          <>
            {productsLoading ? (
              <ActivityIndicator color={colors.ink} style={{ marginTop: spacing.xl }} />
            ) : (
              <ProductList
                items={(productsData?.items ?? []).filter((p) => p.quantity > 0)}
                selected={selected}
                maxPieces={maxPieces}
                onToggle={toggleProduct}
                primaryColor={primaryColor}
              />
            )}

            {apiError ? (
              <Text
                style={{
                  fontFamily: typography.body.family,
                  fontSize: 14,
                  color: '#DC2626',
                  marginVertical: spacing.sm,
                }}
                accessibilityRole="alert"
              >
                {apiError}
              </Text>
            ) : null}

            <Pressable
              testID="try-at-home-submit"
              onPress={handleSubmit}
              disabled={isPending || selected.size === 0}
              style={{
                backgroundColor: colors.ink,
                borderRadius: radii.sm,
                paddingVertical: spacing.md,
                alignItems: 'center',
                minHeight: 52,
                justifyContent: 'center',
                marginTop: spacing.md,
                opacity: (isPending || selected.size === 0) ? 0.5 : 1,
              }}
              accessibilityLabel="घर पर भेजने का अनुरोध करें"
              accessibilityRole="button"
            >
              {isPending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text
                  style={{
                    fontFamily: typography.body.family,
                    fontSize: 17,
                    color: colors.white,
                    fontWeight: '700',
                  }}
                >
                  अनुरोध करें ({selected.size}/{maxPieces})
                </Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ProductList({
  items,
  selected,
  maxPieces,
  onToggle,
  primaryColor,
}: {
  items:         PublicProduct[];
  selected:      Set<string>;
  maxPieces:     number;
  onToggle:      (id: string) => void;
  primaryColor:  string;
}): React.ReactElement {
  const primaryWash = primaryColor + '20';
  if (items.length === 0) {
    return (
      <Text
        style={{
          fontFamily: typography.body.family,
          fontSize: 14,
          color: colors.inkMute,
          textAlign: 'center',
          paddingVertical: spacing.xl,
        }}
      >
        फिलहाल कोई उत्पाद उपलब्ध नहीं है।
      </Text>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      scrollEnabled={false}
      renderItem={({ item }) => {
        const isSelected  = selected.has(item.id);
        const isDisabled  = !isSelected && selected.size >= maxPieces;
        const primary     = productPrimaryLabel(item);
        const secondary   = productSecondaryLabel(item);
        return (
          <Pressable
            testID={`product-${item.id}`}
            onPress={() => onToggle(item.id)}
            disabled={isDisabled}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isSelected ? primaryWash : colors.white,
              borderRadius: radii.sm,
              padding: spacing.md,
              marginBottom: spacing.xs,
              borderWidth: 1.5,
              borderColor: isSelected ? primaryColor : colors.border,
              opacity: isDisabled ? 0.4 : 1,
              minHeight: 64,
            }}
            accessibilityLabel={`${primary}, ${secondary}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected, disabled: isDisabled }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                borderWidth: 1.5,
                borderColor: isSelected ? primaryColor : colors.border,
                backgroundColor: isSelected ? primaryColor : 'transparent',
                marginRight: spacing.sm,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isSelected ? (
                <Text style={{ color: colors.white, fontSize: 14, fontWeight: '700' }}>✓</Text>
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: typography.headingMid.family,
                  fontSize: 15,
                  color: colors.ink,
                  marginBottom: 2,
                }}
                numberOfLines={1}
              >
                {primary}
              </Text>
              <Text
                style={{
                  fontFamily: typography.body.family,
                  fontSize: 12,
                  color: colors.inkMute,
                }}
                numberOfLines={1}
              >
                {secondary}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}
