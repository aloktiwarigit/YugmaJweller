import React, { useState } from 'react';
import {
  View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet,
} from 'react-native';
import { colors, spacing } from '@goldsmith/ui-tokens';
import { useDailySummary, formatPaise, formatWeightMg } from '../../src/features/reports/useReports';

const GOLD = '#B58A3C';

function shiftDate(date: string, delta: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function todayIST(): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return new Intl.DateTimeFormat('hi-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(dt);
}

interface StatRowProps { label: string; value: string }

function StatRow({ label, value }: StatRowProps): React.ReactElement {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export default function DailySummaryScreen(): React.ReactElement {
  const today = todayIST();
  const [date, setDate] = useState(today);
  const { data, isLoading, error, refetch } = useDailySummary(date);

  const canGoForward = date < today;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Date picker */}
      <View style={styles.datePicker}>
        <Pressable
          onPress={() => setDate(shiftDate(date, -1))}
          style={styles.arrow}
          accessibilityLabel="पिछला दिन"
          hitSlop={12}
        >
          <Text style={styles.arrowText}>{'‹'}</Text>
        </Pressable>
        <Text style={styles.dateLabel}>{formatDate(date)}</Text>
        <Pressable
          onPress={() => canGoForward ? setDate(shiftDate(date, 1)) : undefined}
          style={[styles.arrow, !canGoForward && styles.arrowDisabled]}
          accessibilityLabel="अगला दिन"
          disabled={!canGoForward}
          hitSlop={12}
        >
          <Text style={[styles.arrowText, !canGoForward && styles.arrowTextDisabled]}>{'›'}</Text>
        </Pressable>
      </View>

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
        <View style={styles.card}>
          <Text style={styles.totalAmount}>{formatPaise(data.total_paise)}</Text>
          <Text style={styles.totalLabel}>कुल बिक्री</Text>

          <View style={styles.divider} />

          <StatRow label="नकद"             value={formatPaise(data.cash_paise)} />
          <StatRow label="UPI"              value={formatPaise(data.upi_paise)} />
          <StatRow label="अन्य"             value={formatPaise(data.other_paise)} />
          <StatRow label="चालान संख्या"     value={`${data.invoice_count}`} />
          <StatRow label="सोना बिका"        value={formatWeightMg(data.gold_weight_mg)} />
        </View>
      )}

      {data && data.invoice_count === 0 && (
        <Text style={styles.emptyText}>इस दिन कोई चालान नहीं</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.bg },
  content:        { padding: spacing.lg, paddingBottom: 40 },
  datePicker:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  arrow:          { paddingHorizontal: 16, paddingVertical: 8, minHeight: 48, justifyContent: 'center' },
  arrowDisabled:  { opacity: 0.3 },
  arrowText:      { fontSize: 28, color: GOLD, lineHeight: 32 },
  arrowTextDisabled: { color: colors.inkMute },
  dateLabel:      { fontFamily: 'NotoSansDevanagari', fontSize: 18, fontWeight: '600', color: colors.ink, minWidth: 180, textAlign: 'center' },
  card:           { backgroundColor: colors.background, borderRadius: 12, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  totalAmount:    { fontFamily: 'MuktaVaani-700', fontSize: 36, color: GOLD, textAlign: 'center' },
  totalLabel:     { fontFamily: 'NotoSansDevanagari', fontSize: 16, color: colors.inkMute, textAlign: 'center', marginBottom: 16 },
  divider:        { height: 1, backgroundColor: colors.border, marginVertical: 16 },
  statRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  statLabel:      { fontFamily: 'NotoSansDevanagari', fontSize: 16, color: colors.ink },
  statValue:      { fontFamily: 'MuktaVaani-600', fontSize: 16, color: colors.ink },
  errorBox:       { alignItems: 'center', marginTop: 40 },
  errorText:      { fontFamily: 'NotoSansDevanagari', fontSize: 16, color: colors.error, marginBottom: 16 },
  retryBtn:       { backgroundColor: GOLD, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, minHeight: 48, justifyContent: 'center' },
  retryText:      { fontFamily: 'NotoSansDevanagari', fontSize: 16, color: '#fff', fontWeight: '600' },
  emptyText:      { fontFamily: 'NotoSansDevanagari', fontSize: 16, color: colors.inkMute, textAlign: 'center', marginTop: 32 },
});
