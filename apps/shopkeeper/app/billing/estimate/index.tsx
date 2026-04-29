import React from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../src/api/client';

interface EstimateSummary {
  id: string;
  totalPaise: string;
  status: 'draft' | 'sent' | 'converted' | 'expired';
  createdAt: string;
  customerId: string | null;
}

function paiseToRupees(paise: string): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(paise) / 100);
}

const STATUS_CONFIG: Record<EstimateSummary['status'], { label: string; color: string; bg: string }> = {
  draft:     { label: 'मसौदा',           color: '#78716c', bg: '#f5f5f4' },
  sent:      { label: 'भेजा गया',       color: '#1d4ed8', bg: '#eff6ff' },
  converted: { label: 'Invoice बन गया', color: '#15803d', bg: '#f0fdf4' },
  expired:   { label: 'समाप्त',         color: '#b91c1c', bg: '#fef2f2' },
};

function EstimateCard({ item }: { item: EstimateSummary }): JSX.Element {
  const cfg = STATUS_CONFIG[item.status];
  const date = new Date(item.createdAt).toLocaleDateString('hi-IN', {
    day: 'numeric', month: 'short',
  });

  return (
    <TouchableOpacity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onPress={() => router.push(`/billing/estimate/${item.id}` as any)}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`अनुमान ₹${paiseToRupees(item.totalPaise)}, स्थिति: ${cfg.label}`}
    >
      <View style={styles.cardTop}>
        <Text style={styles.amount}>₹{paiseToRupees(item.totalPaise)}</Text>
        <View style={[styles.statusChip, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
      <Text style={styles.date}>{date}</Text>
    </TouchableOpacity>
  );
}

export default function EstimateListScreen(): JSX.Element {
  const { data, isLoading, error, refetch } = useQuery<EstimateSummary[]>({
    queryKey: ['estimates'],
    queryFn:  () =>
      api.get<EstimateSummary[]>('/api/v1/billing/estimates').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#92400e" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.devanagari}>अनुमान लोड नहीं हो सके</Text>
        <Pressable onPress={() => void refetch()} style={styles.retryBtn} accessibilityRole="button">
          <Text style={styles.retryText}>फिर कोशिश करें</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.title}>अनुमान</Text>
            <Pressable
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onPress={() => router.push('/billing/estimate/new' as any)}
              style={styles.newBtn}
              accessibilityRole="button"
            >
              <Text style={styles.newBtnText}>+ नया अनुमान</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>कोई अनुमान नहीं मिला</Text>
            <Text style={styles.emptySubtext}>
              ग्राहक को price बताने के लिए अनुमान बनाएं
            </Text>
            <Pressable
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onPress={() => router.push('/billing/estimate/new' as any)}
              style={styles.emptyBtn}
              accessibilityRole="button"
            >
              <Text style={styles.emptyBtnText}>पहला अनुमान बनाएं</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => <EstimateCard item={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  list:      { padding: 16 },
  listHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  title: {
    fontSize: 22, fontWeight: '700',
    fontFamily: 'NotoSansDevanagari',
  },
  newBtn: {
    backgroundColor: '#92400e', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10, minHeight: 44,
    justifyContent: 'center',
  },
  newBtnText: {
    color: '#ffffff', fontSize: 14, fontWeight: '600',
    fontFamily: 'NotoSansDevanagari',
  },
  card: {
    backgroundColor: '#ffffff', borderRadius: 12,
    padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#e7e5e4',
    minHeight: 80,
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  amount: {
    fontSize: 18, fontWeight: '700', color: '#1c1917',
    fontFamily: 'NotoSansDevanagari',
  },
  statusChip: {
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4,
  },
  statusText: {
    fontSize: 12, fontWeight: '600', fontFamily: 'NotoSansDevanagari',
  },
  date: {
    fontSize: 13, color: '#78716c', fontFamily: 'NotoSansDevanagari',
  },
  devanagari: { fontFamily: 'NotoSansDevanagari', fontSize: 16, marginBottom: 12 },
  retryBtn: {
    borderWidth: 1, borderColor: '#92400e', borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 10, minHeight: 44,
  },
  retryText: { color: '#92400e', fontFamily: 'NotoSansDevanagari', fontSize: 14 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: {
    fontSize: 18, fontWeight: '600', color: '#1c1917', marginBottom: 8,
    fontFamily: 'NotoSansDevanagari',
  },
  emptySubtext: {
    fontSize: 14, color: '#78716c', textAlign: 'center',
    fontFamily: 'NotoSansDevanagari', marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: '#92400e', borderRadius: 10,
    paddingHorizontal: 24, paddingVertical: 14, minHeight: 48,
  },
  emptyBtnText: {
    color: '#ffffff', fontSize: 16, fontWeight: '700',
    fontFamily: 'NotoSansDevanagari',
  },
});
