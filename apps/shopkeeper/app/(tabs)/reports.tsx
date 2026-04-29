import React from 'react';
import {
  View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet,
} from 'react-native';
import { router, type Href } from 'expo-router';
import { colors, spacing } from '@goldsmith/ui-tokens';
import {
  useDailySummary, useOutstanding, useCustomerLtv, useLoyaltySummary,
  formatPaise,
} from '../../src/features/reports/useReports';

const GOLD = '#B58A3C';

// ---------------------------------------------------------------------------
// Report card
// ---------------------------------------------------------------------------

interface ReportCardProps {
  title:   string;
  metric:  string;
  metricLabel: string;
  onPress: () => void;
  loading: boolean;
}

function ReportCard({ title, metric, metricLabel, onPress, loading }: ReportCardProps): React.ReactElement {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {loading ? (
        <ActivityIndicator color={GOLD} style={{ marginVertical: 12 }} />
      ) : (
        <View style={styles.metricRow}>
          <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>{metric}</Text>
          <Text style={styles.metricLabel}>{metricLabel}</Text>
        </View>
      )}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.viewBtn, pressed && styles.viewBtnPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${title} देखें`}
      >
        <Text style={styles.viewBtnText}>देखें →</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ReportsScreen(): React.ReactElement {
  const daily    = useDailySummary();
  const outstanding = useOutstanding(1, 20);
  const ltv      = useCustomerLtv(1);
  const loyalty  = useLoyaltySummary();

  const totalToday = daily.data ? formatPaise(daily.data.total_paise) : '—';
  const outstandingCount = outstanding.data ? `${outstanding.data.total}` : '—';
  const topCustomer = ltv.data?.[0]?.name ?? '—';
  const loyaltyMembers = loyalty.data
    ? `${loyalty.data.members_by_tier.reduce((acc, t) => acc + t.count, 0)}`
    : '—';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>रिपोर्ट</Text>

      <ReportCard
        title="दैनिक बिक्री सारांश"
        metric={totalToday}
        metricLabel="आज की कुल बिक्री"
        loading={daily.isLoading}
        onPress={() => router.push('/reports/daily-summary' as Href<string>)}
      />

      <ReportCard
        title="बकाया भुगतान"
        metric={outstandingCount}
        metricLabel="लंबित चालान"
        loading={outstanding.isLoading}
        onPress={() => router.push('/reports/outstanding' as Href<string>)}
      />

      <ReportCard
        title="शीर्ष ग्राहक (LTV)"
        metric={topCustomer}
        metricLabel="सर्वाधिक खरीदार"
        loading={ltv.isLoading}
        onPress={() => router.push('/reports/customer-ltv' as Href<string>)}
      />

      <ReportCard
        title="लॉयल्टी कार्यक्रम"
        metric={loyaltyMembers}
        metricLabel="कुल सदस्य"
        loading={loyalty.isLoading}
        onPress={() => router.push('/reports/loyalty-summary' as Href<string>)}
      />

      {/* GSTR export link */}
      <Pressable
        style={({ pressed }) => [styles.gstrCard, pressed && styles.viewBtnPressed]}
        onPress={() => router.push('/reports/gstr-export' as Href<string>)}
        accessibilityRole="button"
        accessibilityLabel="GSTR रिपोर्ट निर्यात करें"
      >
        <Text style={styles.gstrTitle}>GSTR निर्यात</Text>
        <Text style={styles.gstrSub}>GSTR-1 / GSTR-3B CSV डाउनलोड करें</Text>
        <Text style={styles.viewBtnText}>देखें →</Text>
      </Pressable>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.xl,
    paddingBottom:     40,
    gap:               16,
  },
  pageTitle: {
    fontFamily: 'YatraOne',
    fontSize:   28,
    color:      colors.ink,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius:    12,
    padding:         spacing.lg,
    borderWidth:     1,
    borderColor:     colors.border,
    shadowColor:     '#000',
    shadowOpacity:   0.04,
    shadowRadius:    4,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       2,
  },
  cardTitle: {
    fontFamily:  'NotoSansDevanagari',
    fontSize:    18,
    fontWeight:  '700',
    color:       colors.ink,
    marginBottom: 8,
  },
  metricRow: {
    marginBottom: 12,
  },
  metricValue: {
    fontFamily: 'MuktaVaani-700',
    fontSize:   24,
    color:      GOLD,
    lineHeight: 30,
  },
  metricLabel: {
    fontFamily: 'NotoSansDevanagari',
    fontSize:   14,
    color:      colors.inkMute,
    marginTop:  2,
  },
  viewBtn: {
    alignSelf:         'flex-start',
    backgroundColor:   GOLD,
    borderRadius:      8,
    paddingVertical:   10,
    paddingHorizontal: 20,
    minHeight:         48,
    justifyContent:    'center',
  },
  viewBtnPressed: {
    opacity: 0.75,
  },
  viewBtnText: {
    fontFamily:  'NotoSansDevanagari',
    fontSize:    16,
    fontWeight:  '600',
    color:       '#fff',
  },
  gstrCard: {
    backgroundColor: '#FFF8E7',
    borderRadius:    12,
    padding:         spacing.lg,
    borderWidth:     1,
    borderColor:     '#E8D5A3',
    gap:             4,
  },
  gstrTitle: {
    fontFamily:  'NotoSansDevanagari',
    fontSize:    18,
    fontWeight:  '700',
    color:       colors.ink,
  },
  gstrSub: {
    fontFamily:  'NotoSansDevanagari',
    fontSize:    14,
    color:       colors.inkMute,
    marginBottom: 8,
  },
});
