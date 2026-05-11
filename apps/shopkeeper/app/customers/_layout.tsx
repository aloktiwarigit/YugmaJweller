import { Stack } from 'expo-router';

export default function CustomersLayout(): JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerStyle:      { backgroundColor: '#F5EDDD' },
        headerTintColor:  '#5C3D11',
        headerTitleStyle: { fontFamily: 'NotoSansDevanagari', fontSize: 18 },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'ग्राहक' }} />
      <Stack.Screen name="new"   options={{ title: 'नया ग्राहक' }} />
      <Stack.Screen name="[id]"  options={{ title: 'ग्राहक विवरण' }} />
    </Stack>
  );
}
