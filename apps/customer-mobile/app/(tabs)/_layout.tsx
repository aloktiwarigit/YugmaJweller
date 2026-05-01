import { Tabs, Redirect } from 'expo-router';
import { colors } from '@goldsmith/ui-tokens';
import { useCustomerSession } from '../../src/hooks/useCustomerSession';

export default function TabsLayout(): JSX.Element {
  const { isAuthenticated } = useCustomerSession();
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
