import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { v4 as uuid } from 'uuid';
import { api } from '../../../src/api/client';
import type { InvoiceResponse } from '@goldsmith/shared';

interface EstimateLineItem {
  description: string;
  metalType?: string | null;
  purity?: string | null;
  netWeightG?: string | null;
  goldValuePaise: string;
  makingChargePaise: string;
  gstMetalPaise: string;
  gstMakingPaise: string;
  lineTotalPaise: string;
}

interface EstimateDetail {
  id: string;
  shopId: string;
  customerId: string | null;
  lineItems: EstimateLineItem[];
  goldRatePaisePerGram: string;
  subtotalPaise: string;
  gstPaise: string;
  totalPaise: string;
  status: 'draft' | 'sent' | 'converted' | 'expired';
  expiresAt: string | null;
  convertedInvoiceId: string | null;
  createdByUserId: string;
  createdAt: string;
}

function paiseToRupees(paise: string): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(paise) / 100);
}

function statusLabel(status: EstimateDetail['status']): string {
  switch (status) {
    case 'draft':     return 'मसौदा';
    case 'sent':      return 'भेजा गया';
    case 'converted': return 'Invoice बन गया';
    case 'expired':   return 'समय सीमा समाप्त';
  }
}

function statusColor(status: EstimateDetail['status']): string {
  switch (status) {
    case 'draft':     return '#78716c';
    case 'sent':      return '#2563eb';
    case 'converted': return '#16a34a';
    case 'expired':   return '#dc2626';
  }
}

