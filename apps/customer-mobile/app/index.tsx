import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
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
  // No retry button: TenantProvider's effect runs once at mount and does
  // not depend on a refresh trigger, so an in-place retry would no-op.
  // Retry-on-demand is tracked as a follow-up; manual app re-launch is
  // the documented recovery for this state.
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
          कृपया ऐप को बंद करके पुनः खोलें। (Could not load shop. Please close and reopen the app.)
        </Text>
      </View>
    );
  }

  return isAuthenticated ? <Redirect href="/(tabs)" /> : <Redirect href="/(auth)/welcome" />;
}
