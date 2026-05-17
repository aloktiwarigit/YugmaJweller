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
      <Stack.Screen name="new" options={{ title: 'नया बिल' }} />
      <Stack.Screen name="[id]" options={{ title: 'बिल' }} />
      <Stack.Screen name="scan" options={{ title: 'बारकोड स्कैन' }} />
      <Stack.Screen name="urd-exchange" options={{ title: 'पुराना सोना खरीद' }} />
      <Stack.Screen name="estimate/index" options={{ title: 'अनुमान' }} />
      <Stack.Screen name="estimate/new" options={{ title: 'नया अनुमान' }} />
      <Stack.Screen name="estimate/[id]" options={{ title: 'अनुमान विवरण' }} />
    </Stack>
  );
}
