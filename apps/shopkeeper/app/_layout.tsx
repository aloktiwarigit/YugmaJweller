import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@goldsmith/ui-tokens';
import { AuthProvider } from '../src/providers/AuthProvider';
import { TenantProvider } from '../src/providers/TenantProvider';

export default function RootLayout(): JSX.Element {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <TenantProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              contentStyle: { backgroundColor: colors.bg },
              headerShown: false,
            }}
          />
        </TenantProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
