import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radii, spacing, typography } from '@goldsmith/ui-tokens';
import { useCustomerSession } from '../src/hooks/useCustomerSession';
import { useCustomerAuthBootstrap } from '../src/providers/CustomerAuthProvider';
import { useTenantStore } from '../src/stores/tenantStore';

export default function Index(): React.ReactElement {
  const { isAuthenticated } = useCustomerSession();
  const { ready } = useCustomerAuthBootstrap();
  const tenantError = useTenantStore((s) => s.error);
  const tenant = useTenantStore((s) => s.tenant);
  const setError = useTenantStore((s) => s.setError);
  const setLoading = useTenantStore((s) => s.setLoading);

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
  // dev-continue button and brand header, so we surface the error
  // explicitly rather than routing the user to a placeholder they cannot
  // act on. Real retry (re-fetching tenant boot in place) requires changes
  // to TenantProvider's effect dependency list and is tracked as a
  // follow-up; pressing the retry button below clears the error state so a
  // future TenantProvider revision can re-fetch on transition.
  if (tenantError !== null || tenant === null) {
    const onRetry = (): void => {
      setError(null);
      setLoading(true);
    };
    return (
      <View
        testID="tenant-boot-error"
        style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg }}
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
            marginBottom: spacing.lg,
          }}
        >
          कृपया ऐप को बंद करके पुनः खोलें। (Could not load shop. Please close and reopen the app.)
        </Text>
        <Pressable
          testID="tenant-boot-retry"
          onPress={onRetry}
          style={{
            backgroundColor: colors.white,
            borderRadius: radii.md,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            borderWidth: 1,
            borderColor: colors.border,
            minHeight: 48,
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: typography.body.family,
              fontSize: 16,
              color: colors.ink,
              textAlign: 'center',
            }}
          >
            पुनः प्रयास करें
          </Text>
        </Pressable>
      </View>
    );
  }

  return isAuthenticated ? <Redirect href="/(tabs)" /> : <Redirect href="/(auth)/welcome" />;
}
