import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { usePublicRates } from '../hooks/usePublicRates';

export function RateCard(): React.ReactElement {
  const { data, isLoading, isError } = usePublicRates();

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
      <Text
        style={{
          fontFamily: typography.headingMid.family,
          fontSize: 16,
          color: colors.ink,
          marginBottom: spacing.sm,
        }}
      >
        आज की दर
      </Text>

      {isLoading ? (
        <ActivityIndicator />
      ) : isError || !data ? (
        <Text
          testID="rate-card-error"
          style={{ color: colors.inkMute, fontFamily: typography.body.family }}
        >
          दर अभी उपलब्ध नहीं है
        </Text>
      ) : (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: colors.inkMute, fontSize: 12 }}>22K</Text>
            <Text
              testID="rate-22k"
              style={{ fontFamily: typography.display.family, fontSize: 18, color: colors.ink }}
            >
              {data.GOLD_22K.formattedINR}
            </Text>
          </View>
          <View>
            <Text style={{ color: colors.inkMute, fontSize: 12 }}>24K</Text>
            <Text
              testID="rate-24k"
              style={{ fontFamily: typography.display.family, fontSize: 18, color: colors.ink }}
            >
              {data.GOLD_24K.formattedINR}
            </Text>
          </View>
          <View>
            <Text style={{ color: colors.inkMute, fontSize: 12 }}>चांदी 999</Text>
            <Text
              testID="rate-silver"
              style={{ fontFamily: typography.display.family, fontSize: 18, color: colors.ink }}
            >
              {data.SILVER_999.formattedINR}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
