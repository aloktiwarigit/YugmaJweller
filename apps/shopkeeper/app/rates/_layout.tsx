import React from 'react';
import { Stack } from 'expo-router';

export default function RatesLayout(): React.ReactElement {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#F5EDDD' },
        headerTintColor: '#2C1810',
        headerTitleStyle: { fontFamily: 'NotoSansDevanagari', fontSize: 18 },
      }}
    >
      <Stack.Screen name="override" options={{ title: 'दर ओवरराइड' }} />
      <Stack.Screen name="history" options={{ title: 'भाव इतिहास' }} />
    </Stack>
  );
}