function useExpiryCountdown(expiresAt: string | null): string | null {
  const [remaining, setRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (!expiresAt) return undefined;
    const update = (): void => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining('समाप्त'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setRemaining(`${h}घ ${m}म बचे`);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return remaining;
}

export default function EstimateDetailScreen(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [idempotencyKey] = useState<string>(() => uuid());

  const { data, isLoading, error } = useQuery<EstimateDetail>({
    queryKey: ['estimate', id],
    queryFn:  () =>
      api.get<EstimateDetail>(`/api/v1/billing/estimates/${id}`).then((r) => r.data),
  });

  const countdown = useExpiryCountdown(data?.expiresAt ?? null);

  const convertMutation = useMutation<InvoiceResponse>({
    mutationFn: () =>
      api.post<InvoiceResponse>(
        `/api/v1/billing/estimates/${id}/convert`,
        {},
        { headers: { 'Idempotency-Key': idempotencyKey } },
      ).then((r) => r.data),
    onSuccess: (invoice) => {
      void queryClient.invalidateQueries({ queryKey: ['estimate', id] });
      Alert.alert(
        'Invoice बन गया!',
        `Invoice ${invoice.invoiceNumber} बना दिया गया।`,
        [
          {
            text: 'Invoice देखें',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onPress: () => router.replace(`/billing/${invoice.id}` as any),
          },
        ],
      );
    },
    onError: (err) => {
      const body = (err as { response?: { data?: unknown; status?: number } }).response?.data;
      const code = (body as { code?: string } | null)?.code;
      if (code === 'estimate.already_converted') {
        Alert.alert('पहले से बन चुका', 'यह अनुमान पहले ही Invoice में बदल चुका है।');
        return;
      }
      if (code === 'estimate.expired') {
        Alert.alert('समय सीमा समाप्त', 'इस अनुमान की समय सीमा समाप्त हो गई है।');
        return;
      }
      const msg = (body as { message?: string } | null)?.message ?? 'कुछ गलत हो गया';
      Alert.alert('Invoice नहीं बन सका', msg);
    },
  });

  const onConvert = useCallback(() => {
    Alert.alert(
      'Invoice में बदलें?',
      `कुल: ₹${paiseToRupees(data?.totalPaise ?? '0')}\n\nक्या आप यह अनुमान Invoice में बदलना चाहते हैं?`,
      [
        { text: 'रद्द करें', style: 'cancel' },
        { text: 'Invoice बनाएं', onPress: () => convertMutation.mutate() },
      ],
    );
  }, [data?.totalPaise, convertMutation]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#92400e" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.devanagari}>अनुमान नहीं मिला</Text>
      </View>
    );
  }

  const canConvert = data.status === 'draft' || data.status === 'sent';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>अनुमान</Text>
        <View style={[styles.statusChip, { backgroundColor: statusColor(data.status) + '22' }]}>
          <Text style={[styles.statusText, { color: statusColor(data.status) }]}>
            {statusLabel(data.status)}
          </Text>
        </View>
      </View>

      {countdown != null && data.status !== 'expired' && (
        <View style={styles.countdownRow}>
          <Text style={styles.countdownText}>⏳ {countdown}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>दर (प्रति ग्राम)</Text>
        <Text style={styles.rateText}>
          ₹{paiseToRupees(data.goldRatePaisePerGram)}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>आइटम</Text>
        {data.lineItems.map((li, i) => (
          <View key={i} style={styles.lineItem}>
            <Text style={styles.lineDesc}>{li.description}</Text>
            <Text style={styles.lineTotal}>
              ₹{paiseToRupees(li.lineTotalPaise)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.totalsCard}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>उप-कुल</Text>
          <Text style={styles.totalValue}>₹{paiseToRupees(data.subtotalPaise)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>GST</Text>
          <Text style={styles.totalValue}>₹{paiseToRupees(data.gstPaise)}</Text>
        </View>
        <View style={[styles.totalRow, styles.grandTotalRow]}>
          <Text style={styles.grandTotalLabel}>कुल अनुमान</Text>
          <Text style={styles.grandTotalValue}>₹{paiseToRupees(data.totalPaise)}</Text>
        </View>
      </View>

      {data.convertedInvoiceId != null && (
        <Pressable
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPress={() => router.push(`/billing/${data.convertedInvoiceId}` as any)}
          style={styles.viewInvoiceBtn}
          accessibilityRole="button"
        >
          <Text style={styles.viewInvoiceBtnText}>Invoice देखें →</Text>
        </Pressable>
      )}

      {canConvert && (
        <Pressable
          onPress={onConvert}
          disabled={convertMutation.isPending}
          style={[styles.convertButton, convertMutation.isPending && styles.convertButtonDisabled]}
          accessibilityRole="button"
          accessibilityState={{ disabled: convertMutation.isPending }}
        >
          <Text style={styles.convertButtonText}>
            {convertMutation.isPending ? 'Invoice बन रहा है...' : 'Invoice में बदलें'}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#fafaf9' },
  content:            { padding: 16, paddingBottom: 40 },
  center:             { flex: 1, justifyContent: 'center', alignItems: 'center' },
  devanagari:         { fontFamily: 'NotoSansDevanagari', fontSize: 16 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  title: {
    fontSize: 22, fontWeight: '700',
    fontFamily: 'NotoSansDevanagari',
  },
  statusChip: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  statusText: {
    fontSize: 13, fontWeight: '600',
    fontFamily: 'NotoSansDevanagari',
  },
  countdownRow: {
    backgroundColor: '#fff7ed', borderRadius: 8,
    borderWidth: 1, borderColor: '#fed7aa',
    padding: 10, marginBottom: 12, alignItems: 'center',
  },
  countdownText: {
    fontFamily: 'NotoSansDevanagari', fontSize: 14, color: '#9a3412',
  },
  card: {
    backgroundColor: '#ffffff', borderRadius: 12,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#e7e5e4',
  },
  sectionLabel: {
    fontSize: 13, color: '#78716c', marginBottom: 8,
    fontFamily: 'NotoSansDevanagari',
  },
  rateText: {
    fontSize: 20, fontWeight: '700', color: '#92400e',
    fontFamily: 'NotoSansDevanagari',
  },
  lineItem: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f4',
  },
  lineDesc: {
    flex: 1, fontFamily: 'NotoSansDevanagari', fontSize: 15,
  },
  lineTotal: {
    fontFamily: 'NotoSansDevanagari', fontSize: 15, fontWeight: '600', color: '#1c1917',
  },
  totalsCard: {
    backgroundColor: '#ffffff', borderRadius: 12,
    padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#e7e5e4',
  },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6,
  },
  grandTotalRow: {
    borderTopWidth: 1, borderTopColor: '#e7e5e4',
    marginTop: 6, paddingTop: 10,
  },
  totalLabel: {
    fontSize: 15, color: '#78716c', fontFamily: 'NotoSansDevanagari',
  },
  totalValue: {
    fontSize: 15, fontFamily: 'NotoSansDevanagari', color: '#1c1917',
  },
  grandTotalLabel: {
    fontSize: 17, fontWeight: '700', fontFamily: 'NotoSansDevanagari', color: '#1c1917',
  },
  grandTotalValue: {
    fontSize: 18, fontWeight: '700', color: '#92400e',
    fontFamily: 'NotoSansDevanagari',
  },
  viewInvoiceBtn: {
    borderWidth: 1.5, borderColor: '#16a34a', borderRadius: 10,
    paddingVertical: 13, alignItems: 'center',
    marginBottom: 12, minHeight: 48,
    backgroundColor: '#f0fdf4',
  },
  viewInvoiceBtnText: {
    fontFamily: 'NotoSansDevanagari', fontSize: 15, color: '#16a34a', fontWeight: '600',
  },
  convertButton: {
    backgroundColor: '#92400e', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', minHeight: 48,
  },
  convertButtonDisabled: { opacity: 0.5 },
  convertButtonText: {
    color: '#ffffff', fontSize: 18, fontWeight: '700',
    fontFamily: 'NotoSansDevanagari',
  },
});
