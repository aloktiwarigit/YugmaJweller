import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { usePublicRates } from '../hooks/usePublicRates';

interface RatePillProps {
  label: string;
  value: string;
  testID: string;
}

function formatUpdatedTime(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });
}

function RatePill({ label, value, testID }: RatePillProps): React.ReactElement {
  return (
    <View style={styles.ratePill}>
      <Text style={styles.rateLabel}>{label}</Text>
      <Text
        testID={testID}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        style={styles.rateValue}
      >
        {value}
      </Text>
      <Text style={styles.perGram}>/g</Text>
    </View>
  );
}

export function RateCard(): React.ReactElement {
  const { data, isLoading, isError } = usePublicRates();
  const updatedTime = formatUpdatedTime(data?.refreshedAt ?? data?.GOLD_24K.fetchedAt);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>LIVE RATE</Text>
          <Text style={styles.title}>आज का भाव</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/rate-lock' as Parameters<typeof router.push>[0])}
          style={styles.lockButton}
          accessibilityRole="button"
          accessibilityLabel="दर लॉक करें"
          testID="rate-lock-cta"
        >
          <Text style={styles.lockButtonText}>दर लॉक करें</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>दर लोड हो रही है</Text>
        </View>
      ) : isError || !data ? (
        <Text testID="rate-card-error" style={styles.errorText}>
          दर अभी उपलब्ध नहीं है
        </Text>
      ) : (
        <>
          <View style={styles.rateRow}>
            <RatePill label="24K" value={data.GOLD_24K.formattedINR} testID="rate-24k" />
            <RatePill label="22K" value={data.GOLD_22K.formattedINR} testID="rate-22k" />
            <RatePill label="चाँदी" value={data.SILVER_999.formattedINR} testID="rate-silver" />
          </View>
          <Text style={styles.metaText}>
            {data.stale ? 'पुरानी दर' : 'ताज़ा दर'}{updatedTime ? ` · ${updatedTime}` : ''}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius:    radii.md,
    padding:         spacing.md,
    marginHorizontal: spacing.lg,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    gap:            spacing.sm,
    marginBottom:   spacing.md,
  },
  eyebrow: {
    fontFamily:    typography.body.family,
    fontSize:      10,
    color:         colors.inkSoft,
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: typography.headingMid.family,
    fontSize:   17,
    color:      colors.ink,
  },
  lockButton: {
    minHeight:       40,
    paddingHorizontal: spacing.md,
    borderRadius:    radii.pill,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.primaryWash,
  },
  lockButtonText: {
    fontFamily: typography.headingMid.family,
    fontSize:   13,
    color:      colors.ink,
  },
  loadingRow: {
    minHeight:      64,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.sm,
  },
  loadingText: {
    fontFamily: typography.body.family,
    fontSize:   13,
    color:      colors.inkMute,
  },
  errorText: {
    minHeight:  48,
    fontFamily: typography.body.family,
    color:      colors.inkMute,
  },
  rateRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
  ratePill: {
    flex:            1,
    minHeight:       74,
    padding:         spacing.sm,
    borderRadius:    radii.sm,
    backgroundColor: colors.surfaceRecessed,
    justifyContent:  'center',
  },
  rateLabel: {
    fontFamily: typography.body.family,
    fontSize:   11,
    color:      colors.inkMute,
    marginBottom: 2,
  },
  rateValue: {
    fontFamily: typography.display.family,
    fontSize:   17,
    color:      colors.ink,
  },
  perGram: {
    fontFamily: typography.body.family,
    fontSize:   10,
    color:      colors.inkSoft,
    marginTop:  1,
  },
  metaText: {
    fontFamily: typography.body.family,
    fontSize:   11,
    color:      colors.inkSoft,
    marginTop:  spacing.sm,
  },
});
