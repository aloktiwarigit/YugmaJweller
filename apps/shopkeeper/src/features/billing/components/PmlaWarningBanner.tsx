import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

const PMLA_BLOCK_THRESHOLD_PAISE = 100_000_000n; // Rs 10,00,000

function formatPaise(paise: bigint): string {
  const rupees = Number(paise) / 100;
  return new Intl.NumberFormat('hi-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rupees);
}

function formatMonthStr(monthStr: string): string {
  // 'YYYY-MM' → readable Hindi month label using Intl
  const [year, month] = monthStr.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat('hi-IN', { month: 'long', year: 'numeric' }).format(date);
}

export interface PmlaWarningBannerProps {
  customerName:    string;
  cumulativePaise: bigint;
  monthStr:        string;
  onDismiss:       () => void;
}

export function PmlaWarningBanner({
  customerName,
  cumulativePaise,
  monthStr,
  onDismiss,
}: PmlaWarningBannerProps): React.JSX.Element {
  const formattedAmount  = formatPaise(cumulativePaise);
  const formattedLimit   = formatPaise(PMLA_BLOCK_THRESHOLD_PAISE);
  const formattedMonth   = formatMonthStr(monthStr);

  return (
    <View
      style={styles.banner}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.content}>
        <Text style={styles.icon} accessibilityElementsHidden>⚠️</Text>
        <View style={styles.textContainer}>
          <Text style={styles.message}>
            {customerName} की {formattedMonth} की cash: {formattedAmount}। PMLA सीमा {formattedLimit} है।
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onDismiss}
        style={styles.dismissBtn}
        accessibilityRole="button"
        accessibilityLabel="समझ गए"
        hitSlop={8}
      >
        <Text style={styles.dismissText}>समझ गए</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderLeftColor: '#D97706',
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  icon: {
    fontSize: 18,
    marginRight: 8,
    marginTop: 1,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    fontSize: 15,
    color: '#92400E',
    fontFamily: 'NotoSansDevanagari-Regular',
    lineHeight: 22,
  },
  dismissBtn: {
    alignSelf: 'flex-end',
    backgroundColor: '#D97706',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minHeight: 44,
    justifyContent: 'center',
  },
  dismissText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'NotoSansDevanagari-SemiBold',
  },
});
