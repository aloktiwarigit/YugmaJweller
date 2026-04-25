import React from 'react';
import { Stack } from 'expo-router';

export default function BillingLayout(): React.ReactElement {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#F5EDDD' },
        headerTintColor: '#2C1810',
        headerTitleStyle: { fontFamily: 'NotoSansDevanagari', fontSize: 18 },
      }}
    >
      <Stack.Screen name="new" options={{ title: 'नया Invoice' }} />
      <Stack.Screen name="[id]" options={{ title: 'Invoice' }} />
      <Stack.Screen name="scan" options={{ title: 'बारकोड स्कैन' }} />
    </Stack>
  );
}
