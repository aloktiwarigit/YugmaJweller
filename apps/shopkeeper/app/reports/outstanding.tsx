import React, { useState } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet,
} from 'react-native';
import { colors, spacing } from '@goldsmith/ui-tokens';
import { useOutstanding, formatPaise } from '../../src/features/reports/useReports';
import type { OutstandingItem } from '../../src/features/reports/useReports';

const GOLD = '#B58A3C';
const PAGE_LIMIT = 20;

function maskPhone(phone: string | null): string {
  if (!phone || phone.length < 4) return '—';
  return `XXXX${phone.slice(-4)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('hi-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

function OutstandingRow({ item }: { item: OutstandingItem }): React.ReactElement {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.invoiceNum}>{item.invoice_number}</Text>
        <Text style={styles.customerName}>{item.customer_name}</Text>
        <Text style={styles.meta}>{maskPhone(item.customer_phone)} · {formatDate(item.issued_at)}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.balanceDue}>{formatPaise(item.balance_due_paise)}</Text>
        <Text style={styles.balanceLabel}>बकाया</Text>
      </View>
    </View>
  );
}

export default function OutstandingScreen(): React.ReactElement {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useOutstanding(page, PAGE_LIMIT);

  const totalPages = data ? Math.ceil(data.total / PAGE_LIMIT) : 0;

  return (
    <View style={styles.container}>
      {isLoading && (
        <ActivityIndicator color={GOLD} size="large" style={{ marginTop: 60 }} />
      )}

      {error && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>डेटा लोड नहीं हो सका।</Text>
          <Pressable onPress={() => void refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>पुनः प्रयास करें</Text>
          </Pressable>
        </View>
      )}

      {data && (
        <>
          <View style={styles.header}>
            <Text style={styles.headerText}>कुल {data.total} लंबित चालान</Text>
          </View>

          {data.items.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>कोई बकाया भुगतान नहीं 🎉</Text>
            </View>
          ) : (
            <FlatList
              data={data.items}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <OutstandingRow item={item} />}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          )}

          {totalPages > 1 && (
            <View style={styles.pagination}>
              <Pressable
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
                accessibilityLabel="पिछला पृष्ठ"
              >
                <Text style={styles.pageBtnText}>‹ पिछला</Text>
              </Pressable>
              <Text style={styles.pageInfo}>{page} / {totalPages}</Text>
              <Pressable
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={[styles.pageBtn, page === totalPages && styles.pageBtnDisabled]}
                accessibilityLabel="अगला पृष्ठ"
              >
                <Text style={styles.pageBtnText}>अगला ›</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.bg },
  header:         { paddingHorizontal: spacing.lg, paddingVertical: 12, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerText:     { fontFamily: 'NotoSansDevanagari', fontSize: 14, color: colors.inkMute },
  row:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 14, backgroundColor: colors.background, minHeight: 72 },
  rowLeft:        { flex: 1, marginRight: spacing.md, gap: 2 },
  invoiceNum:     { fontFamily: 'MuktaVaani-600', fontSize: 14, color: colors.inkMute },
  customerName:   { fontFamily: 'NotoSansDevanagari', fontSize: 16, fontWeight: '700', color: colors.ink },
  meta:           { fontFamily: 'NotoSansDevanagari', fontSize: 13, color: colors.inkMute },
  rowRight:       { alignItems: 'flex-end' },
  balanceDue:     { fontFamily: 'MuktaVaani-700', fontSize: 18, color: colors.error },
  balanceLabel:   { fontFamily: 'NotoSansDevanagari', fontSize: 12, color: colors.inkMute },
  separator:      { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  centered:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  errorText:      { fontFamily: 'NotoSansDevanagari', fontSize: 16, color: colors.error, marginBottom: 16 },
  retryBtn:       { backgroundColor: GOLD, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, minHeight: 48, justifyContent: 'center' },
  retryText:      { fontFamily: 'NotoSansDevanagari', fontSize: 16, color: '#fff', fontWeight: '600' },
  emptyText:      { fontFamily: 'NotoSansDevanagari', fontSize: 18, color: colors.inkMute },
  pagination:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  pageBtn:        { minHeight: 48, paddingHorizontal: 16, justifyContent: 'center' },
  pageBtnDisabled:{ opacity: 0.3 },
  pageBtnText:    { fontFamily: 'NotoSansDevanagari', fontSize: 16, color: GOLD, fontWeight: '600' },
  pageInfo:       { fontFamily: 'NotoSansDevanagari', fontSize: 15, color: colors.ink },
});
