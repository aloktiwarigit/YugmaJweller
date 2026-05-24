import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@goldsmith/ui-tokens';
import { useCustomerSession } from '../../src/hooks/useCustomerSession';
import { useCustomerAuthBootstrap } from '../../src/providers/CustomerAuthProvider';
import { useTenantStore } from '../../src/stores/tenantStore';

export default function TabsLayout(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useCustomerSession();
  const { ready } = useCustomerAuthBootstrap();
  const tenantError = useTenantStore((s) => s.error);
  const tenant = useTenantStore((s) => s.tenant);
  const tabBarBottomPadding = Math.max(insets.bottom, 12);
  const tabBarContentHeight = 62;

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
          borderTopWidth: 1,
          height: tabBarContentHeight + tabBarBottomPadding,
          paddingTop: 8,
          paddingBottom: tabBarBottomPadding,
        },
        tabBarItemStyle: {
          height: tabBarContentHeight,
          paddingTop: 4,
          paddingBottom: 6,
        },
        tabBarIconStyle: { marginBottom: 1 },
        tabBarLabelStyle: {
          fontSize: 11,
          lineHeight: 15,
          fontWeight: '700',
          marginTop: 0,
          marginBottom: 0,
        },
        tabBarHideOnKeyboard: true,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'मुख्य',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: 'उत्पाद',
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: 'पसंदीदा',
          tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'प्रोफ़ाइल',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
