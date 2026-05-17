import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { useCustomerSession } from '../hooks/useCustomerSession';
import { getCustomerLoyalty } from '../api/endpoints';

export function LoyaltyPointsCard(): React.ReactElement {
  const { isAuthenticated, customer } = useCustomerSession();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey:  ['customer-loyalty', customer?.id],
    queryFn:   getCustomerLoyalty,
    enabled:   isAuthenticated && customer !== null,
    staleTime: 60_000,
  });

  const points = data?.state.pointsBalance ?? 0;
  const tier   = data?.state.currentTier ?? null;

  if (!isAuthenticated) {
    return (
      <View
        style={{
          backgroundColor: colors.white,
          borderRadius: radii.md,
          padding: spacing.md,
          marginHorizontal: spacing.lg,
          marginVertical: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ fontFamily: typography.headingMid.family, fontSize: 16, color: colors.ink }}>
          वफ़ादारी अंक
        </Text>
        <Text
          style={{
            fontFamily: typography.body.family,
            fontSize: 13,
            color: colors.inkMute,
            marginTop: spacing.xs,
          }}
        >
          फ़ोन OTP लॉगिन के बाद उपलब्ध।
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => router.push('/loyalty' as Parameters<typeof router.push>[0])}
      style={{
        backgroundColor: colors.white,
        borderRadius: radii.md,
        padding: spacing.md,
        marginHorizontal: spacing.lg,
        marginVertical: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
      }}
      accessibilityLabel="वफ़ादारी अंक देखें"
      accessibilityRole="button"
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontFamily: typography.headingMid.family, fontSize: 16, color: colors.ink }}>
          वफ़ादारी अंक
        </Text>
        {tier ? (
          <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: '#B8860B', fontWeight: '600' }}>
            {tier === 'GOLD' ? 'स्वर्ण' : tier === 'SILVER' ? 'रजत' : tier}
          </Text>
        ) : null}
      </View>
      {isLoading ? (
        <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: colors.inkMute, marginTop: spacing.xs }}>
          लोड हो रहा है…
        </Text>
      ) : (
        <Text
          style={{
            fontFamily: typography.headingMid.family,
            fontSize: 26,
            color: colors.ink,
            marginTop: spacing.xs,
          }}
          accessibilityLabel={`${points} वफ़ादारी अंक`}
        >
          {points.toLocaleString('en-IN')} अंक
        </Text>
      )}
    </Pressable>
  );
}
