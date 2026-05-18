import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Linking,
} from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { useCustomerSession } from '../../src/hooks/useCustomerSession';
import { getPublicRates, createCustomerRateLockBooking, getRateLockPaymentToken } from '../../src/api/endpoints';
import type { RateLockBookingResult } from '../../src/api/endpoints';
import { useTenantStore } from '../../src/stores/tenantStore';
import { captureEvent } from '../../src/lib/posthog';

function ConfirmationCard({
  booking,
  primaryColor,
}: {
  booking: RateLockBookingResult;
  primaryColor: string;
}): React.ReactElement {
  const lockedRate = Math.round(Number(booking.lockedRate24kPaisePerGram) / 100);
  const expiry = new Date(booking.expiresAt).toLocaleDateString('hi-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const [paymentPending, setPaymentPending] = useState(false);
  const [paymentError,   setPaymentError]   = useState<string | null>(null);

  const openPayment = async (): Promise<void> => {
    setPaymentError(null);
    setPaymentPending(true);
    try {
      // Fetch a short-lived signed token from the authenticated API endpoint.
      // The returned URL embeds the token so the browser page requires no auth headers.
      const { paymentUrl } = await getRateLockPaymentToken(booking.bookingId);
      await Linking.openURL(paymentUrl);
    } catch {
      setPaymentError('भुगतान पृष्ठ नहीं खुल सका। पुनः प्रयास करें।');
    } finally {
      setPaymentPending(false);
    }
  };

  return (
    <View
      style={{
        backgroundColor: colors.successWash,
        borderRadius: radii.md,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
      }}
    >
      <Text
        style={{
          fontFamily: typography.headingMid.family,
          fontSize: 18,
          color: colors.successJade,
          marginBottom: spacing.md,
        }}
      >
        बुकिंग बनाई गई
      </Text>
      <View style={{ marginBottom: spacing.sm }}>
        <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: colors.inkMute }}>
          बंद की गई 24K दर
        </Text>
        <Text style={{ fontFamily: typography.headingMid.family, fontSize: 22, color: colors.ink }}>
          ₹{lockedRate.toLocaleString('en-IN')}/g
        </Text>
      </View>
      <View style={{ marginBottom: spacing.md }}>
        <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: colors.inkMute }}>
          वैध तारीख तक
        </Text>
        <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: colors.ink }}>
          {expiry}
        </Text>
      </View>
      <Pressable
        onPress={() => { void openPayment(); }}
        disabled={paymentPending}
        style={{
          backgroundColor: primaryColor,
          borderRadius: radii.sm,
          paddingVertical: spacing.md,
          alignItems: 'center',
          minHeight: 52,
          justifyContent: 'center',
          opacity: paymentPending ? 0.6 : 1,
        }}
        accessibilityLabel="Razorpay पर भुगतान करें"
        accessibilityRole="button"
      >
        {paymentPending ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={{ fontFamily: typography.body.family, fontSize: 16, color: colors.white, fontWeight: '700' }}>
            Razorpay पर भुगतान करें
          </Text>
        )}
      </Pressable>
      {paymentError ? (
        <Text style={{ fontFamily: typography.body.family, fontSize: 12, color: colors.error, textAlign: 'center', marginTop: spacing.xs }} accessibilityRole="alert">
          {paymentError}
        </Text>
      ) : null}
      <Text
        style={{
          fontFamily: typography.body.family,
          fontSize: 12,
          color: colors.inkMute,
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
  const branding     = useTenantStore((s) => s.tenant?.branding);
  const primaryColor = branding?.primaryColor ?? colors.primary;

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
    onSuccess:  (result) => {
      captureEvent('booking_create', { bookingType: 'rate_lock', shopId: customer?.shopId });
      setBooking(result);
    },
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
          <ConfirmationCard booking={booking} primaryColor={primaryColor} />
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
