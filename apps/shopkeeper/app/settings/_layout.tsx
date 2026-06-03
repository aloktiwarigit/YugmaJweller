import React from 'react';
import { Stack } from 'expo-router';
import { t } from '@goldsmith/i18n';
import { colors } from '@goldsmith/ui-tokens';
import { useLocaleStore } from '../../src/stores/localeStore';

export default function SettingsLayout(): React.ReactElement {
  useLocaleStore((s) => s.locale);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: t('settings.title') }} />
      <Stack.Screen name="account" options={{ title: t('settings.menu.account') }} />
      <Stack.Screen name="staff" options={{ title: t('settings.menu.staff') }} />
      <Stack.Screen name="billing" options={{ title: t('settings.menu.billing') }} />
      <Stack.Screen name="reports" options={{ title: t('settings.menu.reports') }} />
      <Stack.Screen name="making-charges" options={{ title: t('settings.menu.making_charges') }} />
      <Stack.Screen name="wastage" options={{ title: t('settings.menu.wastage') }} />
      <Stack.Screen name="rate-lock" options={{ title: t('settings.menu.rate_lock') }} />
      <Stack.Screen name="try-at-home" options={{ title: t('settings.menu.try_at_home') }} />
      <Stack.Screen name="custom-order-policy" options={{ title: t('settings.menu.custom_order_policy') }} />
      <Stack.Screen name="return-policy" options={{ title: t('settings.menu.return_policy') }} />
      <Stack.Screen name="notification-prefs" options={{ title: t('settings.menu.notification_prefs') }} />
      <Stack.Screen name="loyalty" options={{ title: t('settings.menu.loyalty') }} />
      <Stack.Screen name="shop-profile" options={{ title: t('settings.menu.shop_profile') }} />
      <Stack.Screen name="audit-log" options={{ title: t('settings.menu.audit_log') }} />
      {__DEV__ && (
        <Stack.Screen name="theme" options={{ title: t('settings.menu.theme') }} />
      )}
    </Stack>
  );
}
