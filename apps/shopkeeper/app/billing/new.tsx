import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { v4 as uuid } from 'uuid';
import {
  BillingLineBuilder,
  type BillingLineValue,
  type BillingLineProduct,
  type PublicRatesResponse,
} from '@goldsmith/ui-mobile';
import { api } from '../../src/api/client';
import type { InvoiceResponse, CreateInvoiceDtoType, ProductResponse } from '@goldsmith/shared';
import { PanPromptSheet } from '../../src/features/billing/components/PanPromptSheet';
import type { PanSubmitPayload } from '../../src/features/billing/components/PanPromptSheet';
import { InvoiceTypeToggle } from '../../src/features/billing/components/InvoiceTypeToggle';
import { CustomerSearch } from '../../src/features/crm/components/CustomerSearch';
import type { CustomerHit } from '../../src/features/crm/components/CustomerSearch';
import { LoyaltyRedeemSheet } from '../../src/features/billing/components/LoyaltyRedeemSheet';
import { PaymentMethodSelector } from '../../src/features/billing/components/PaymentMethodSelector';
import {
  BillingProductPicker,
  draftFromProduct,
  type BillingProductDraft,
} from '../../src/features/billing/components/BillingProductPicker';

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
  const params = useLocalSearchParams<{ productId?: string }>();
  const initialProductId = typeof params.productId === 'string' ? params.productId : '';
  const addedInitialProductIdRef = useRef<string | null>(null);
  const [invoiceType, setInvoiceType] = useState<'B2C' | 'B2B_WHOLESALE'>('B2C');
  const [buyerGstin, setBuyerGstin] = useState<string>('');
  const [buyerBusinessName, setBuyerBusinessName] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0);
  const [showLoyaltySheet, setShowLoyaltySheet] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [createdInvoice, setCreatedInvoice] = useState<InvoiceResponse | null>(null);
  const [idempotencyKey] = useState<string>(() => uuid());

  // PAN prompt state
  const [panRequired, setPanRequired] = useState(false);
  const [panTotalPaise, setPanTotalPaise] = useState(0n);

  const initialProductQuery = useQuery<ProductResponse>({
    queryKey: ['billing-initial-product', initialProductId],
    queryFn: async () =>
      (await api.get<ProductResponse>(`/api/v1/inventory/products/${initialProductId}`)).data,
    enabled: initialProductId.length > 0,
  });

  const ratesQuery = useQuery<PublicRatesResponse>({
    queryKey: ['catalog', 'rates'],
    queryFn: async () => (await api.get<PublicRatesResponse>('/api/v1/catalog/rates')).data,
    enabled: initialProductId.length > 0,
    staleTime: 55_000,
  });

  const createInvoice = useMutation<InvoiceResponse, unknown, CreateInvoiceDtoType>({
    mutationFn: async (dto) => {
      const res = await api.post<InvoiceResponse>('/api/v1/billing/invoices', dto, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
      return res.data;
    },
    onSuccess: (invoice) => setCreatedInvoice(invoice),
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
      Alert.alert('बिल नहीं बना', message);
    },
  });

  const buildDto = useCallback(
    (extra: PanSubmitPayload = {}): CreateInvoiceDtoType => ({
      customerName: customerName.trim(),
      ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
      ...(customerId != null ? { customerId } : {}),
      lines: lines.map((l) => ({
        productId: l.productId,
        description: l.description,
        huid: l.huid,
        // B2B_WHOLESALE: omit makingChargePct so server-side WHOLESALE category lookup applies
        ...(invoiceType !== 'B2B_WHOLESALE' ? { makingChargePct: l.makingChargePct } : {}),
        stoneChargesPaise: '0',
        hallmarkFeePaise: '0',
      })),
      invoiceType,
      ...(invoiceType === 'B2B_WHOLESALE' && buyerGstin.length === 15 ? { buyerGstin } : {}),
      ...(invoiceType === 'B2B_WHOLESALE' && buyerBusinessName.trim()
        ? { buyerBusinessName: buyerBusinessName.trim() }
        : {}),
      ...(extra.pan ? { pan: extra.pan } : {}),
      ...(extra.form60Data ? { form60Data: extra.form60Data } : {}),
      ...(loyaltyPointsToRedeem > 0 ? { loyaltyPointsToRedeem } : {}),
    }),
    [
      customerName,
      customerPhone,
      customerId,
      lines,
      invoiceType,
      buyerGstin,
      buyerBusinessName,
      loyaltyPointsToRedeem,
    ],
  );

  const onLineChange = useCallback((index: number, next: BillingLineValue) => {
    setLines((curr) => {
      const copy = [...curr];
      copy[index] = { ...copy[index]!, ...next };
      return copy;
    });
  }, []);

  const onAddProduct = useCallback((draft: BillingProductDraft) => {
    setLines((curr) => [
      ...curr,
      {
        productId: draft.product.id,
        description: draft.product.description,
        huid: draft.product.huid,
        makingChargePct: draft.makingChargePct,
        product: draft.product,
        ratePerGramPaise: draft.ratePerGramPaise,
      },
    ]);
  }, []);

  const onRemoveLine = useCallback((index: number) => {
    setLines((curr) => curr.filter((_, i) => i !== index));
  }, []);

  useEffect(() => {
    if (
      !initialProductId ||
      addedInitialProductIdRef.current === initialProductId ||
      !initialProductQuery.data ||
      !ratesQuery.data
    ) {
      return;
    }
    const draft = draftFromProduct(initialProductQuery.data, ratesQuery.data);
    if (draft === null) return;
    onAddProduct(draft);
    addedInitialProductIdRef.current = initialProductId;
  }, [initialProductId, initialProductQuery.data, onAddProduct, ratesQuery.data]);

  const onSubmit = useCallback(() => {
    if (invoiceType === 'B2B_WHOLESALE' && buyerGstin.length !== 15) {
      Alert.alert('GSTIN 15 अक्षर का होना चाहिए');
      return;
    }
    if (!customerName.trim()) {
      Alert.alert('ग्राहक का नाम आवश्यक है');
      return;
    }
    if (lines.length === 0) {
      Alert.alert('कम से कम एक आइटम जोड़ें');
      return;
    }
    createInvoice.mutate(buildDto());
  }, [invoiceType, buyerGstin, customerName, lines, buildDto, createInvoice]);

  const onPanSubmit = useCallback(
    (payload: PanSubmitPayload) => {
      setPanRequired(false);
      createInvoice.mutate(buildDto(payload));
    },
    [buildDto, createInvoice],
  );

  const onPanCancel = useCallback(() => {
    setPanRequired(false);
  }, []);

  const handleCustomerSelect = useCallback((hit: CustomerHit) => {
    setCustomerId(hit.id);
    setCustomerName(hit.name);
    setLoyaltyPointsToRedeem(0);
  }, []);

  const handleCustomerSearch = useCallback(
    (q: string) =>
      api.get<{ hits: CustomerHit[]; total: number; source: 'meilisearch' | 'postgres' }>(
        '/api/v1/crm/customers/search',
        { params: { q } },
      ).then((r) => r.data),
    [],
  );

  const clearCustomer = useCallback(() => {
    setCustomerId(null);
    setLoyaltyPointsToRedeem(0);
  }, []);

  if (createdInvoice !== null) {
    return (
      <PaymentMethodSelector
        invoiceId={createdInvoice.id}
        invoiceTotalPaise={BigInt(createdInvoice.totalPaise)}
        existingDailyPaiseCash={0n}
        onInitiateUpi={async (amountPaise) => {
          const res = await api.post<{ orderId: string }>(
            `/api/v1/billing/invoices/${createdInvoice.id}/payments/upi`,
            { amountPaise: amountPaise.toString() },
          );
          return res.data;
        }}
        onRecordCash={async (amountPaise, paymentIdempotencyKey) => {
          await api.post(
            `/api/v1/billing/invoices/${createdInvoice.id}/payments/cash`,
            { amountPaise: amountPaise.toString() },
            { headers: { 'Idempotency-Key': paymentIdempotencyKey } },
          );
        }}
        onRecordManual={async (method, amountPaise) => {
          await api.post(`/api/v1/billing/invoices/${createdInvoice.id}/payments/manual`, {
            method,
            amountPaise: amountPaise.toString(),
          });
        }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onComplete={() => router.replace(`/billing/${createdInvoice.id}?celebrate=1` as any)}
      />
    );
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>नया बिल</Text>

        <InvoiceTypeToggle
          invoiceType={invoiceType}
          buyerGstin={buyerGstin}
          buyerBusinessName={buyerBusinessName}
          onInvoiceTypeChange={setInvoiceType}
          onBuyerGstinChange={setBuyerGstin}
          onBuyerBusinessNameChange={setBuyerBusinessName}
        />

        <View style={styles.card}>
          <Text style={styles.label}>ग्राहक का नाम *</Text>
          <TextInput
            value={customerName}
            onChangeText={setCustomerName}
            style={styles.input}
            placeholder="नाम लिखें"
            accessibilityLabel="ग्राहक का नाम"
          />
          <Text style={styles.label}>फ़ोन (वैकल्पिक)</Text>
          <TextInput
            value={customerPhone}
            onChangeText={setCustomerPhone}
            keyboardType="phone-pad"
            maxLength={10}
            style={styles.input}
            placeholder="9876543210"
            accessibilityLabel="ग्राहक का फोन"
          />

          <Text style={styles.label}>CRM से ग्राहक खोजें (वैकल्पिक)</Text>
          {customerId == null ? (
            <CustomerSearch
              onSearch={handleCustomerSearch}
              onSelect={handleCustomerSelect}
            />
          ) : (
            <View style={styles.selectedCustomerChip}>
              <Text style={styles.selectedCustomerText} numberOfLines={1}>
                {customerName}
              </Text>
              <TouchableOpacity
                onPress={clearCustomer}
                accessibilityRole="button"
                accessibilityLabel="ग्राहक हटाएं"
                style={styles.chipClearBtn}
              >
                <Text style={styles.chipClearText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {customerId != null && (
          loyaltyPointsToRedeem === 0 ? (
            <TouchableOpacity
              style={styles.loyaltyButton}
              onPress={() => setShowLoyaltySheet(true)}
              accessibilityRole="button"
              accessibilityLabel="लॉयल्टी पॉइंट भुनाएं"
            >
              <Text style={styles.loyaltyButtonText}>🎁 लॉयल्टी पॉइंट भुनाएं</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.loyaltyChip}>
              <Text style={styles.loyaltyChipText}>
                🎁 {loyaltyPointsToRedeem} पॉइंट भुनाए गए (₹{Math.floor(loyaltyPointsToRedeem / 100)} छूट)
              </Text>
              <TouchableOpacity
                onPress={() => setLoyaltyPointsToRedeem(0)}
                accessibilityRole="button"
                accessibilityLabel="लॉयल्टी छूट हटाएं"
                style={styles.chipClearBtn}
              >
                <Text style={styles.chipClearText}>✕</Text>
              </TouchableOpacity>
            </View>
          )
        )}

        <BillingProductPicker onAddProduct={onAddProduct} />

        {lines.map((line, i) => (
          <View key={`${line.productId}-${i}`} style={styles.lineWrapper}>
            <BillingLineBuilder
              product={line.product}
              ratePerGramPaise={line.ratePerGramPaise}
              makingChargePct={line.makingChargePct}
              onChange={(v) => onLineChange(i, v)}
            />
            <TouchableOpacity
              onPress={() => onRemoveLine(i)}
              style={styles.removeLineButton}
              accessibilityRole="button"
              accessibilityLabel="आइटम हटाएं"
            >
              <Text style={styles.removeLineButtonText}>आइटम हटाएं</Text>
            </TouchableOpacity>
          </View>
        ))}

        <Pressable
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPress={() => router.push('/billing/scan' as any)}
          style={styles.scanButton}
          accessibilityRole="button"
          accessibilityLabel="बारकोड स्कैन"
        >
          <Text style={styles.scanButtonText}>बारकोड स्कैन</Text>
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
            {createInvoice.isPending ? 'बिल बन रहा है...' : 'बिल बनाएं'}
          </Text>
        </Pressable>
      </ScrollView>

      <PanPromptSheet
        visible={panRequired}
        totalPaise={panTotalPaise}
        onSubmit={onPanSubmit}
        onCancel={onPanCancel}
      />

      {showLoyaltySheet && customerId != null && (
        <LoyaltyRedeemSheet
          customerId={customerId}
          onRedeem={(points) => {
            setLoyaltyPointsToRedeem(points);
            setShowLoyaltySheet(false);
          }}
          onClose={() => setShowLoyaltySheet(false)}
        />
      )}
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
  selectedCustomerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B8860B',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
    marginTop: 4,
  },
  selectedCustomerText: {
    flex: 1,
    fontFamily: 'NotoSansDevanagari',
    fontSize: 15,
    color: '#5C3D11',
  },
  chipClearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipClearText: {
    fontSize: 14,
    color: '#7A5400',
  },
  loyaltyButton: {
    borderWidth: 1.5,
    borderColor: '#B8860B',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 48,
    backgroundColor: '#FFFDF7',
  },
  loyaltyButtonText: {
    fontFamily: 'NotoSansDevanagari',
    fontSize: 15,
    color: '#7A5400',
  },
  loyaltyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#B8860B',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    minHeight: 48,
  },
  loyaltyChipText: {
    flex: 1,
    fontFamily: 'NotoSansDevanagari',
    fontSize: 14,
    color: '#5C3D11',
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
    fontFamily: 'MuktaVaani-400',
  },
  lineWrapper: {
    marginBottom: 8,
  },
  removeLineButton: {
    alignSelf: 'flex-end',
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  removeLineButtonText: {
    color: '#B1402B',
    fontSize: 14,
    fontWeight: '700',
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
