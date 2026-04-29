import React from 'react';
import { Stack } from 'expo-router';

export default function CustomOrdersLayout(): React.ReactElement {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#F5EDDD' },
        headerTintColor: '#2C1810',
        headerTitleStyle: { fontFamily: 'NotoSansDevanagari', fontSize: 18 },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'कस्टम ऑर्डर' }} />
      <Stack.Screen name="new"   options={{ title: 'नया कस्टम ऑर्डर' }} />
      <Stack.Screen name="[id]"  options={{ title: 'ऑर्डर विवरण' }} />
    </Stack>
  );
}
