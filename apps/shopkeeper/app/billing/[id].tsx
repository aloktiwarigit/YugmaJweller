import { View, Text, ScrollView, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { InvoiceLineItem } from '@goldsmith/ui-mobile';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/stores/authStore';
import { VoidInvoiceSheet } from '../../src/features/billing/components/VoidInvoiceSheet';
import type { InvoiceResponse } from '@goldsmith/shared';

function paiseToRupees(paise: string): string {
  const n = Number(paise) / 100;
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function InvoiceDetailScreen(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userRole = useAuthStore((s) => s.user?.role);
  const [voidSheetVisible, setVoidSheetVisible] = useState(false);

  const { data, isLoading, error } = useQuery<InvoiceResponse>({
    queryKey: ['invoice', id],
    queryFn:  () =>
      api.get<InvoiceResponse>(`/api/v1/billing/invoices/${id}`).then((r) => r.data),
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.devanagari}>Invoice नहीं मिला</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.invoiceNumber}>{data.invoiceNumber}</Text>
      <Text style={[styles.customerName, styles.devanagari]}>{data.customerName}</Text>
      <Text style={[styles.status, styles.devanagari]}>
        {data.status === 'ISSUED' ? 'जारी' : data.status}
      </Text>

      <View style={styles.card}>
        {data.lines.map((line) => (
          <InvoiceLineItem key={line.id} item={line} />
        ))}
      </View>

      <View style={styles.card}>
        <Row label="Subtotal" value={paiseToRupees(data.subtotalPaise)} />
        <Row label="GST (3% धातु)" value={paiseToRupees(data.gstMetalPaise)} />
        <Row label="GST (5% मेकिंग)" value={paiseToRupees(data.gstMakingPaise)} />
        <View style={styles.totalRow}>
          <Row label="कुल" value={paiseToRupees(data.totalPaise)} bold />
        </View>
      </View>

      {/* Void / Credit Note — OWNER only, not shown for already-voided invoices */}
      {userRole === 'shop_admin' && data.status === 'ISSUED' && (
        <Pressable
          onPress={() => setVoidSheetVisible(true)}
          style={styles.voidBtn}
          accessibilityRole="button"
          accessibilityLabel="Invoice रद्द करें"
        >
          <Text style={styles.voidBtnText}>रद्द करें</Text>
        </Pressable>
      )}

      {data.status === 'VOIDED' && (
        <View style={styles.voidedBadge}>
          <Text style={styles.voidedText}>Invoice रद्द हो चुकी है</Text>
          {data.voidReason ? (
            <Text style={styles.voidReason}>कारण: {data.voidReason}</Text>
          ) : null}
        </View>
      )}

      {data && (
        <VoidInvoiceSheet
          visible={voidSheetVisible}
          invoice={data}
          userRole={userRole}
          onClose={() => setVoidSheetVisible(false)}
          onSuccess={() => setVoidSheetVisible(false)}
        />
      )}
    </ScrollView>
  );
}

function Row({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}): JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={[bold ? styles.boldText : styles.normalText, styles.devanagari]}>
        {label}
      </Text>
      <Text style={bold ? styles.boldText : styles.normalText}>₹{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#fafaf9' },
  content:       { padding: 16 },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  invoiceNumber: { fontSize: 12, color: '#78716c' },      // stone-500
  customerName:  { fontSize: 22, fontWeight: '700', marginTop: 4 },
  status:        { fontSize: 14, color: '#57534e', marginTop: 4 }, // stone-600
  card:          {
    marginTop: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalRow:  { borderTopWidth: 1, borderTopColor: '#e7e5e4', marginTop: 8, paddingTop: 8 },
  boldText:  { fontSize: 16, fontWeight: '700' },
  normalText: { fontSize: 14 },
  devanagari: { fontFamily: 'NotoSansDevanagari' },
  voidBtn: {
    marginTop: 20,
    marginHorizontal: 0,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 56,
  },
  voidBtnText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'NotoSansDevanagari',
    color: '#b91c1c',
  },
  voidedBadge: {
    marginTop: 20,
    backgroundColor: '#f5f5f4',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#d6d3d1',
  },
  voidedText: {
    fontSize: 15,
    fontFamily: 'NotoSansDevanagari',
    color: '#78716c',
    fontWeight: '600',
  },
  voidReason: {
    fontSize: 13,
    fontFamily: 'NotoSansDevanagari',
    color: '#a8a29e',
    marginTop: 4,
  },
});
