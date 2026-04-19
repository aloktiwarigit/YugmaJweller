import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
// TODO: AuthProvider + TenantProvider added in Task 18
// TODO: font loading via expo-font added in Task 17 font-asset delivery; stub for now
import { colors } from '@goldsmith/ui-tokens';

export default function RootLayout(): JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.bg },
          headerShown: false,
        }}
      />
    </SafeAreaProvider>
  );
}
