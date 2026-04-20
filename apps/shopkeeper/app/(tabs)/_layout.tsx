import React from 'react';
import { Tabs } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { t } from '@goldsmith/i18n';

export default function TabsLayout(): React.ReactElement {
  const role = useAuthStore((s) => s.user?.role);
  const isManagerOrOwner = role === 'shop_manager' || role === 'shop_admin';

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{ title: t('dashboard.tabs.dashboard') }}
      />
      <Tabs.Screen
        name="billing"
        options={{ title: t('dashboard.tabs.billing'), href: null }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: t('dashboard.tabs.reports'), href: isManagerOrOwner ? undefined : null }}
      />
    </Tabs>
  );
}
