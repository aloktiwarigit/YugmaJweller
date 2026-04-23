import React from 'react';
import { Stack } from 'expo-router';
import { t } from '@goldsmith/i18n';

export default function InventoryLayout(): React.ReactElement {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#F5EDDD' },
        headerTintColor: '#2C1810',
        headerTitleStyle: { fontFamily: 'NotoSansDevanagari', fontSize: 18 },
      }}
    >
      <Stack.Screen name="new" options={{ title: t('inventory.title_new') }} />
      <Stack.Screen name="[id]/edit" options={{ title: t('inventory.title_edit') }} />
    </Stack>
  );
}
