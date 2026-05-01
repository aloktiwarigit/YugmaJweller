import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator, FlatList,
} from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { useCustomerSession } from '../../src/hooks/useCustomerSession';
import {
  listPublicProducts,
  createCustomerTryAtHomeBooking,
} from '../../src/api/endpoints';
import type { TryAtHomeBookingResponse } from '../../src/api/endpoints';

const MAX_PIECES_FALLBACK = 3;

function ConfirmedCard({ booking }: { booking: TryAtHomeBookingResponse }): React.ReactElement {
  const dispatched = booking.dispatchAt
    ? new Date(booking.dispatchAt).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' })
    : null;
  const returnDue = booking.returnDueAt
    ? new Date(booking.returnDueAt).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' })
    : null;

  return (
    <View
      style={{
        backgroundColor: '#EFF6FF',
        borderRadius: radii.md,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: '#BFDBFE',
      }}
    >
      <Text
        style={{
          fontFamily: typography.headingMid.family,
          fontSize: 18,
          color: '#1D4ED8',
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
    onSuccess:  (result) => { setBooking(result); },
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
          <ConfirmedCard booking={booking} />
        ) : (
          <>
            {productsLoading ? (
              <ActivityIndicator color={colors.ink} style={{ marginTop: spacing.xl }} />
            ) : (
              <ProductList
                items={(productsData?.items ?? []).filter((p) =>
                  (p as unknown as Record<string, unknown>)['status'] === 'IN_STOCK' ||
                  !(p as unknown as Record<string, unknown>)['status'],
                )}
                selected={selected}
                maxPieces={maxPieces}
                onToggle={toggleProduct}
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
}: {
  items:     Array<{ id: string; name?: string }>;
  selected:  Set<string>;
  maxPieces: number;
  onToggle:  (id: string) => void;
}): React.ReactElement {
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
        return (
          <Pressable
            testID={`product-${item.id}`}
            onPress={() => onToggle(item.id)}
            disabled={isDisabled}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isSelected ? '#EFF6FF' : colors.white,
              borderRadius: radii.sm,
              padding: spacing.md,
              marginBottom: spacing.xs,
              borderWidth: 1.5,
              borderColor: isSelected ? '#3B82F6' : colors.border,
              opacity: isDisabled ? 0.4 : 1,
              minHeight: 56,
            }}
            accessibilityLabel={item.name ?? item.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected, disabled: isDisabled }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                borderWidth: 1.5,
                borderColor: isSelected ? '#3B82F6' : colors.border,
                backgroundColor: isSelected ? '#3B82F6' : 'transparent',
                marginRight: spacing.sm,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isSelected ? (
                <Text style={{ color: colors.white, fontSize: 14, fontWeight: '700' }}>✓</Text>
              ) : null}
            </View>
            <Text
              style={{
                fontFamily: typography.body.family,
                fontSize: 15,
                color: colors.ink,
                flex: 1,
              }}
              numberOfLines={2}
            >
              {item.name ?? item.id}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}
