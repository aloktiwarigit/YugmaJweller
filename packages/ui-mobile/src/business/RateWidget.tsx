import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Skeleton } from '../primitives/Skeleton';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';

// ---------------------------------------------------------------------------
// Shared types (exported for usePublicRates hook + tests)
// ---------------------------------------------------------------------------

export interface PublicRateEntry {
  perGramRupees: string;
  formattedINR: string;
  fetchedAt: string;
}

export interface PublicRatesResponse {
  GOLD_24K: PublicRateEntry;
  GOLD_22K: PublicRateEntry;
  SILVER_999: PublicRateEntry;
  stale: boolean;
  source: string;
  refreshedAt: string;
}

export interface RateWidgetProps {
  variant: 'full' | 'compact' | 'ticker';
  rates: PublicRatesResponse | null;
  loading?: boolean;
  onPress?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOT_GREEN = '#22c55e';
const DOT_YELLOW = '#f59e0b';
const DOT_RED = '#ef4444';

const METAL_LABELS: Record<'GOLD_24K' | 'GOLD_22K' | 'SILVER_999', string> = {
  GOLD_24K: '24 कैरेट सोना',
  GOLD_22K: '22 कैरेट सोना',
  SILVER_999: 'चाँदी 999',
};

// ---------------------------------------------------------------------------
// Freshness helpers
// ---------------------------------------------------------------------------

type FreshnessLevel = 'fresh' | 'aging' | 'stale';

function getFreshnessLevel(refreshedAt: string, stale: boolean): FreshnessLevel {
  if (stale) return 'stale';
  const ageMin = (Date.now() - new Date(refreshedAt).getTime()) / 60000;
  if (ageMin < 30) return 'fresh';
  if (ageMin < 60) return 'aging';
  return 'stale';
}

function getFreshnessColor(level: FreshnessLevel): string {
  if (level === 'fresh') return DOT_GREEN;
  if (level === 'aging') return DOT_YELLOW;
  return DOT_RED;
}

function getFreshnessText(refreshedAt: string, stale: boolean): string {
  if (stale) return 'दर पुरानी है';
  const ageMin = Math.floor((Date.now() - new Date(refreshedAt).getTime()) / 60000);
  if (ageMin < 2) return 'अभी अपडेट हुआ';
  return `${ageMin} मिनट पहले`;
}

function rupeeInt(perGramRupees: string): string {
  return Math.round(parseFloat(perGramRupees)).toLocaleString('en-IN');
}

// ---------------------------------------------------------------------------
// RateWidget
// ---------------------------------------------------------------------------

export function RateWidget({ variant, rates, loading = false, onPress }: RateWidgetProps): React.ReactElement {
  const [reduceMotion, setReduceMotion] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (variant !== 'ticker' || rates === null || reduceMotion) return;

    const animation = Animated.loop(
      Animated.timing(translateX, {
        toValue: -600,
        duration: 12000,
        useNativeDriver: true,
      } as Parameters<typeof Animated.timing>[1]),
    );
    animation.start();
    return () => {
      translateX.setValue(0);
    };
  }, [rates, reduceMotion, variant]);

  if (loading) {
    return (
      <View style={styles.loadingRow} testID="rate-widget-loading">
        <Skeleton height={14} width={180} />
        <View style={{ width: spacing.sm ?? 8 }} />
        <Skeleton height={14} width={80} />
      </View>
    );
  }

  // ---- full ----------------------------------------------------------------
  if (variant === 'full') {
    if (rates === null) {
      return (
        <View
          style={styles.offlineContainer}
          testID="rate-widget-offline"
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.offlineText}>दर अस्थायी रूप से उपलब्ध नहीं</Text>
        </View>
      );
    }

    const level = getFreshnessLevel(rates.refreshedAt, rates.stale);
    const dotColor = getFreshnessColor(level);
    const freshnessText = getFreshnessText(rates.refreshedAt, rates.stale);
    const metals = ['GOLD_24K', 'GOLD_22K', 'SILVER_999'] as const;

    return (
      <View style={styles.fullContainer} testID="rate-widget-full">
        {metals.map((metal) => (
          <View
            key={metal}
            style={styles.fullRow}
            testID={`rate-widget-row-${metal}`}
            accessibilityLabel={`${METAL_LABELS[metal]}: ${rates[metal].formattedINR} प्रति ग्राम`}
          >
            <Text style={styles.metalLabel}>{METAL_LABELS[metal]}</Text>
            <Text style={styles.rateValue}>{rates[metal].formattedINR}/g</Text>
            <View style={styles.freshnessRow}>
              <View
                style={{ ...styles.dot, backgroundColor: dotColor }}
                testID={`rate-widget-dot-${metal}`}
              />
              <Text style={styles.freshnessText}>{freshnessText}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }

  // ---- compact -------------------------------------------------------------
  if (variant === 'compact') {
    if (rates === null) {
      return (
        <View style={styles.offlineContainer} testID="rate-widget-offline">
          <Text style={styles.offlineText}>दर उपलब्ध नहीं</Text>
        </View>
      );
    }

    const level = getFreshnessLevel(rates.refreshedAt, rates.stale);
    const dotColor = getFreshnessColor(level);
    const compact22 = rupeeInt(rates.GOLD_22K.perGramRupees);
    const compact24 = rupeeInt(rates.GOLD_24K.perGramRupees);

    return (
      <Pressable
        style={styles.compactContainer}
        testID="rate-widget-compact"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`22K ₹${compact22} · 24K ₹${compact24} प्रति ग्राम`}
      >
        <Text style={styles.compactText}>
          {`22K ₹${compact22} · 24K ₹${compact24}`}
        </Text>
        <View style={{ ...styles.dot, backgroundColor: dotColor, marginLeft: spacing.xs ?? 6 }} />
      </Pressable>
    );
  }

  // ---- ticker ---------------------------------------------------------------
  if (rates === null) {
    return (
      <View style={{ ...styles.tickerContainer, ...styles.offlineContainer }} testID="rate-widget-offline">
        <Text style={styles.offlineText}>दर उपलब्ध नहीं</Text>
      </View>
    );
  }

  const t22 = rupeeInt(rates.GOLD_22K.perGramRupees);
  const t24 = rupeeInt(rates.GOLD_24K.perGramRupees);
  const t999 = rupeeInt(rates.SILVER_999.perGramRupees);
  const tickerText = `22K ₹${t22}/g  •  24K ₹${t24}/g  •  999 ₹${t999}/g`;

  return (
    <View style={styles.tickerContainer} testID="rate-widget-ticker">
      <Animated.View
        style={reduceMotion ? undefined : { transform: [{ translateX }] }}
        testID="rate-widget-ticker-content"
      >
        <Text style={styles.tickerText}>{tickerText}</Text>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm ?? 8,
  },
  offlineContainer: {
    backgroundColor: colors.border ?? '#E5E7EB',
    borderRadius: 8,
    padding: spacing.sm ?? 8,
    alignItems: 'center',
  },
  offlineText: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: colors.textSecondary ?? '#6B7280',
  },
  fullContainer: {
    backgroundColor: colors.white ?? '#FFFFFF',
    borderRadius: 12,
    padding: spacing.md ?? 16,
    gap: spacing.sm ?? 8,
  },
  fullRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  metalLabel: {
    flex: 1,
    fontFamily: typography.body.family,
    fontSize: 16,
    color: colors.textPrimary ?? '#1C1917',
  },
  rateValue: {
    fontFamily: typography.body.family,
    fontSize: 16,
    color: colors.ink ?? '#1C1917',
    fontWeight: '600',
    marginRight: spacing.sm ?? 8,
  },
  freshnessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  freshnessText: {
    fontFamily: typography.body.family,
    fontSize: 12,
    color: colors.textSecondary ?? '#6B7280',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm ?? 8,
    paddingVertical: spacing.xs ?? 4,
    minHeight: 44,
  },
  compactText: {
    fontFamily: typography.body.family,
    fontSize: 14,
    color: colors.textPrimary ?? '#1C1917',
    fontWeight: '600',
  },
  tickerContainer: {
    overflow: 'hidden',
    height: 32,
    justifyContent: 'center',
  },
  tickerText: {
    fontFamily: typography.body.family,
    fontSize: 13,
    color: colors.textPrimary ?? '#1C1917',
  },
});
