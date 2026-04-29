import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { BillingLineBuilder } from '@goldsmith/ui-mobile';
import type { BillingLineValue, BillingLineProduct } from '@goldsmith/ui-mobile';
import { api } from '../../../src/api/client';

export interface EstimateResponse {
  id: string;
  shopId: string;
  customerId: string | null;
  lineItems: object[];
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

// Estimate line carries pre-computed values for snapshotted rate at invoice conversion
interface DraftLine extends BillingLineValue {
  product: BillingLineProduct;
  ratePerGramPaise: bigint;
  goldValuePaise: bigint;
  makingChargePaise: bigint;
  gstMetalPaise: bigint;
  gstMakingPaise: bigint;
  lineTotalPaise: bigint;
}

interface CreateEstimateBody {
  lineItems: object[];
  goldRatePaisePerGram: string;
  subtotalPaise: string;
  gstPaise: string;
  totalPaise: string;
  customerId?: string;
}

export default function NewEstimateScreen(): JSX.Element {
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [lines, setLines] = useState<DraftLine[]>([]);

  const createEstimate = useMutation<EstimateResponse, unknown, CreateEstimateBody>({
    mutationFn: async (body) => {
      const res = await api.post<EstimateResponse>('/api/v1/billing/estimates', body);
      return res.data;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (est) => router.replace(`/billing/estimate/${est.id}` as any),
    onError: (err) => {
      const body = (err as { response?: { data?: unknown } }).response?.data;
      const msg  = (body as { message?: string } | null)?.message ?? 'कुछ गलत हो गया';
      Alert.alert('अनुमान नहीं बन सका', msg);
    },
  });

  const onLineChange = useCallback((index: number, next: BillingLineValue) => {
    setLines((curr) => {
      const copy = [...curr];
      copy[index] = { ...copy[index]!, ...next };
      return copy;
    });
  }, []);

  const onSubmit = useCallback(() => {
    if (!customerName.trim()) {
      Alert.alert('ग्राहक का नाम आवश्यक है');
      return;
    }
    if (lines.length === 0) {
      Alert.alert('कम से कम एक आइटम जोड़ें');
      return;
    }

    // Aggregate snapshotted amounts from all draft lines
    let subtotal = 0n;
    let gst      = 0n;
    let total    = 0n;
    const ratesPerGram: bigint[] = lines.map((l) => l.ratePerGramPaise);
    const dominantRate = ratesPerGram[0] ?? 0n;

    const lineItems = lines.map((l, i) => {
      const lineTotal = l.lineTotalPaise;
      const lineGst   = l.gstMetalPaise + l.gstMakingPaise;
      const lineSub   = l.goldValuePaise + l.makingChargePaise;
      subtotal += lineSub;
      gst      += lineGst;
      total    += lineTotal;
      return {
        productId:         l.productId ?? null,
        description:       l.description,
        hsnCode:           '7113',
        huid:              l.huid ?? null,
        metalType:         'GOLD',
        purity:            null,
        netWeightG:        null,
        ratePerGramPaise:  l.ratePerGramPaise.toString(),
        makingChargePct:   l.makingChargePct,
        goldValuePaise:    l.goldValuePaise.toString(),
        makingChargePaise: l.makingChargePaise.toString(),
        stoneChargesPaise: '0',
        hallmarkFeePaise:  '0',
        gstMetalPaise:     l.gstMetalPaise.toString(),
        gstMakingPaise:    l.gstMakingPaise.toString(),
        lineTotalPaise:    l.lineTotalPaise.toString(),
        sortOrder:         i,
      };
    });

    createEstimate.mutate({
      lineItems,
      goldRatePaisePerGram: dominantRate.toString(),
      subtotalPaise:        subtotal.toString(),
      gstPaise:             gst.toString(),
      totalPaise:           total.toString(),
    });
  }, [customerName, lines, createEstimate]);

  const totalPaise = lines.reduce((s, l) => s + l.lineTotalPaise, 0n);
  const totalRupees = Number(totalPaise) / 100;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>नया अनुमान</Text>
      <Text style={styles.subtitle}>(Estimate / Proforma)</Text>

      <View style={styles.card}>
        <Text style={styles.label}>ग्राहक का नाम *</Text>
        <TextInput
          value={customerName}
          onChangeText={setCustomerName}
          style={styles.input}
          placeholder="नाम लिखें"
          accessibilityLabel="Customer name"
        />
        <Text style={styles.label}>फ़ोन (वैकल्पिक)</Text>
        <TextInput
          value={customerPhone}
          onChangeText={setCustomerPhone}
          keyboardType="phone-pad"
          maxLength={10}
          style={styles.input}
          placeholder="9876543210"
          accessibilityLabel="Customer phone"
        />
      </View>

      {lines.map((line, i) => (
        <BillingLineBuilder
          key={`${line.productId ?? 'manual'}-${i}`}
          product={line.product}
          ratePerGramPaise={line.ratePerGramPaise}
          makingChargePct={line.makingChargePct}
          onChange={(v) => onLineChange(i, v)}
        />
      ))}

      <Pressable
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onPress={() => router.push('/billing/scan' as any)}
        style={styles.scanButton}
        accessibilityRole="button"
      >
        <Text style={styles.scanButtonText}>+ बारकोड स्कैन करें</Text>
      </Pressable>

      {totalPaise > 0n && (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>अनुमानित कुल:</Text>
          <Text style={styles.totalValue}>
            ₹{new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(totalRupees)}
          </Text>
        </View>
      )}

      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          यह अनुमान है — भुगतान अभी नहीं लिया जाएगा। Invoice बाद में बनाएं।
        </Text>
      </View>

      <Pressable
        onPress={onSubmit}
        disabled={createEstimate.isPending}
        style={[styles.submitButton, createEstimate.isPending && styles.submitButtonDisabled]}
        accessibilityRole="button"
        accessibilityState={{ disabled: createEstimate.isPending }}
      >
        <Text style={styles.submitButtonText}>
          {createEstimate.isPending ? 'बन रहा है...' : 'अनुमान बनाएं'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#fafaf9' },
  content:     { padding: 16, paddingBottom: 40 },
  title: {
    fontSize: 22, fontWeight: '700', marginBottom: 4,
    fontFamily: 'NotoSansDevanagari',
  },
  subtitle: {
    fontSize: 13, color: '#78716c', marginBottom: 16,
    fontFamily: 'NotoSansDevanagari',
  },
  card: {
    backgroundColor: '#ffffff', borderRadius: 12,
    padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#e7e5e4',
  },
  label: {
    fontSize: 14, marginBottom: 4, fontFamily: 'NotoSansDevanagari',
  },
  input: {
    borderWidth: 1, borderColor: '#d6d3d1', borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 12,
    fontSize: 16, marginBottom: 12, minHeight: 48,
  },
  scanButton: {
    backgroundColor: '#e7e5e4', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
    marginBottom: 12, minHeight: 48,
  },
  scanButtonText: { fontSize: 16, fontFamily: 'NotoSansDevanagari' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF8E1', borderRadius: 10,
    borderWidth: 1.5, borderColor: '#B8860B',
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 12, minHeight: 48,
  },
  totalLabel: {
    fontSize: 16, fontFamily: 'NotoSansDevanagari', color: '#5C3D11',
  },
  totalValue: {
    fontSize: 18, fontWeight: '700', color: '#92400e',
    fontFamily: 'NotoSansDevanagari',
  },
  notice: {
    backgroundColor: '#f0fdf4', borderRadius: 8,
    borderWidth: 1, borderColor: '#bbf7d0',
    padding: 12, marginBottom: 16,
  },
  noticeText: {
    fontSize: 13, color: '#166534', fontFamily: 'NotoSansDevanagari',
  },
  submitButton: {
    backgroundColor: '#78716c', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', minHeight: 48,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: {
    color: '#ffffff', fontSize: 18, fontWeight: '700',
    fontFamily: 'NotoSansDevanagari',
  },
});
