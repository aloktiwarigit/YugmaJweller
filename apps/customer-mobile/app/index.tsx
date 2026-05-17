import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, spacing, typography } from '@goldsmith/ui-tokens';
import { useCustomerSession } from '../src/hooks/useCustomerSession';
import { useCustomerAuthBootstrap } from '../src/providers/CustomerAuthProvider';
import { useTenantStore } from '../src/stores/tenantStore';

export default function Index(): React.ReactElement {
  const { isAuthenticated } = useCustomerSession();
  const { ready } = useCustomerAuthBootstrap();
  const tenantError = useTenantStore((s) => s.error);
  const tenant = useTenantStore((s) => s.tenant);
  const retryBoot = useTenantStore((s) => s.retryBoot);

  if (!ready) {
    return (
      <View
        testID="auth-bootstrap-loading"
        style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  // Tenant boot failed (invalid EXPO_PUBLIC_SHOP_SLUG, API outage, etc.).
  // The unauthenticated welcome screen depends on tenant for its
  // dev-continue button and brand header, so surface the error explicitly
  // instead of routing the user to a placeholder they cannot act on.
  if (tenantError !== null || tenant === null) {
    return (
      <View
        testID="tenant-boot-error"
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
        }}
      >
        <Text
          style={{
            fontFamily: typography.display.family,
            fontSize: 22,
            color: colors.ink,
            textAlign: 'center',
            marginBottom: spacing.sm,
          }}
        >
          दुकान लोड नहीं हो सकी
        </Text>
        <Text
          style={{
            fontFamily: typography.body.family,
            fontSize: 14,
            color: colors.inkMute,
            textAlign: 'center',
          }}
        >
          नेटवर्क या दुकान कॉन्फ़िगरेशन उपलब्ध नहीं है। कृपया कनेक्शन जांचकर फिर कोशिश करें।
        </Text>
        <Pressable
          testID="tenant-boot-retry"
          onPress={retryBoot}
          style={{
            marginTop: spacing.lg,
            minHeight: 48,
            paddingHorizontal: spacing.lg,
            justifyContent: 'center',
            borderRadius: 8,
            backgroundColor: colors.ink,
          }}
          accessibilityRole="button"
          accessibilityLabel="दुकान फिर से लोड करें"
        >
          <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: colors.white, fontWeight: '700' }}>
            फिर कोशिश करें
          </Text>
        </Pressable>
      </View>
    );
  }

  return isAuthenticated ? <Redirect href="/(tabs)" /> : <Redirect href="/(auth)/welcome" />;
}
