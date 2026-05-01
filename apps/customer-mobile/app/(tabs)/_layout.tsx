import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { colors } from '@goldsmith/ui-tokens';
import { useCustomerSession } from '../../src/hooks/useCustomerSession';
import { useCustomerAuthBootstrap } from '../../src/providers/CustomerAuthProvider';
import { useTenantStore } from '../../src/stores/tenantStore';

export default function TabsLayout(): React.ReactElement {
  const { isAuthenticated } = useCustomerSession();
  const { ready } = useCustomerAuthBootstrap();
  const tenantError = useTenantStore((s) => s.error);
  const tenant = useTenantStore((s) => s.tenant);

  // Wait for CustomerAuthProvider to finish rehydrating SecureStore before
  // deciding whether to redirect — otherwise a deep-link / cold-start onto a
  // tab route races the rehydrate effect and sends a user with a valid
  // session to /(auth)/welcome (where they would be stranded).
  if (!ready) {
    return (
      <View
        testID="tabs-bootstrap-loading"
        style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator />
      </View>
    );
  }
  // Tenant boot failed but the user deep-linked / cold-started onto a tab
  // route. Bounce through the root index so the tenant-boot-error UI gets a
  // chance to render — falling through to /(auth)/welcome would strand the
  // user on a screen whose dev-continue handler no-ops without a tenant.
  if (tenantError !== null || tenant === null) return <Redirect href="/" />;
  if (!isAuthenticated) return <Redirect href="/(auth)/welcome" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkMute,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 12 },
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'मुख्य' }} />
      <Tabs.Screen name="browse" options={{ title: 'उत्पाद' }} />
      <Tabs.Screen name="wishlist" options={{ title: 'पसंदीदा' }} />
      <Tabs.Screen name="profile" options={{ title: 'प्रोफ़ाइल' }} />
    </Tabs>
  );
}
