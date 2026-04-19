import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { sendOtp } from '@goldsmith/auth-client';
import { t } from '@goldsmith/i18n';
import { Button, Input, Toast } from '@goldsmith/ui-mobile';
import { colors, typography, spacing } from '@goldsmith/ui-tokens';
import { useOtpStore } from '../../src/stores/otpStore';

const PHONE_RE = /^\d{10}$/;

export default function PhoneScreen(): React.ReactElement {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { setConfirmation } = useOtpStore();

  const isValid = PHONE_RE.test(phone);

  const onSubmit = async (): Promise<void> => {
    if (!isValid || loading) return;
    setErrorMsg(null);
    setLoading(true);
    try {
      // sendOtp normalises to E.164 internally but we also store E.164 for resend
      const confirmation = await sendOtp('+91' + phone);
      setConfirmation(
        confirmation as Parameters<typeof setConfirmation>[0],
        '+91' + phone,
      );
      router.push('/(auth)/otp');
    } catch {
      setErrorMsg(t('auth.phone.errors.send_failed'));
    } finally {
      setLoading(false);
    }
  };

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
          {t('common.app_name')}
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
        {t('auth.phone.title')}
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
        {t('auth.phone.subtitle')}
      </Text>

      {/* Input row: +91 prefix chip + 10-digit input */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
        <View
          style={{
            backgroundColor: colors.border,
            borderRadius: 8,
            paddingHorizontal: spacing.sm,
            height: 48,
            justifyContent: 'center',
            marginRight: spacing.xs,
          }}
        >
          <Text
            style={{
              fontFamily: typography.body.family,
              fontSize: 16,
              color: colors.ink,
            }}
          >
            {t('common.country_code')}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Input
            value={phone}
            onChangeText={(v) => {
              // allow only digits
              setPhone(v.replace(/\D/g, '').slice(0, 10));
            }}
            placeholder={t('auth.phone.placeholder')}
            keyboardType="phone-pad"
            maxLength={10}
            testID="phone-input"
            accessibilityLabel={t('auth.phone.title')}
          />
        </View>
      </View>

      {/* CTA */}
      <Button
        label={loading ? t('common.loading') : t('auth.phone.cta')}
        variant="primary"
        onPress={onSubmit}
        disabled={!isValid || loading}
        testID="phone-cta"
      />

      {/* Error toast */}
      {errorMsg !== null && (
        <View style={{ marginTop: spacing.md }}>
          <Toast message={errorMsg} variant="error" testID="phone-error-toast" />
        </View>
      )}

      {/* Footer meta — Fraunces italic */}
      <Text
        style={{
          fontFamily: typography.latinItalic.family,
          fontStyle: 'italic',
          fontSize: 13,
          color: colors.inkMute,
          textAlign: 'center',
          marginTop: spacing.xl,
        }}
      >
        {t('auth.meta.secure_login_firebase')}
      </Text>
    </View>
  );
}
