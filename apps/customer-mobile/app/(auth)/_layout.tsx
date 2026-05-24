import { Stack } from 'expo-router';

export default function AuthLayout(): JSX.Element {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="email-auth" options={{ title: 'ईमेल साइन इन', headerShown: true }} />
    </Stack>
  );
}
