import React, { useEffect, useState } from 'react';
import {
  Text, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import auth, { type FirebaseAuthTypes } from '@react-native-firebase/auth';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { TenantBrandHeader } from '../../src/components/TenantBrandHeader';
import { useCustomerSessionStore } from '../../src/stores/customerSessionStore';
import { useTenantStore } from '../../src/stores/tenantStore';
import { saveSecureSession } from '../../src/lib/secure-storage';
import { buildDevMockBearer, buildDevMockCustomer } from '../../src/lib/dev-mock-session';
import { signInWithGoogle } from '../../src/lib/google-sign-in';

type Step = 'select' | 'phone' | 'otp';

export default function Welcome(): React.ReactElement {
  const devAuth    = Boolean(Constants.expoConfig?.extra?.['devAuth']);
  const setSession = useCustomerSessionStore((s) => s.setSession);
  const customer   = useCustomerSessionStore((s) => s.customer);
  const tenant     = useTenantStore((s) => s.tenant);

  useEffect(() => {
    if (customer) router.replace('/(tabs)');
  }, [customer]);

  const [step,         setStep]         = useState<Step>('select');
  const [phoneInput,   setPhoneInput]   = useState('');
  const [otpInput,     setOtpInput]     = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);

  const onDevContinue = async (): Promise<void> => {
    if (!tenant) return;
    const bearer   = buildDevMockBearer();
    const customer = buildDevMockCustomer(tenant);
    await saveSecureSession({ bearer, customerId: customer.id, shopId: customer.shopId });
    setSession({ ...customer, email: null }, bearer);
    router.replace('/(tabs)');
  };

  const onGoogleSignIn = async (): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      if (!result.ok && result.error !== 'sign_in_cancelled') {
        setError('Google से साइन इन नहीं हो सका। पुनः प्रयास करें।');
      }
      // On success, onAuthStateChanged fires in CustomerAuthProvider
    } finally {
      setLoading(false);
    }
  };

  const onSendOtp = async (): Promise<void> => {
    setError(null);
    const trimmed = phoneInput.trim();
    const e164 = /^\+/.test(trimmed) ? trimmed : `+91${trimmed.replace(/\D/g, '')}`;
    if (!/^\+\d{8,15}$/.test(e164)) {
      setError('कृपया सही मोबाइल नंबर दर्ज करें (10 अंक)');
      return;
    }
    setLoading(true);
    try {
      const result = await auth().signInWithPhoneNumber(e164);
      setConfirmation(result);
      setStep('otp');
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code === 'auth/too-many-requests') setError('बहुत अधिक प्रयास। कृपया कुछ देर बाद प्रयास करें।');
      else if (code === 'auth/invalid-phone-number') setError('अमान्य फ़ोन नंबर। कृपया जाँचें।');
      else setError('OTP भेजने में त्रुटि। पुनः प्रयास करें।');
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOtp = async (): Promise<void> => {
    if (!confirmation) return;
    setError(null);
    const code = otpInput.trim();
    if (!/^\d{6}$/.test(code)) { setError('6 अंकों का OTP दर्ज करें'); return; }
    setLoading(true);
    try {
      await confirmation.confirm(code);
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code === 'auth/invalid-verification-code') setError('गलत OTP। कृपया पुनः जाँचें।');
      else if (code === 'auth/code-expired') {
        setError('OTP की समय-सीमा समाप्त। कृपया नया OTP मंगाएं।');
        setStep('phone');
        setConfirmation(null);
      } else setError('OTP सत्यापन में त्रुटि। पुनः प्रयास करें।');
    } finally {
      setLoading(false);
    }
  };

  const cardStyle = {
    backgroundColor:   colors.white,
    borderWidth:       1.5,
    borderColor:       colors.border,
    borderRadius:      radii.sm,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom:      spacing.sm,
    minHeight:         56,
    justifyContent:    'center' as const,
  };

  const cardLabelStyle = {
    fontFamily: typography.body.family,
    fontSize:   17,
    color:      colors.ink,
    fontWeight: '600' as const,
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TenantBrandHeader />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontFamily: typography.display.family, fontSize: 28, color: colors.ink, marginBottom: spacing.sm }}>
          स्वागत है
        </Text>

        {/* ── Auth method selector ───────────────────────────────────────────── */}
        {step === 'select' && (
          <>
            <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: colors.inkMute, marginBottom: spacing.xl }}>
              साइन इन करने का तरीका चुनें
            </Text>

            <Pressable
              testID="auth-select-phone"
              onPress={() => setStep('phone')}
              style={cardStyle}
              accessibilityRole="button"
              accessibilityLabel="मोबाइल नंबर से साइन इन"
            >
              <Text style={cardLabelStyle}>📱 मोबाइल नंबर</Text>
            </Pressable>

            <Pressable
              testID="auth-select-google"
              onPress={() => { void onGoogleSignIn(); }}
              disabled={loading}
              style={{ ...cardStyle, opacity: loading ? 0.6 : 1 }}
              accessibilityRole="button"
              accessibilityLabel="Google से साइन इन"
            >
              {loading
                ? <ActivityIndicator color={colors.ink} />
                : <Text style={cardLabelStyle}>G  Google से जारी रखें</Text>
              }
            </Pressable>

            <Pressable
              testID="auth-select-email"
              onPress={() => router.push('/(auth)/email-auth' as Parameters<typeof router.push>[0])}
              style={cardStyle}
              accessibilityRole="button"
              accessibilityLabel="ईमेल और पासवर्ड से साइन इन"
            >
              <Text style={cardLabelStyle}>✉  ईमेल और पासवर्ड</Text>
            </Pressable>

            {error ? (
              <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: '#DC2626', marginTop: spacing.sm, textAlign: 'center' }} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
          </>
        )}

        {/* ── Phone OTP flow ─────────────────────────────────────────────────── */}
        {step === 'phone' && (
          <>
            <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: colors.inkMute, marginBottom: spacing.xl }}>
              अपना मोबाइल नंबर दर्ज करें। हम एक OTP भेजेंगे।
            </Text>
            <TextInput
              testID="phone-input"
              value={phoneInput}
              onChangeText={(v) => { setPhoneInput(v); setError(null); }}
              keyboardType="phone-pad"
              placeholder="मोबाइल नंबर (10 अंक)"
              placeholderTextColor={colors.inkMute}
              maxLength={13}
              style={{
                borderWidth: 1.5,
                borderColor: error ? '#DC2626' : colors.border,
                borderRadius: radii.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                fontSize: 18,
                fontFamily: typography.body.family,
                color: colors.ink,
                backgroundColor: colors.white,
                minHeight: 52,
                marginBottom: error ? spacing.xs : spacing.lg,
              }}
              accessibilityLabel="मोबाइल नंबर"
            />
            {error ? (
              <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: '#DC2626', marginBottom: spacing.md }} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
            <Pressable
              testID="send-otp-button"
              onPress={() => { void onSendOtp(); }}
              disabled={loading}
              style={{ backgroundColor: colors.ink, borderRadius: radii.sm, paddingVertical: spacing.md, alignItems: 'center', minHeight: 52, justifyContent: 'center', opacity: loading ? 0.6 : 1 }}
              accessibilityLabel="OTP भेजें"
              accessibilityRole="button"
            >
              {loading ? <ActivityIndicator color={colors.white} /> : (
                <Text style={{ fontFamily: typography.body.family, fontSize: 17, color: colors.white, fontWeight: '700' }}>OTP भेजें</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => { setStep('select'); setError(null); setPhoneInput(''); }}
              style={{ marginTop: spacing.md, alignItems: 'center' }}
              accessibilityRole="button"
            >
              <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.accent }}>← वापस जाएं</Text>
            </Pressable>
          </>
        )}

        {/* ── OTP verification ────────────────────────────────────────────────── */}
        {step === 'otp' && (
          <>
            <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: colors.inkMute, marginBottom: spacing.md }}>
              {phoneInput} पर OTP भेजा गया।
            </Text>
            <TextInput
              testID="otp-input"
              value={otpInput}
              onChangeText={(v) => { setOtpInput(v); setError(null); }}
              keyboardType="number-pad"
              placeholder="6 अंकों का OTP"
              placeholderTextColor={colors.inkMute}
              maxLength={6}
              style={{
                borderWidth: 1.5,
                borderColor: error ? '#DC2626' : colors.border,
                borderRadius: radii.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                fontSize: 22,
                letterSpacing: 6,
                fontFamily: typography.body.family,
                color: colors.ink,
                backgroundColor: colors.white,
                minHeight: 52,
                textAlign: 'center',
                marginBottom: error ? spacing.xs : spacing.lg,
              }}
              accessibilityLabel="OTP"
            />
            {error ? (
              <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: '#DC2626', marginBottom: spacing.md }} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
            <Pressable
              testID="verify-otp-button"
              onPress={() => { void onVerifyOtp(); }}
              disabled={loading}
              style={{ backgroundColor: colors.ink, borderRadius: radii.sm, paddingVertical: spacing.md, alignItems: 'center', minHeight: 52, justifyContent: 'center', opacity: loading ? 0.6 : 1, marginBottom: spacing.md }}
              accessibilityLabel="OTP सत्यापित करें"
              accessibilityRole="button"
            >
              {loading ? <ActivityIndicator color={colors.white} /> : (
                <Text style={{ fontFamily: typography.body.family, fontSize: 17, color: colors.white, fontWeight: '700' }}>सत्यापित करें</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => { setStep('phone'); setConfirmation(null); setError(null); setOtpInput(''); }}
              accessibilityRole="button"
              accessibilityLabel="नंबर बदलें"
            >
              <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.accent, textAlign: 'center' }}>← नंबर बदलें</Text>
            </Pressable>
          </>
        )}

        {devAuth ? (
          <Pressable
            onPress={() => { void onDevContinue(); }}
            style={{ marginTop: spacing.xl, alignItems: 'center' }}
            testID="welcome-dev-continue"
            accessibilityRole="button"
          >
            <Text style={{ fontFamily: typography.body.family, fontSize: 13, color: colors.inkMute }}>
              [Dev] जारी रखें बिना OTP के
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
