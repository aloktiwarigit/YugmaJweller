import 'react-native-gesture-handler';
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { router } from 'expo-router';
import { auth, getIdToken } from '@goldsmith/auth-client';
import { t } from '@goldsmith/i18n';
import { Button, Toast } from '@goldsmith/ui-mobile';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { useAuthStore } from '../../src/stores/authStore';
import { useTenantStore } from '../../src/stores/tenantStore';
import { postAuthSession } from '../../src/api/endpoints';
import { assertAuthTenantMatchesApp } from '../../src/providers/AuthProvider';
import { BrandMark } from '../../src/components/BrandMark';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fallbackDisplayName = 'अयोध्या स्वर्णकार';

function mapFirebaseError(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return t('auth.email.errors.invalid_email');
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return t('auth.email.errors.user_not_found');
    case 'auth/wrong-password':
      return t('auth.email.errors.wrong_password');
    case 'auth/email-already-in-use':
      return t('auth.email.errors.email_in_use');
    case 'auth/weak-password':
      return t('auth.email.errors.weak_password');
    case 'auth/too-many-requests':
      return t('auth.email.errors.too_many');
    default:
      return t('auth.email.errors.generic');
  }
}

export default function EmailScreen(): React.ReactElement {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const setUser = useAuthStore((s) => s.setUser);
  const tenant = useTenantStore((s) => s.tenant);
  const displayName = tenant?.displayName ?? fallbackDisplayName;

  const isValid = EMAIL_RE.test(email.trim()) && password.length >= 6;

  const onSubmit = async (): Promise<void> => {
    if (!isValid || loading) return;
    setErrorMsg(null);
    setLoading(true);
    try {
      const result =
        mode === 'signin'
          ? await auth().signInWithEmailAndPassword(email.trim(), password)
          : await auth().createUserWithEmailAndPassword(email.trim(), password);

      const idToken = await result.user.getIdToken();
      const sess = await postAuthSession(idToken);
      assertAuthTenantMatchesApp(sess);
      setUser(sess.user);
      if (sess.requires_token_refresh) {
        await getIdToken(true);
      }
      router.replace('/(tabs)');
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? '';
      setErrorMsg(mapFirebaseError(code));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    minHeight: 48,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.ink,
    backgroundColor: colors.bg,
    fontFamily: typography.body.family,
    fontSize: 18,
  } as const;

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
      <View
        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl }}
      >
        <BrandMark size={40} style={{ marginRight: spacing.sm }} />
        <Text
          style={{
            fontFamily: typography.display.family,
            fontSize: 20,
            color: colors.ink,
          }}
        >
          {displayName}
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
        {mode === 'signin' ? t('auth.email.title_signin') : t('auth.email.title_signup')}
      </Text>
      <Text
        style={{
          fontFamily: typography.serif.family,
          fontSize: 16,
          color: colors.inkMute,
          marginBottom: spacing.lg,
        }}
      >
        {t('auth.meta.secure_login')}
      </Text>

      {/* Email input */}
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder={t('auth.email.email_placeholder')}
        placeholderTextColor={colors.inkMute}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        style={{ ...inputStyle, marginBottom: spacing.sm }}
        testID="email-input"
        accessibilityLabel={t('auth.email.email_placeholder')}
      />

      {/* Password input with show/hide toggle */}
      <View style={{ position: 'relative', marginBottom: spacing.md }}>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.email.password_placeholder')}
          placeholderTextColor={colors.inkMute}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ ...inputStyle, paddingRight: spacing.xxl }}
          testID="password-input"
          accessibilityLabel={t('auth.email.password_placeholder')}
        />
        <Pressable
          onPress={() => setShowPassword((v) => !v)}
          style={{
            position: 'absolute',
            right: spacing.sm,
            top: 0,
            bottom: 0,
            justifyContent: 'center',
            paddingHorizontal: spacing.xs,
          }}
          accessibilityRole="button"
          testID="toggle-password"
        >
          <Text style={{ fontSize: 18, color: colors.inkMute }}>
            {showPassword ? '🙈' : '👁️'}
          </Text>
        </Pressable>
      </View>

      {/* CTA */}
      <Button
        label={
          loading
            ? t('common.loading')
            : mode === 'signin'
              ? t('auth.email.cta_signin')
              : t('auth.email.cta_signup')
        }
        variant="primary"
        onPress={onSubmit}
        disabled={!isValid || loading}
        testID="email-cta"
      />

      {/* Switch mode */}
      <Pressable
        onPress={() => {
          setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
          setErrorMsg(null);
        }}
        style={{ marginTop: spacing.md, alignItems: 'center' }}
        testID="toggle-mode"
      >
        <Text
          style={{
            fontFamily: typography.body.family,
            fontSize: 15,
            color: colors.primary,
          }}
        >
          {mode === 'signin'
            ? t('auth.email.switch_to_signup')
            : t('auth.email.switch_to_signin')}
        </Text>
      </Pressable>

      {/* Error toast */}
      {errorMsg !== null && (
        <View style={{ marginTop: spacing.md }}>
          <Toast message={errorMsg} variant="error" testID="email-error-toast" />
        </View>
      )}

    </View>
  );
}
