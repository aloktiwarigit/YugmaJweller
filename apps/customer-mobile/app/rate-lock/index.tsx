import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Linking,
} from 'react-native';
import Constants from 'expo-constants';
import { useMutation, useQuery } from '@tanstack/react-query';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { useCustomerSession } from '../../src/hooks/useCustomerSession';
import { getPublicRates, createCustomerRateLockBooking } from '../../src/api/endpoints';
import type { RateLockBookingResult } from '../../src/api/endpoints';

const API_BASE =
  (Constants.expoConfig?.extra?.['apiBaseUrl'] as string | undefined) ?? 'http://localhost:3000';

function ConfirmationCard({ booking }: { booking: RateLockBookingResult }): React.ReactElement {
  const lockedRate = Math.round(Number(booking.lockedRate24kPaisePerGram) / 100);
  const expiry = new Date(booking.expiresAt).toLocaleDateString('hi-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const openPayment = (): void => {
    // Opens the server-hosted Razorpay Standard Checkout page in the system browser.
    // The page loads checkout.js and opens the payment modal for the Razorpay order.
    // Webhook on server activates the booking once payment is captured.
    const url = `${API_BASE}/api/v1/customer/rate-lock/bookings/${booking.bookingId}/payment-page`;
    void Linking.openURL(url);
  };

  return (
    <View
      style={{
        backgroundColor: '#F0FDF4',
        borderRadius: radii.md,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: '#A7F3D0',
      }}
    >
      <Text
        style={{
          fontFamily: typography.headingMid.family,
          fontSize: 18,
          color: '#065F46',
          marginBottom: spacing.md,
        }}
      >
        बुकिंग बनाई गई
      </Text>
      <View style={{ marginBottom: spacing.sm }}>
        <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: '#6B7280' }}>
          बंद की गई 24K दर
        </Text>
        <Text style={{ fontFamily: typography.headingMid.family, fontSize: 22, color: colors.ink }}>
          ₹{lockedRate.toLocaleString('en-IN')}/g
        </Text>
      </View>
      <View style={{ marginBottom: spacing.md }}>
        <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: '#6B7280' }}>
          वैध तारीख तक
        </Text>
        <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: colors.ink }}>
          {expiry}
        </Text>
      </View>
      <Pressable
        onPress={openPayment}
        style={{
          backgroundColor: '#B8860B',
          borderRadius: radii.sm,
          paddingVertical: spacing.md,
          alignItems: 'center',
          minHeight: 52,
          justifyContent: 'center',
        }}
        accessibilityLabel="Razorpay पर भुगतान करें"
        accessibilityRole="button"
      >
        <Text style={{ fontFamily: typography.body.family, fontSize: 16, color: colors.white, fontWeight: '700' }}>
          Razorpay पर भुगतान करें
        </Text>
      </Pressable>
      <Text
        style={{
          fontFamily: typography.body.family,
          fontSize: 12,
          color: '#6B7280',
          textAlign: 'center',
          marginTop: spacing.sm,
        }}
      >
        भुगतान के बाद बुकिंग स्वचालित रूप से सक्रिय हो जाएगी।
      </Text>
    </View>
  );
}

