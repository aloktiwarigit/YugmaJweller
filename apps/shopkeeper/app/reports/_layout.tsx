import React from 'react';
import { Stack } from 'expo-router';

export default function ReportsLayout(): React.ReactElement {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#F5EDDD' },
        headerTintColor: '#2C1810',
        headerTitleStyle: { fontFamily: 'NotoSansDevanagari', fontSize: 18 },
      }}
    >
      <Stack.Screen name="gstr-export"       options={{ title: 'GST रिपोर्ट' }} />
      <Stack.Screen name="daily-summary"     options={{ title: 'दैनिक बिक्री' }} />
      <Stack.Screen name="outstanding"       options={{ title: 'बकाया भुगतान' }} />
      <Stack.Screen name="customer-ltv"      options={{ title: 'शीर्ष ग्राहक' }} />
      <Stack.Screen name="loyalty-summary"   options={{ title: 'लॉयल्टी कार्यक्रम' }} />
      <Stack.Screen name="stock-aging"       options={{ title: 'पुराना स्टॉक' }} />
    </Stack>
  );
}
