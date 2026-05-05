import React from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet, Pressable,
} from 'react-native';
import { colors, spacing } from '@goldsmith/ui-tokens';
import {
  useStockAging, formatPaise, formatWeightMg,
  type StockAgingBucket,
} from '../../src/features/reports/useReports';

const GOLD = '#B58A3C';
const ALERT = '#C53030';

const BUCKET_LABELS: Record<StockAgingBucket['label'], string> = {
  '<30d':   '0–30 दिन',
  '30-60d': '30–60 दिन',
  '60-90d': '60–90 दिन',
  '90d+':   '90+ दिन',
};

function BucketCard({ bucket }: { bucket: StockAgingBucket }): React.ReactElement {
  const isAlert = bucket.label === '90d+' && bucket.count > 0;
  return (
    <View style={[styles.bucketCard, isAlert && styles.bucketCardAlert]}>
      <Text style={[styles.bucketLabel, isAlert && styles.bucketLabelAlert]}>
        {BUCKET_LABELS[bucket.label]}
      </Text>
      <Text style={[styles.bucketCount, isAlert && styles.bucketCountAlert]}>
        {bucket.count}
      </Text>
      <Text style={styles.bucketSubLabel}>{formatWeightMg(bucket.totalWeightMg)}</Text>
      <Text style={styles.bucketSubLabel}>{formatPaise(bucket.totalCostPaise)}</Text>
    </View>
  );
}

export default function StockAgingScreen(): React.ReactElement {
  const { data, isLoading, error, refetch } = useStockAging();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {isLoading && (
        <ActivityIndicator color={GOLD} size="large" style={{ marginTop: 40 }} />
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>डेटा लोड नहीं हो सका।</Text>
          <Pressable onPress={() => void refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>पुनः प्रयास करें</Text>
          </Pressable>
        </View>
      )}

      {data && (
        <>
          <View style={styles.bucketRow}>
            {data.buckets.map((b) => <BucketCard key={b.label} bucket={b} />)}
          </View>

          <Text style={styles.sectionHeader}>प्रत्येक उत्पाद / Per-Product</Text>

          {data.items.length === 0 && (
            <Text style={styles.emptyText}>कोई स्टॉक नहीं मिला।</Text>
          )}

          {data.items.map((it) => {
            const isAged = it.bucket === '90d+';
            return (
              <View key={it.id} style={[styles.itemRow, isAged && styles.itemRowAlert]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemSku}>{it.sku}</Text>
                  <Text style={styles.itemSubLabel}>
                    {it.metal} {it.purity} · {it.weightG} g
                  </Text>
                </View>
                <View style={styles.itemRight}>
                  <Text style={[styles.itemDays, isAged && styles.itemDaysAlert]}>
                    {it.daysInStock} दिन
                  </Text>
                  <Text style={styles.itemBucket}>{BUCKET_LABELS[it.bucket]}</Text>
                </View>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.bg },
  content:          { padding: spacing.lg, paddingBottom: 40 },
  bucketRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  bucketCard:       { flexBasis: '48%', flexGrow: 1, padding: spacing.md, backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border, minHeight: 96 },
  bucketCardAlert:  { borderColor: ALERT, backgroundColor: '#FFF5F5' },
  bucketLabel:      { fontFamily: 'NotoSansDevanagari', fontSize: 13, color: colors.inkMute },
  bucketLabelAlert: { color: ALERT },
  bucketCount:      { fontFamily: 'MuktaVaani-700', fontSize: 28, color: GOLD, marginVertical: 4 },
  bucketCountAlert: { color: ALERT },
  bucketSubLabel:   { fontFamily: 'NotoSansDevanagari', fontSize: 11, color: colors.inkMute },
  sectionHeader:    { fontFamily: 'NotoSansDevanagari', fontSize: 16, fontWeight: '600', color: colors.ink, marginTop: 16, marginBottom: 8 },
  itemRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, minHeight: 48 },
  itemRowAlert:     { backgroundColor: '#FFF5F5' },
  itemSku:          { fontFamily: 'MuktaVaani-600', fontSize: 14, color: colors.ink },
  itemSubLabel:     { fontFamily: 'NotoSansDevanagari', fontSize: 12, color: colors.inkMute, marginTop: 2 },
  itemRight:        { alignItems: 'flex-end' },
  itemDays:         { fontFamily: 'MuktaVaani-600', fontSize: 14, color: colors.ink },
  itemDaysAlert:    { color: ALERT },
  itemBucket:       { fontFamily: 'NotoSansDevanagari', fontSize: 11, color: colors.inkMute, marginTop: 2 },
  emptyText:        { fontFamily: 'NotoSansDevanagari', fontSize: 14, color: colors.inkMute, textAlign: 'center', marginTop: 24 },
  errorBox:         { alignItems: 'center', marginTop: 40 },
  errorText:        { fontFamily: 'NotoSansDevanagari', fontSize: 16, color: colors.error, marginBottom: 16 },
  retryBtn:         { backgroundColor: GOLD, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, minHeight: 48, justifyContent: 'center' },
  retryText:        { fontFamily: 'NotoSansDevanagari', fontSize: 16, color: '#fff', fontWeight: '600' },
});
