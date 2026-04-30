import React from 'react';
import { Stack } from 'expo-router';

export default function TryAtHomeLayout(): React.ReactElement {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#F5EDDD' },
        headerTintColor: '#2C1810',
        headerTitleStyle: { fontFamily: 'NotoSansDevanagari', fontSize: 18 },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'घर पर आज़माएँ' }} />
      <Stack.Screen name="new"   options={{ title: 'नई बुकिंग' }} />
      <Stack.Screen name="[id]"  options={{ title: 'बुकिंग विवरण' }} />
    </Stack>
  );
}
