import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

interface RateLockDetail {
  id: string;
  customerId: string;
  lockedRate24kPaisePerGram: string;
  lockedAt: string;
  expiresAt: string;
  depositAmountPaise: string;
  depositPaidPaise: string;
  razorpayOrderId: string | null;
  status: string;
}

const KARAT_FRACTIONS: { label: string; fraction: number }[] = [
  { label: '24K', fraction: 1 },
  { label: '22K', fraction: 22 / 24 },
  { label: '20K', fraction: 20 / 24 },
  { label: '18K', fraction: 18 / 24 },
  { label: '14K', fraction: 14 / 24 },
];

function formatRupees(paise: string | number): string {
  return `₹${Math.round(Number(paise) / 100).toLocaleString('en-IN')}`;
}

function expiryCountdown(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'समाप्त हो गया';
  const days  = Math.floor(diff / 86400_000);
  const hours = Math.floor((diff % 86400_000) / 3600_000);
  const mins  = Math.floor((diff % 3600_000) / 60_000);
  if (days > 0) return `${days} दिन ${hours} घंटे बचे`;
  return `${hours} घंटे ${mins} मिनट बचे`;
}

interface Props {
  bookingId: string;
  onCreateInvoice: (customerId: string) => void;
}

export function RateLockDetailScreen({
  bookingId,
  onCreateInvoice,
}: Props): React.ReactElement {
  const [countdown, setCountdown] = useState('');

  const { data: booking, isLoading, isError } = useQuery<RateLockDetail>({
    queryKey: ['rate-lock-booking', bookingId],
    queryFn: () =>
      api
        .get<RateLockDetail>(`/api/v1/rate-lock/bookings/${bookingId}`)
        .then((r) => r.data),
  });

  useEffect(() => {
    if (!booking) return;
    setCountdown(expiryCountdown(booking.expiresAt));
    const timer = setInterval(
      () => setCountdown(expiryCountdown(booking.expiresAt)),
      60_000,
    );
    return () => clearInterval(timer);
  }, [booking]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#B8860B" size="large" />
      </View>
    );
  }

  if (isError || !booking) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText} accessibilityRole="alert">
          जानकारी लोड नहीं हो सकी।
        </Text>
      </View>
    );
  }

  const base24kRupees = Math.round(Number(booking.lockedRate24kPaisePerGram) / 100);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>दर बुकिंग विवरण</Text>

      {/* Locked rates by karat */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>बंद की गई दरें</Text>
        {KARAT_FRACTIONS.map(({ label, fraction }) => (
          <View key={label} style={styles.rateRow}>
            <Text style={styles.karatLabel}>{label}</Text>
            <Text style={styles.rateValue}>
              ₹{Math.round(base24kRupees * fraction).toLocaleString('en-IN')}/g
            </Text>
          </View>
        ))}
      </View>

      {/* Expiry countdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>समाप्ति</Text>
        <Text style={styles.countdown} accessibilityRole="timer">
          {countdown}
        </Text>
        <Text style={styles.expiryDate}>
          {new Date(booking.expiresAt).toLocaleDateString('hi-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Text>
      </View>

      {/* Deposit received */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>जमा राशि</Text>
        <Text style={styles.depositText}>
          {formatRupees(booking.depositPaidPaise)} प्राप्त
        </Text>
      </View>

      {/* Razorpay order ID — selectable for copy */}
      {booking.razorpayOrderId != null ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Razorpay ऑर्डर ID</Text>
          <Text
            style={styles.orderId}
            selectable
            accessibilityLabel={`Razorpay ऑर्डर ID: ${booking.razorpayOrderId}`}
          >
            {booking.razorpayOrderId}
          </Text>
          <Text style={styles.copyHint}>दबाकर रखें — कॉपी करें</Text>
        </View>
      ) : null}

      {/* Invoice CTA — only for ACTIVE bookings */}
      {booking.status === 'ACTIVE' ? (
        <TouchableOpacity
          style={styles.invoiceBtn}
          onPress={() => onCreateInvoice(booking.customerId)}
          accessibilityLabel="इनवॉइस बनाएं"
          accessibilityRole="button"
        >
          <Text style={styles.invoiceBtnText}>इनवॉइस बनाएं</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBF5' },
  content:   { padding: 20 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  heading:   { fontSize: 22, fontWeight: '700', color: '#1C1917', marginBottom: 20 },
  section:   {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rateRow:      {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  karatLabel:   { fontSize: 16, color: '#374151', fontWeight: '500' },
  rateValue:    { fontSize: 16, color: '#1C1917', fontWeight: '700' },
  countdown:    { fontSize: 20, fontWeight: '700', color: '#059669', marginBottom: 4 },
  expiryDate:   { fontSize: 14, color: '#6B7280' },
  depositText:  { fontSize: 18, fontWeight: '600', color: '#1C1917' },
  orderId:      {
    fontSize: 14,
    color: '#6366F1',
    fontFamily: 'monospace',
    minHeight: 44,
    textAlignVertical: 'center',
  },
  copyHint:     { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  invoiceBtn:   {
    backgroundColor: '#B8860B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  invoiceBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  errorText:    { color: '#DC2626', fontSize: 16 },
});
