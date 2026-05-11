import React from 'react';
import {
  View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet,
} from 'react-native';
import { colors, spacing } from '@goldsmith/ui-tokens';
import { useCustomerLtv, formatPaise } from '../../src/features/reports/useReports';
import type { CustomerLtvItem } from '../../src/features/reports/useReports';
import { ExportButtons } from '../../src/features/reports/components/ExportButtons';

const GOLD = '#B58A3C';

function maskPhone(phone: string): string {
  if (phone.length < 4) return '—';
  return `XXXX${phone.slice(-4)}`;
}

function RankBadge({ rank }: { rank: number }): React.ReactElement {
  const bg = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : colors.bg;
  const text = rank === 1 ? '#7B5800' : rank === 2 ? '#3A3A3A' : rank === 3 ? '#4B2B00' : colors.inkMute;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: text }]}>{rank}</Text>
    </View>
  );
}

function LtvRow({ item, rank }: { item: CustomerLtvItem; rank: number }): React.ReactElement {
  return (
    <View style={styles.row} accessibilityRole="none">
      <RankBadge rank={rank} />
      <View style={styles.rowMid}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.phone}>{maskPhone(item.phone)}</Text>
      </View>
      <Text style={styles.ltv}>{formatPaise(item.ltv_paise)}</Text>
    </View>
  );
}

export default function CustomerLtvScreen(): React.ReactElement {
  const { data, isLoading, error, refetch } = useCustomerLtv(20);

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

  if (!data || data.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>अभी तक कोई ग्राहक नहीं</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ExportButtons reportType="customer-ltv" csvParams={{}} pdfParams={{}} />

      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>शीर्ष {data.length} ग्राहक — कुल खरीद के आधार पर</Text>
      </View>
      <FlatList
        data={data}
        keyExtractor={(item) => item.customer_id}
        renderItem={({ item, index }) => <LtvRow item={item} rank={index + 1} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.bg },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  headerRow:   { paddingHorizontal: spacing.lg, paddingVertical: 12, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerLabel: { fontFamily: 'NotoSansDevanagari', fontSize: 13, color: colors.inkMute },
  row:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 14, backgroundColor: colors.background, minHeight: 64 },
  badge:       { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  badgeText:   { fontFamily: 'MuktaVaani-700', fontSize: 15 },
  rowMid:      { flex: 1, gap: 2 },
  name:        { fontFamily: 'NotoSansDevanagari', fontSize: 16, fontWeight: '700', color: colors.ink },
  phone:       { fontFamily: 'NotoSansDevanagari', fontSize: 13, color: colors.inkMute },
  ltv:         { fontFamily: 'MuktaVaani-700', fontSize: 16, color: GOLD },
  separator:   { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  errorText:   { fontFamily: 'NotoSansDevanagari', fontSize: 16, color: colors.error, marginBottom: 16 },
  retryBtn:    { backgroundColor: GOLD, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, minHeight: 48, justifyContent: 'center' },
  retryText:   { fontFamily: 'NotoSansDevanagari', fontSize: 16, color: '#fff', fontWeight: '600' },
  emptyText:   { fontFamily: 'NotoSansDevanagari', fontSize: 18, color: colors.inkMute },
});
