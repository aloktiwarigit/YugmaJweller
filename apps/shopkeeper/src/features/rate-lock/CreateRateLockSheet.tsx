import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';

interface RatesResponse {
  GOLD_24K: { perGramPaise: string };
}

interface CreateBookingResult {
  bookingId:                 string;
  razorpayOrderId:           string;
  expiresAt:                 string;
  lockedRate24kPaisePerGram: string;
}

interface Props {
  customerId: string;
  onSuccess:  (result: CreateBookingResult) => void;
  onClose:    () => void;
}

export function CreateRateLockSheet({
  customerId,
  onSuccess,
  onClose,
}: Props): React.ReactElement {
  const [depositRupees, setDepositRupees] = useState('');
  const [error, setError]                 = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: rates, isLoading: ratesLoading } = useQuery<RatesResponse>({
    queryKey: ['current-rates'],
    queryFn: () =>
      api.get<RatesResponse>('/api/v1/rates/current').then((r) => r.data),
  });

  const { mutate: createBooking, isPending } = useMutation({
    mutationFn: (depositAmountPaise: string) =>
      api
        .post<CreateBookingResult>('/api/v1/rate-lock/bookings', {
          customerId,
          depositAmountPaise,
        })
        .then((r) => r.data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['rate-lock-bookings', customerId] });
      onSuccess(result);
    },
    onError: (err: unknown) => {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === 'rate_lock.already_active') {
        setError('इस ग्राहक की एक दर बुकिंग पहले से सक्रिय है।');
      } else {
        setError('बुकिंग नहीं बन सकी। पुनः प्रयास करें।');
      }
    },
  });

  const live24kRupees =
    rates?.GOLD_24K?.perGramPaise != null
      ? Math.round(Number(rates.GOLD_24K.perGramPaise) / 100)
      : null;

  function handleSubmit(): void {
    setError(null);
    const rupees = parseInt(depositRupees.trim(), 10);
    if (!depositRupees.trim() || Number.isNaN(rupees) || rupees <= 0) {
      setError('कृपया वैध जमा राशि दर्ज करें');
      return;
    }
    // Use BigInt to avoid float precision issues on paise conversion
    const depositAmountPaise = (BigInt(rupees) * 100n).toString();
    createBooking(depositAmountPaise);
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>नई दर बुकिंग</Text>

          {ratesLoading ? (
            <ActivityIndicator color="#B8860B" style={styles.loader} />
          ) : live24kRupees != null ? (
            <View style={styles.rateBox}>
              <Text style={styles.rateLabel}>आज की 24K सोने की दर</Text>
              <Text style={styles.rateValue}>
                ₹{live24kRupees.toLocaleString('en-IN')}/g
              </Text>
            </View>
          ) : null}

          <Text style={styles.inputLabel}>जमा राशि (₹)</Text>
          <TextInput
            style={styles.input}
            value={depositRupees}
            onChangeText={(v) => {
              setDepositRupees(v);
              setError(null);
            }}
            keyboardType="numeric"
            placeholder="जैसे: 500"
            accessibilityLabel="जमा राशि दर्ज करें"
            maxLength={8}
          />

          {error != null ? (
            <Text style={styles.errorText} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[styles.submitBtn, isPending && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={isPending}
            accessibilityLabel="Razorpay से भुगतान करें"
            accessibilityRole="button"
            accessibilityState={{ disabled: isPending }}
          >
            {isPending ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Razorpay से भुगतान करें</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onClose}
            accessibilityLabel="रद्द करें"
          >
            <Text style={styles.cancelBtnText}>रद्द करें</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#FFFBF5',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title:             { fontSize: 20, fontWeight: '700', color: '#1C1917', marginBottom: 20 },
  rateBox:           {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  rateLabel:         { fontSize: 13, color: '#92400E', marginBottom: 4 },
  rateValue:         { fontSize: 24, fontWeight: '800', color: '#78350F' },
  inputLabel:        {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 14,
    fontSize: 17,
    backgroundColor: '#FFF',
    minHeight: 52,
    marginBottom: 8,
  },
  errorText:         { color: '#DC2626', fontSize: 14, marginBottom: 12 },
  submitBtn: {
    backgroundColor: '#B8860B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    marginBottom: 12,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText:     { color: '#FFF', fontSize: 17, fontWeight: '700' },
  cancelBtn:         {
    alignItems: 'center',
    padding: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelBtnText:     { color: '#6B7280', fontSize: 16 },
  loader:            { marginBottom: 20 },
});
