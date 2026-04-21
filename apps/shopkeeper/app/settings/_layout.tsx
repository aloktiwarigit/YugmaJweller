import React from 'react';
import { Stack } from 'expo-router';
import { colors } from '@goldsmith/ui-tokens';

export default function SettingsLayout(): React.ReactElement {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'सेटिंग्स' }} />
      <Stack.Screen name="staff" options={{ title: 'स्टाफ प्रबंधन' }} />
      <Stack.Screen name="billing" options={{ title: 'बिलिंग' }} />
      <Stack.Screen name="reports" options={{ title: 'रिपोर्ट्स' }} />
      <Stack.Screen name="making-charges" options={{ title: 'मेकिंग चार्जेस' }} />
      <Stack.Screen name="loyalty" options={{ title: 'लॉयल्टी प्रोग्राम' }} />
      <Stack.Screen name="shop-profile" options={{ title: 'शॉप प्रोफाइल' }} />
    </Stack>
  );
}
