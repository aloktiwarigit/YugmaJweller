import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { colors } from '@goldsmith/ui-tokens';

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
  const role = useAuthStore((s) => s.user?.role);

  // If role is not yet loaded, fail open (show all tabs); route guards protect actual screens.
  const isStaff = role === 'shop_staff';

  return (
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
          title: 'होम',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <TabIcon name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="billing"
        options={{
          title: 'बिलिंग',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <TabIcon name="receipt-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'रिपोर्ट',
          // href: null removes the tab from the tab bar without removing the route
          href: isStaff ? null : undefined,
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <TabIcon name="bar-chart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'सेटिंग्स',
          href: isStaff ? null : undefined,
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <TabIcon name="settings-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