export default function RateLockScreen(): React.ReactElement {
  const { isAuthenticated } = useCustomerSession();
  const [depositRupees, setDepositRupees] = useState('');
  const [fieldError, setFieldError]       = useState<string | null>(null);
  const [booking, setBooking]             = useState<RateLockBookingResult | null>(null);

  const { data: rates, isLoading: ratesLoading } = useQuery({
    queryKey: ['public-rates'],
    queryFn:  getPublicRates,
    staleTime: 30_000,
  });

  const { mutate: lockRate, isPending, isError, error } = useMutation({
    mutationFn: (depositAmountPaise: string) => createCustomerRateLockBooking(depositAmountPaise),
    onSuccess:  (result) => { setBooking(result); },
  });

  const apiError = isError
    ? (error as { response?: { data?: { code?: string } } })?.response?.data?.code === 'rate_lock.already_active'
      ? 'आपकी एक दर बुकिंग पहले से सक्रिय है।'
      : 'बुकिंग नहीं हो सकी। पुनः प्रयास करें।'
    : null;

  const live24kRupees = rates?.GOLD_24K?.perGramRupees
    ? Math.round(Number(rates.GOLD_24K.perGramRupees))
    : null;

  function handleLockRate(): void {
    setFieldError(null);
    const rupees = parseInt(depositRupees.trim(), 10);
    if (!depositRupees.trim() || !Number.isFinite(rupees) || rupees <= 0) {
      setFieldError('कृपया वैध जमा राशि दर्ज करें (₹ में)');
      return;
    }
    const paise = (BigInt(rupees) * 100n).toString();
    lockRate(paise);
  }

  if (!isAuthenticated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TenantBrandHeader />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
          <Text style={{ fontFamily: typography.body.family, fontSize: 16, color: colors.inkMute, textAlign: 'center' }}>
            दर-लॉक के लिए कृपया लॉग इन करें।
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TenantBrandHeader />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <Text
          style={{
            fontFamily: typography.display.family,
            fontSize: 22,
            color: colors.ink,
            marginBottom: spacing.md,
          }}
        >
          दर-लॉक बुकिंग
        </Text>
        <Text
          style={{
            fontFamily: typography.body.family,
            fontSize: 14,
            color: colors.inkMute,
            marginBottom: spacing.lg,
          }}
        >
          आज की सोने की दर बंद करें और टोकन राशि जमा करके बाद में उस दर पर खरीदारी करें।
        </Text>

        {/* Current rate card */}
        <View
          style={{
            backgroundColor: '#FEF3C7',
            borderRadius: radii.md,
            padding: spacing.md,
            marginBottom: spacing.lg,
            borderWidth: 1,
            borderColor: '#FCD34D',
          }}
        >
          {ratesLoading ? (
            <ActivityIndicator color="#92400E" />
          ) : live24kRupees !== null ? (
            <>
              <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: '#92400E' }}>
                24K सोने की आज की दर
              </Text>
              <Text
                style={{
                  fontFamily: typography.headingMid.family,
                  fontSize: 28,
                  color: '#78350F',
                  marginTop: spacing.xs,
                }}
                accessibilityLabel={`24K सोना ₹${live24kRupees.toLocaleString('en-IN')} प्रति ग्राम`}
              >
                ₹{live24kRupees.toLocaleString('en-IN')}/g
              </Text>
            </>
          ) : (
            <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: '#92400E' }}>
              दर उपलब्ध नहीं है।
            </Text>
          )}
        </View>

        {booking ? (
          <ConfirmationCard booking={booking} />
        ) : (
          <>
            {/* Deposit amount input */}
            <Text
              style={{
                fontFamily: typography.body.family,
                fontSize: 15,
                color: colors.ink,
                marginBottom: spacing.xs,
              }}
            >
              टोकन राशि (₹)
            </Text>
            <TextInput
              testID="deposit-input"
              value={depositRupees}
              onChangeText={(v) => { setDepositRupees(v); setFieldError(null); }}
              keyboardType="numeric"
              placeholder="जैसे: 500"
              placeholderTextColor={colors.inkMute}
              maxLength={8}
              style={{
                borderWidth: 1.5,
                borderColor: fieldError ? '#DC2626' : colors.border,
                borderRadius: radii.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                fontSize: 18,
                fontFamily: typography.body.family,
                color: colors.ink,
                backgroundColor: colors.white,
                minHeight: 52,
                marginBottom: spacing.sm,
              }}
              accessibilityLabel="टोकन राशि दर्ज करें"
            />
            {(fieldError ?? apiError) ? (
              <Text
                style={{ fontFamily: typography.body.family, fontSize: 13, color: '#DC2626', marginBottom: spacing.sm }}
                accessibilityRole="alert"
              >
                {fieldError ?? apiError}
              </Text>
            ) : null}

            <Pressable
              testID="lock-rate-button"
              onPress={handleLockRate}
              disabled={isPending || ratesLoading || live24kRupees === null}
              style={{
                backgroundColor: colors.ink,
                borderRadius: radii.sm,
                paddingVertical: spacing.md,
                alignItems: 'center',
                minHeight: 52,
                justifyContent: 'center',
                opacity: (isPending || ratesLoading || live24kRupees === null) ? 0.5 : 1,
              }}
              accessibilityLabel="दर-लॉक करें"
              accessibilityRole="button"
            >
              {isPending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text
                  style={{
                    fontFamily: typography.body.family,
                    fontSize: 17,
                    color: colors.white,
                    fontWeight: '700',
                  }}
                >
                  दर-लॉक करें
                </Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}
