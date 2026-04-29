import React from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, Pressable, StyleSheet,
} from 'react-native';
import { colors, spacing } from '@goldsmith/ui-tokens';
import { useLoyaltySummary } from '../../src/features/reports/useReports';

const GOLD = '#B58A3C';

const TIER_LABELS: Record<string, string> = {
  BRONZE: 'कांस्य',
  SILVER: 'रजत',
  GOLD:   'स्वर्ण',
};

function tierLabel(tier: string | null): string {
  if (!tier) return 'सामान्य';
  return TIER_LABELS[tier] ?? tier;
}

function tierColor(tier: string | null): string {
  if (tier === 'GOLD')   return '#FFD700';
  if (tier === 'SILVER') return '#C0C0C0';
  if (tier === 'BRONZE') return '#CD7F32';
  return colors.border;
}

export default function LoyaltySummaryScreen(): React.ReactElement {
  const { data, isLoading, error, refetch } = useLoyaltySummary();

  const totalMembers = data?.members_by_tier.reduce((acc, t) => acc + t.count, 0) ?? 0;

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={GOLD} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>डेटा लोड नहीं हो सका।</Text>
        <Pressable onPress={() => void refetch()} style={styles.retryBtn}>
          <Text style={styles.retryText}>पुनः प्रयास करें</Text>
        </Pressable>
      </View>
    );
  }

  if (!data) return <View style={styles.centered} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Hero: total members */}
      <View style={styles.heroCard}>
        <Text style={styles.heroValue}>{totalMembers}</Text>
        <Text style={styles.heroLabel}>कुल लॉयल्टी सदस्य</Text>
      </View>

      {/* Points issued / redeemed */}
      <View style={styles.row2}>
        <View style={[styles.statCard, { flex: 1 }]}>
          <Text style={styles.statValue}>{data.points_issued.toLocaleString('hi-IN')}</Text>
          <Text style={styles.statLabel}>अर्जित पॉइंट</Text>
        </View>
        <View style={styles.rowGap} />
        <View style={[styles.statCard, { flex: 1 }]}>
          <Text style={[styles.statValue, { color: colors.accent }]}>{data.points_redeemed.toLocaleString('hi-IN')}</Text>
          <Text style={styles.statLabel}>भुनाए पॉइंट</Text>
        </View>
      </View>

      {/* Tier breakdown */}
      {data.members_by_tier.length > 0 && (
        <View style={styles.tierCard}>
          <Text style={styles.tierHeading}>श्रेणी अनुसार सदस्य</Text>
          {data.members_by_tier.map((t) => (
            <View key={String(t.tier)} style={styles.tierRow}>
              <View style={[styles.tierDot, { backgroundColor: tierColor(t.tier) }]} />
              <Text style={styles.tierName}>{tierLabel(t.tier)}</Text>
              <Text style={styles.tierCount}>{t.count}</Text>
            </View>
          ))}
        </View>
      )}

      {data.members_by_tier.length === 0 && (
        <Text style={styles.emptyText}>अभी तक कोई लॉयल्टी सदस्य नहीं</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.bg },
  content:     { padding: spacing.lg, paddingBottom: 40, gap: 16 },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  heroCard:    { backgroundColor: GOLD, borderRadius: 16, padding: 28, alignItems: 'center' },
  heroValue:   { fontFamily: 'YatraOne', fontSize: 48, color: '#fff', lineHeight: 56 },
  heroLabel:   { fontFamily: 'NotoSansDevanagari', fontSize: 16, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  row2:        { flexDirection: 'row' },
  rowGap:      { width: 12 },
  statCard:    { backgroundColor: colors.background, borderRadius: 12, padding: spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statValue:   { fontFamily: 'MuktaVaani-700', fontSize: 28, color: GOLD },
  statLabel:   { fontFamily: 'NotoSansDevanagari', fontSize: 14, color: colors.inkMute, marginTop: 4 },
  tierCard:    { backgroundColor: colors.background, borderRadius: 12, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  tierHeading: { fontFamily: 'NotoSansDevanagari', fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 12 },
  tierRow:     { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 12 },
  tierDot:     { width: 14, height: 14, borderRadius: 7 },
  tierName:    { fontFamily: 'NotoSansDevanagari', fontSize: 16, color: colors.ink, flex: 1 },
  tierCount:   { fontFamily: 'MuktaVaani-700', fontSize: 18, color: colors.ink },
  errorText:   { fontFamily: 'NotoSansDevanagari', fontSize: 16, color: colors.error, marginBottom: 16 },
  retryBtn:    { backgroundColor: GOLD, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, minHeight: 48, justifyContent: 'center' },
  retryText:   { fontFamily: 'NotoSansDevanagari', fontSize: 16, color: '#fff', fontWeight: '600' },
  emptyText:   { fontFamily: 'NotoSansDevanagari', fontSize: 16, color: colors.inkMute, textAlign: 'center', marginTop: 8 },
});
