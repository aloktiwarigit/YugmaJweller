import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '@goldsmith/i18n';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeTokens } from '../../src/hooks/useThemeTokens';
import { useLocaleStore } from '../../src/stores/localeStore';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  name,
  color,
  size,
}: {
  name: IoniconName;
  color: string;
  size: number;
}): React.ReactElement {
  return <Ionicons name={name} color={color} size={size} />;
}

export default function TabsLayout(): JSX.Element {
  const colors = useThemeTokens();
  const role = useAuthStore((s) => s.user?.role);
  useLocaleStore((s) => s.locale);

  const isStaff = role === 'shop_staff';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.inkMute,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('dashboard.tabs.home'),
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <TabIcon name="home-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="inventory"
          options={{
            title: t('dashboard.tabs.inventory'),
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <TabIcon name="cube-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="billing"
          options={{
            title: t('dashboard.tabs.billing'),
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <TabIcon name="receipt-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: t('dashboard.tabs.reports'),
            href: isStaff ? null : undefined,
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <TabIcon name="bar-chart-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: t('dashboard.tabs.more'),
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <TabIcon name="grid-outline" color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}
