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
import { v4 as uuid } from 'uuid';
import { BillingLineBuilder } from '@goldsmith/ui-mobile';
import type { BillingLineValue, BillingLineProduct } from '@goldsmith/ui-mobile';
import { api } from '../../src/api/client';
import type { InvoiceResponse, CreateInvoiceDtoType } from '@goldsmith/shared';
import { PanPromptSheet } from '../../src/features/billing/components/PanPromptSheet';
import type { PanSubmitPayload } from '../../src/features/billing/components/PanPromptSheet';

interface DraftLine extends BillingLineValue {
  product: BillingLineProduct;
  ratePerGramPaise: bigint;
}

function extractTotalPaise(errorBody: unknown): bigint {
  try {
    const body = errorBody as { totalPaise?: string } | null | undefined;
    const raw = body?.totalPaise;
    if (raw != null) return BigInt(raw);
  } catch {
    // fall through
  }
  return 0n;
}

export default function NewInvoiceScreen(): JSX.Element {
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [idempotencyKey] = useState<string>(() => uuid());

  // PAN prompt state
  const [panRequired, setPanRequired] = useState(false);
  const [panTotalPaise, setPanTotalPaise] = useState(0n);

  const createInvoice = useMutation<InvoiceResponse, unknown, CreateInvoiceDtoType>({
    mutationFn: async (dto) => {
      const res = await api.post<InvoiceResponse>('/api/v1/billing/invoices', dto, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
      return res.data;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (invoice) => router.replace(`/billing/${invoice.id}` as any),
    onError: (err) => {
      const body = (err as { response?: { data?: unknown; status?: number } }).response?.data;
      const status = (err as { response?: { status?: number } }).response?.status;
      const code = (body as { code?: string } | null | undefined)?.code;

      if (status === 422 && code === 'compliance.pan_required') {
        const totalPaise = extractTotalPaise(body);
        setPanTotalPaise(totalPaise);
        setPanRequired(true);
        return;
      }

      const message = (body as { detail?: string } | null | undefined)?.detail
        ?? (err instanceof Error ? err.message : 'कुछ गलत हो गया');
      Alert.alert('Invoice generate नहीं हुआ', message);
    },
  });

  const buildDto = useCallback(
    (extra: PanSubmitPayload = {}): CreateInvoiceDtoType => ({
      customerName: customerName.trim(),
      ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
      lines: lines.map((l) => ({
        productId: l.productId,
        description: l.description,
        huid: l.huid,
        makingChargePct: l.makingChargePct,
        stoneChargesPaise: '0',
        hallmarkFeePaise: '0',
      })),
      ...(extra.pan ? { pan: extra.pan } : {}),
      ...(extra.form60Data ? { form60Data: extra.form60Data } : {}),
    }),
    [customerName, customerPhone, lines],
  );

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
    createInvoice.mutate(buildDto());
  }, [customerName, lines, buildDto, createInvoice]);

  const onPanSubmit = useCallback(
    (payload: PanSubmitPayload) => {
      setPanRequired(false);
      createInvoice.mutate(buildDto(payload));
    },
    [buildDto, createInvoice],
  );

  const onPanCancel = useCallback(() => {
    setPanRequired(false);
    setPendingDto(null);
  }, []);

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>नया Invoice</Text>

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
            key={`${line.productId}-${i}`}
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

        <Pressable
          onPress={onSubmit}
          disabled={createInvoice.isPending}
          style={[
            styles.submitButton,
            createInvoice.isPending && styles.submitButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: createInvoice.isPending }}
        >
          <Text style={styles.submitButtonText}>
            {createInvoice.isPending ? 'Generate हो रहा है...' : 'Invoice बनाएं'}
          </Text>
        </Pressable>
      </ScrollView>

      <PanPromptSheet
        visible={panRequired}
        totalPaise={panTotalPaise}
        onSubmit={onPanSubmit}
        onCancel={onPanCancel}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf9' },
  content: { padding: 16 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    fontFamily: 'NotoSansDevanagari',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
    fontFamily: 'NotoSansDevanagari',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d6d3d1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
    minHeight: 48,
  },
  scanButton: {
    backgroundColor: '#e7e5e4',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 48,
  },
  scanButtonText: {
    fontSize: 16,
    fontFamily: 'NotoSansDevanagari',
  },
  submitButton: {
    backgroundColor: '#92400e',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 48,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'NotoSansDevanagari',
  },
});
