import React from 'react';
import { Stack } from 'expo-router';

export default function ReviewsLayout(): React.ReactElement {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#F5EDDD' },
        headerTintColor: '#2C1810',
        headerTitleStyle: { fontFamily: 'NotoSansDevanagari', fontSize: 18 },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'ग्राहक समीक्षाएँ' }} />
      <Stack.Screen name="[id]"  options={{ title: 'समीक्षा विवरण' }} />
    </Stack>
  );
}
