import React, { useState, useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { verifyOtp, sendOtp, getIdToken } from '@goldsmith/auth-client';
import { t } from '@goldsmith/i18n';
import { Button, Input, Toast } from '@goldsmith/ui-mobile';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { useOtpStore } from '../../src/stores/otpStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useTenantStore } from '../../src/stores/tenantStore';
import { postAuthSession } from '../../src/api/endpoints';

const RESEND_SECONDS = 60;

function maskPhone(e164: string): string {
  // +91XXXXXXXXXX → +91 XXXXX-XX3210 style: show last 4 digits
  const digits = e164.replace(/^\+91/, '');
  const visible = digits.slice(-4);
  const masked = 'XXXXX-XX' + visible;
  return '+91 ' + masked;
}

export default function OtpScreen(): React.ReactElement {
  const { confirmation, phoneE164, clear } = useOtpStore();
  const setUser = useAuthStore((s) => s.setUser);
  const tenant = useTenantStore((s) => s.tenant);

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigatedRef = useRef(false);

  // Defensive redirect if no confirmation in store
  useEffect(() => {
    if (!confirmation && !navigatedRef.current) {
      router.replace('/(auth)/phone');
    }
  }, [confirmation]);

  // Resend countdown
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return (): void => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const resetTimer = (): void => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSecondsLeft(RESEND_SECONDS);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const formatMMSS = (secs: number): string => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const onSubmit = async (): Promise<void> => {
    if (!confirmation || code.length < 6 || verifying) return;
    setErrorMsg(null);
    setVerifying(true);
    try {
      const { idToken } = await verifyOtp(confirmation, code);
      const sess = await postAuthSession(idToken);
      setUser(sess.user);
      // @spec §4.1(8) — pick up new custom claims synchronously before navigating
      if (sess.requires_token_refresh) {
        await getIdToken(true);
      }
      navigatedRef.current = true;
      clear();
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      const isLocked = msg.includes('429') || msg.includes('locked') || msg.includes('too-many-requests');
      if (isLocked) {
        setErrorMsg(t('auth.otp.errors.locked'));
      } else {
        setErrorMsg(t('auth.otp.errors.wrong'));
      }
    } finally {
      setVerifying(false);
    }
  };

  const onResend = async (): Promise<void> => {
    if (!phoneE164 || secondsLeft > 0) return;
    setErrorMsg(null);
    try {
      const newConfirmation = await sendOtp(phoneE164);
      useOtpStore.getState().setConfirmation(
        newConfirmation as Parameters<ReturnType<typeof useOtpStore.getState>['setConfirmation']>[0],
        phoneE164,
      );
      resetTimer();
    } catch {
      setErrorMsg(t('auth.phone.errors.send_failed'));
    }
  };

  const maskedPhone = phoneE164 ? maskPhone(phoneE164) : '';

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingHorizontal: spacing.lg,
        justifyContent: 'center',
      }}
    >
      {/* Brand row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            backgroundColor: colors.border,
            marginRight: spacing.sm,
          }}
        />
        <Text
          style={{
            fontFamily: typography.display.family,
            fontSize: 20,
            color: colors.ink,
          }}
        >
          {tenant?.displayName ?? ''}
        </Text>
      </View>

      {/* Heading */}
      <Text
        style={{
          fontFamily: typography.headingMid.family,
          fontSize: 20,
          color: colors.ink,
          marginBottom: spacing.xs,
        }}
      >
        {t('auth.otp.title')}
      </Text>

      {/* Serif subtitle */}
      <Text
        style={{
          fontFamily: typography.serif.family,
          fontSize: 16,
          color: colors.inkMute,
          marginBottom: spacing.lg,
        }}
      >
        {t('auth.otp.subtitle', { phone: maskedPhone })}
      </Text>

      {/* OTP input (single 6-digit — native paste-from-SMS works) */}
      <View style={{ marginBottom: spacing.md }}>
        <Input
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
          keyboardType="numeric"
          maxLength={6}
          testID="otp-input"
          accessibilityLabel={t('auth.otp.title')}
        />
      </View>

      {/* CTA */}
      <Button
        label={verifying ? t('common.loading') : t('auth.otp.cta')}
        variant="primary"
        onPress={onSubmit}
        disabled={code.length < 6 || verifying}
        testID="otp-cta"
      />

      {/* Resend */}
      <View style={{ marginTop: spacing.md, alignItems: 'center' }}>
        <Button
          label={
            secondsLeft > 0
              ? t('auth.otp.resend_in', { seconds: formatMMSS(secondsLeft) })
              : t('auth.otp.resend_now')
          }
          variant="secondary"
          onPress={onResend}
          disabled={secondsLeft > 0}
          testID="otp-resend"
        />
      </View>

      {/* Error toast */}
      {errorMsg !== null && (
        <View style={{ marginTop: spacing.md }}>
          <Toast message={errorMsg} variant="error" testID="otp-error-toast" />
        </View>
      )}
    </View>
  );
}
