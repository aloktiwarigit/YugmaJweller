import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../../../api/client';

interface PurchaseHistorySummary {
  invoiceId:      string;
  invoiceNumber:  string;
  issuedAt:       string | null;
  totalFormatted: string;
  lineCount:      number;
  paymentMethod:  string;
  status:         string;
}

interface PurchaseHistoryResponse {
  invoices: PurchaseHistorySummary[];
  total:    number;
}

const PAGE_SIZE = 20;

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH:    'नकद',
  UPI:     'UPI',
  CARD:    'कार्ड',
  CHEQUE:  'चेक',
  SPLIT:   'मिश्रित',
  PENDING: 'बाकी',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('hi-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface Props {
  customerId: string;
}

export function PurchaseHistoryList({ customerId }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [offset, setOffset] = useState(0);
  const [allInvoices, setAllInvoices] = useState<PurchaseHistorySummary[]>([]);
  const [total, setTotal] = useState(0);

  const { isLoading, isFetching } = useQuery<PurchaseHistoryResponse>({
    queryKey: ['purchase-history', customerId, offset],
    queryFn:  async () =>
      (await api.get<PurchaseHistoryResponse>(
        `/api/v1/crm/customers/${customerId}/history?limit=${PAGE_SIZE}&offset=${offset}`,
      )).data,
    onSuccess(data) {
      if (offset === 0) {
        setAllInvoices(data.invoices);
      } else {
        setAllInvoices((prev) => [...prev, ...data.invoices]);
      }
      setTotal(data.total);
    },
    keepPreviousData: true,
  });

  const loadMore = useCallback(() => {
    if (!isFetching && allInvoices.length < total) {
      setOffset((prev) => prev + PAGE_SIZE);
    }
  }, [isFetching, allInvoices.length, total]);

  const handlePress = useCallback(
    (invoiceId: string) => {
      navigation.navigate('billing', { screen: 'invoice-detail', params: { id: invoiceId } });
    },
    [navigation],
  );

  if (isLoading && offset === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#B8860B" />
      </View>
    );
  }

  if (allInvoices.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>अभी तक कोई खरीद नहीं</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={allInvoices}
      keyExtractor={(item) => item.invoiceId}
      contentContainerStyle={styles.list}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      ListFooterComponent={
        isFetching ? <ActivityIndicator style={styles.footer} color="#B8860B" /> : null
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.row}
          onPress={() => handlePress(item.invoiceId)}
          accessibilityRole="button"
          accessibilityLabel={`चालान ${item.invoiceNumber}, ${item.totalFormatted}`}
        >
          <View style={styles.rowLeft}>
            <Text style={styles.invoiceDate}>{formatDate(item.issuedAt)}</Text>
            <Text style={styles.invoiceNumber}>#{item.invoiceNumber}</Text>
          </View>
          <View style={styles.rowRight}>
            <Text style={styles.total}>{item.totalFormatted}</Text>
            <View style={styles.badges}>
              <View style={[styles.badge, styles.paymentBadge]}>
                <Text style={styles.badgeText}>
                  {PAYMENT_METHOD_LABELS[item.paymentMethod] ?? item.paymentMethod}
                </Text>
              </View>
              <View style={[styles.badge, styles.countBadge]}>
                <Text style={styles.badgeText}>{item.lineCount} वस्तुएं</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  empty:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyText:     { fontSize: 16, color: '#888', fontFamily: 'NotoSansDevanagari' },
  list:          { paddingHorizontal: 16, paddingBottom: 32 },
  footer:        { paddingVertical: 16 },
  row: {
    flexDirection:    'row',
    justifyContent:   'space-between',
    alignItems:       'center',
    backgroundColor:  '#FFFDF7',
    borderRadius:     10,
    paddingHorizontal: 14,
    paddingVertical:  14,
    marginBottom:     10,
    // minimum touch target
    minHeight:        56,
    shadowColor:      '#C8A951',
    shadowOpacity:    0.08,
    shadowRadius:     4,
    shadowOffset:     { width: 0, height: 2 },
    elevation:        2,
  },
  rowLeft:       { flex: 1, gap: 2 },
  rowRight:      { alignItems: 'flex-end', gap: 6 },
  invoiceDate:   { fontSize: 13, color: '#888', fontFamily: 'NotoSansDevanagari' },
  invoiceNumber: { fontSize: 15, fontWeight: '600', color: '#3D2B00' },
  total:         { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  badges:        { flexDirection: 'row', gap: 6 },
  badge: {
    borderRadius:   4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  paymentBadge:  { backgroundColor: '#E8F4FD' },
  countBadge:    { backgroundColor: '#F5F5F5' },
  badgeText:     { fontSize: 12, color: '#555', fontFamily: 'NotoSansDevanagari' },
});
