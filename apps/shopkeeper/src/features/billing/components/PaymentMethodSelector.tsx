import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet,
} from 'react-native';

// Section 269ST: daily cash limit is Rs 1,99,999 per customer.
const SECTION_269ST_LIMIT_PAISE = 199_999_00n;
const WARN_THRESHOLD_PAISE      = 180_000_00n; // warn at Rs 1,80,000

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'NET_BANKING' | 'OLD_GOLD' | 'SCHEME';

export interface PaymentLine {
  method:    PaymentMethod;
  amountPaise: bigint;
}

export interface PaymentMethodSelectorProps {
  invoiceId:        string;
  invoiceTotalPaise: bigint;
  existingDailyPaiseCash: bigint; // for 269ST inline warning
  onInitiateUpi:    (amountPaise: bigint) => Promise<{ orderId: string }>;
  onRecordCash:     (amountPaise: bigint, idempotencyKey: string) => Promise<void>;
  onRecordManual:   (method: Exclude<PaymentMethod, 'CASH' | 'UPI'>, amountPaise: bigint) => Promise<void>;
  onComplete:       () => void;
}

function formatRupees(paise: bigint): string {
  return new Intl.NumberFormat('hi-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(paise) / 100);
}

const METHODS: { key: PaymentMethod; label: string }[] = [
  { key: 'CASH',        label: 'नकद' },
  { key: 'UPI',         label: 'UPI / QR' },
  { key: 'CARD',        label: 'कार्ड' },
  { key: 'NET_BANKING', label: 'नेट बैंकिंग' },
  { key: 'OLD_GOLD',    label: 'पुराना सोना' },
  { key: 'SCHEME',      label: 'स्कीम' },
];

export function PaymentMethodSelector({
  invoiceTotalPaise,
  existingDailyPaiseCash,
  onInitiateUpi,
  onRecordCash,
  onRecordManual,
  onComplete,
}: PaymentMethodSelectorProps): React.ReactElement {
  const [lines, setLines] = useState<Record<PaymentMethod, string>>({
    CASH: '', UPI: '', CARD: '', NET_BANKING: '', OLD_GOLD: '', SCHEME: '',
  });
  const [upiOrderId, setUpiOrderId]   = useState<string | null>(null);
  const [loading, setLoading]         = useState<PaymentMethod | null>(null);
  const [error, setError]             = useState<string | null>(null);

  const totalEnteredPaise = Object.values(lines).reduce((sum, v) => {
    const n = v ? BigInt(Math.round(parseFloat(v) * 100)) : 0n;
    return sum + n;
  }, 0n);

  const remainingPaise = invoiceTotalPaise - totalEnteredPaise;
  const allAllocated   = remainingPaise === 0n && totalEnteredPaise > 0n;

  const cashPaise = lines['CASH'] ? BigInt(Math.round(parseFloat(lines['CASH']) * 100)) : 0n;
  const projectedCashPaise = existingDailyPaiseCash + cashPaise;
  const cashNearLimit = projectedCashPaise >= WARN_THRESHOLD_PAISE;
  const cashOverLimit = projectedCashPaise >= SECTION_269ST_LIMIT_PAISE;

  function setAmount(method: PaymentMethod, value: string): void {
    setLines(prev => ({ ...prev, [method]: value }));
  }

  async function handleUpi(): Promise<void> {
    const amt = lines['UPI'] ? BigInt(Math.round(parseFloat(lines['UPI']) * 100)) : 0n;
    if (amt <= 0n) { setError('UPI राशि दर्ज करें'); return; }
    setError(null);
    setLoading('UPI');
    try {
      const { orderId } = await onInitiateUpi(amt);
      setUpiOrderId(orderId);
    } catch {
      setError('UPI ऑर्डर विफल। पुनः प्रयास करें।');
    } finally {
      setLoading(null);
    }
  }

  async function handleComplete(): Promise<void> {
    if (!allAllocated) return;
    setError(null);

    try {
      if (cashPaise > 0n) {
        const idempKey = `cash_${Date.now()}`;
        await onRecordCash(cashPaise, idempKey);
      }
      for (const method of ['CARD', 'NET_BANKING', 'OLD_GOLD', 'SCHEME'] as const) {
        const amt = lines[method] ? BigInt(Math.round(parseFloat(lines[method]) * 100)) : 0n;
        if (amt > 0n) await onRecordManual(method, amt);
      }
      onComplete();
    } catch {
      setError('भुगतान विफल। पुनः प्रयास करें।');
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>भुगतान विधि</Text>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>कुल देय:</Text>
        <Text style={styles.totalAmount}>{formatRupees(invoiceTotalPaise)}</Text>
      </View>

      {METHODS.map(({ key, label }) => (
        <View key={key} style={styles.methodBlock}>
          <View style={styles.methodHeader}>
            <Text style={styles.methodLabel}>{label}</Text>
            {key === 'UPI' && upiOrderId && (
              <View style={styles.upiOrderBadge}>
                <Text style={styles.upiOrderText}>Order: {upiOrderId.slice(-8)}</Text>
              </View>
            )}
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.currencyPrefix}>₹</Text>
            <TextInput
              style={styles.input}
              value={lines[key]}
              onChangeText={v => setAmount(key, v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#aaa"
              accessibilityLabel={`${label} राशि`}
            />

            {key === 'UPI' && (
              <Pressable
                style={[styles.actionButton, loading === 'UPI' && styles.actionButtonDisabled]}
                onPress={handleUpi}
                disabled={loading === 'UPI'}
                accessibilityRole="button"
                accessibilityLabel="QR दिखाएं"
              >
                {loading === 'UPI'
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.actionButtonText}>QR दिखाएं</Text>
                }
              </Pressable>
            )}
          </View>

          {key === 'CASH' && cashNearLimit && !cashOverLimit && (
            <Text style={styles.warnText}>
              ⚠️ नकद सीमा के करीब: {formatRupees(projectedCashPaise)} / ₹1,99,999
            </Text>
          )}
          {key === 'CASH' && cashOverLimit && (
            <Text style={styles.errorText}>
              ❌ धारा 269ST: ₹1,99,999 से अधिक नकद नहीं — पर्यवेक्षक ओवरराइड आवश्यक
            </Text>
          )}
        </View>
      ))}

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>शेष राशि:</Text>
        <Text style={[styles.summaryAmount, remainingPaise < 0n && styles.overAmount]}>
          {formatRupees(remainingPaise < 0n ? -remainingPaise : remainingPaise)}
          {remainingPaise < 0n ? ' (अधिक)' : ''}
        </Text>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Pressable
        style={[styles.completeButton, !allAllocated && styles.completeButtonDisabled]}
        onPress={handleComplete}
        disabled={!allAllocated}
        accessibilityRole="button"
        accessibilityLabel="भुगतान पूरा करें"
        accessibilityState={{ disabled: !allAllocated }}
      >
        <Text style={[styles.completeButtonText, !allAllocated && styles.completeButtonTextDisabled]}>
          भुगतान पूरा करें
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#FDF9F0' },
  content:          { padding: 16, paddingBottom: 32 },
  title:            { fontSize: 22, fontWeight: '700', color: '#2C1810', marginBottom: 16 },
  totalRow:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#D4A843' },
  totalLabel:       { fontSize: 16, color: '#5C3D1E' },
  totalAmount:      { fontSize: 20, fontWeight: '700', color: '#2C1810' },
  methodBlock:      { marginBottom: 16, backgroundColor: '#fff', borderRadius: 8, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  methodHeader:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  methodLabel:      { fontSize: 16, fontWeight: '600', color: '#2C1810' },
  upiOrderBadge:    { marginLeft: 8, backgroundColor: '#E8F5E9', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  upiOrderText:     { fontSize: 11, color: '#2E7D32' },
  inputRow:         { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  currencyPrefix:   { fontSize: 18, color: '#5C3D1E', marginRight: 4 },
  input:            { flex: 1, fontSize: 18, color: '#2C1810', borderBottomWidth: 1, borderBottomColor: '#D4A843', paddingVertical: 4, minHeight: 48 },
  actionButton:     { marginLeft: 8, backgroundColor: '#D4A843', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  actionButtonDisabled: { opacity: 0.5 },
  actionButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  warnText:         { marginTop: 4, fontSize: 13, color: '#B8860B' },
  errorText:        { marginTop: 4, fontSize: 13, color: '#B71C1C' },
  summaryRow:       { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#D4A843' },
  summaryLabel:     { fontSize: 16, color: '#5C3D1E' },
  summaryAmount:    { fontSize: 18, fontWeight: '700', color: '#2C1810' },
  overAmount:       { color: '#B71C1C' },
  completeButton:   { marginTop: 20, backgroundColor: '#D4A843', borderRadius: 8, paddingVertical: 16, alignItems: 'center', minHeight: 52 },
  completeButtonDisabled: { backgroundColor: '#E8D4A0', opacity: 0.7 },
  completeButtonText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  completeButtonTextDisabled: { color: '#9E9E9E' },
});
