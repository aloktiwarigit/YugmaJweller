import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { router, type Href } from 'expo-router';
import axios from 'axios';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { auth } from '@goldsmith/auth-client';
import { t } from '@goldsmith/i18n';
import { Toast } from '@goldsmith/ui-mobile';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { useAuthStore } from '../../src/stores/authStore';
import { useTenantStore } from '../../src/stores/tenantStore';
import { postAuthSession } from '../../src/api/endpoints';
import { assertAuthTenantMatchesApp } from '../../src/providers/AuthProvider';
import { BrandMark } from '../../src/components/BrandMark';

const WEB_CLIENT_ID = '528920018833-b2ua9n337u2blajt89t7f5qo5nj0d2rh.apps.googleusercontent.com';
const fallbackDisplayName = 'अयोध्या स्वर्णकार';

type BackendErrorBody = { code?: string; errorCode?: string };

interface AuthCardProps {
  title: string;
  subtitle: string;
  primary?: boolean;
  loading?: boolean;
  onPress: () => void;
  testID?: string;
}

function AuthCard({ title, subtitle, primary = false, loading = false, onPress, testID }: AuthCardProps): React.ReactElement {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      disabled={loading}
      testID={testID}
      accessibilityRole="button"
      style={{
        minHeight: 64,
        borderRadius: radii.md,
        borderWidth: primary ? 0 : 1,
        borderColor: colors.border,
        backgroundColor: primary
          ? pressed ? colors.primaryDeep : colors.primary
          : pressed ? colors.primaryWash : colors.surface,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        marginBottom: spacing.sm,
        justifyContent: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: primary ? colors.primaryDeep : colors.ink,
        shadowOffset: { width: 0, height: primary ? 4 : 1 },
        shadowOpacity: primary ? 0.18 : 0.05,
        shadowRadius: primary ? 8 : 2,
        elevation: primary ? 4 : 1,
        opacity: loading ? 0.7 : 1,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: typography.headingMid.family,
            fontSize: 16,
            color: primary ? colors.bg : colors.ink,
            marginBottom: 2,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: typography.body.family,
            fontSize: 13,
            color: primary ? '#EFE3BE' : colors.inkMute,
          }}
        >
          {subtitle}
        </Text>
      </View>
      {loading && (
        <ActivityIndicator
          size="small"
          color={primary ? colors.bg : colors.primary}
          style={{ marginLeft: spacing.sm }}
        />
      )}
    </Pressable>
  );
}

function describeGoogleSignInError(error: unknown): string | null {
  const err = error as { code?: string; message?: string };
  if (err.code === statusCodes.SIGN_IN_CANCELLED || err.code === statusCodes.IN_PROGRESS) return null;
  if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return 'Google Play Services not available on this device';
  }

  if (axios.isAxiosError<BackendErrorBody>(error)) {
    const code = error.response?.data?.code ?? error.response?.data?.errorCode;
    if (code === 'auth.not_provisioned' || code === 'auth.rejected') {
      return t('auth.email.errors.user_not_found');
    }
    return t('auth.email.errors.generic');
  }

  if (err.message === 'Network Error' || err.message === 'auth.tenant_mismatch') {
    return t('auth.email.errors.generic');
  }

  return err.message ?? t('auth.email.errors.generic');
}

export default function LoginScreen(): React.ReactElement {
  const tenant = useTenantStore((s) => s.tenant);
  const displayName = tenant?.displayName ?? fallbackDisplayName;
  const setFirebaseUser = useAuthStore((s) => s.setFirebaseUser);
  const setIdToken = useAuthStore((s) => s.setIdToken);
  const setUser = useAuthStore((s) => s.setUser);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  }, []);

  const handleGoogleSignIn = async (): Promise<void> => {
    if (googleLoading) return;
    setErrorMsg(null);
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      await GoogleSignin.signIn();
      const { idToken } = await GoogleSignin.getTokens();
      const credential = auth.GoogleAuthProvider.credential(idToken);
      const result = await auth().signInWithCredential(credential);
      const firebaseIdToken = await result.user.getIdToken();
      const sess = await postAuthSession(firebaseIdToken);
      assertAuthTenantMatchesApp(sess);
      let activeToken = firebaseIdToken;
      if (sess.requires_token_refresh) {
        activeToken = await result.user.getIdToken(true);
      }
      setFirebaseUser({ uid: result.user.uid, phoneNumber: result.user.phoneNumber });
      setIdToken(activeToken);
      setUser(sess.user);
      router.replace('/(tabs)');
    } catch (e: unknown) {
      const signInErrorMessage = describeGoogleSignInError(e);
      if (signInErrorMessage !== null) {
        setErrorMsg(signInErrorMessage);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingHorizontal: spacing.lg,
      }}
    >
      {/* Top spacer */}
      <View style={{ flex: 1 }} />

      {/* Brand block */}
      <View style={{ alignItems: 'center', marginBottom: spacing.xxl }}>
        <BrandMark size={72} style={{ marginBottom: spacing.md }} />
        <Text
          style={{
            fontFamily: typography.display.family,
            fontSize: 26,
            color: colors.ink,
            textAlign: 'center',
            letterSpacing: 0.5,
          }}
        >
          {displayName}
        </Text>
        {/* Gold rule */}
        <View
          style={{
            width: 40,
            height: 2,
            backgroundColor: colors.primary,
            borderRadius: radii.pill,
            marginTop: spacing.sm,
          }}
        />
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
        {t('auth.login.title')}
      </Text>
      <Text
        style={{
          fontFamily: typography.serif.family,
          fontSize: 15,
          color: colors.inkMute,
          marginBottom: spacing.lg,
        }}
      >
        {t('auth.login.subtitle')}
      </Text>

      {/* Auth cards */}
      <AuthCard
        primary
        title={t('auth.login.phone_option')}
        subtitle="OTP via SMS"
        onPress={() => router.push('/(auth)/phone' as Href)}
        testID="login-phone"
      />
      <AuthCard
        title={t('auth.login.email_option')}
        subtitle="Sign in with email & password"
        onPress={() => router.push('/(auth)/email' as Href)}
        testID="login-email"
      />
      <AuthCard
        title={t('auth.login.google_option')}
        subtitle="Sign in with your Google account"
        loading={googleLoading}
        onPress={handleGoogleSignIn}
        testID="login-google"
      />

      {/* Error */}
      {errorMsg !== null && (
        <View style={{ marginTop: spacing.sm }}>
          <Toast message={errorMsg} variant="error" testID="login-error" />
        </View>
      )}

      {/* Bottom spacer */}
      <View style={{ flex: 1 }} />

      {/* Footer */}
      <Text
        style={{
          fontFamily: typography.latinItalic.family,
          fontStyle: 'italic',
          fontSize: 13,
          color: colors.inkMute,
          textAlign: 'center',
          marginBottom: spacing.xl,
        }}
      >
        {t('auth.meta.secure_login')}
      </Text>
    </View>
  );
}
