import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePathname } from 'expo-router';
import { colors } from '@goldsmith/ui-tokens';
import { TenantProvider } from '../src/providers/TenantProvider';
import { CustomerAuthProvider } from '../src/providers/CustomerAuthProvider';
import { RootErrorBoundary } from '../src/components/RootErrorBoundary';
import { initSentry } from '../src/lib/sentry';
import { initPostHog, captureEvent } from '../src/lib/posthog';
import '../global.css';

// Initialise Sentry and PostHog before any other app code runs.
initSentry();
initPostHog();

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Fires page_view PostHog event on every route change. */
function PostHogRouteTracker(): null {
  const pathname = usePathname();
  useEffect(() => {
    captureEvent('page_view', { path: pathname });
  }, [pathname]);
  return null;
}

export default function RootLayout(): JSX.Element | null {
  const [fontsLoaded, fontError] = useFonts({
    YatraOne: require('../assets/fonts/YatraOne-Regular.ttf'),
    'MuktaVaani-400': require('../assets/fonts/MuktaVaani-400.ttf'),
    'MuktaVaani-500': require('../assets/fonts/MuktaVaani-500.ttf'),
    'MuktaVaani-600': require('../assets/fonts/MuktaVaani-600.ttf'),
    'MuktaVaani-700': require('../assets/fonts/MuktaVaani-700.ttf'),
    'TiroDevanagariHindi-Regular': require('../assets/fonts/TiroDevanagariHindi-Regular.ttf'),
    'TiroDevanagariHindi-Italic': require('../assets/fonts/TiroDevanagariHindi-Italic.ttf'),
    'Fraunces-Italic': require('../assets/fonts/Fraunces-VariableItalic.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <RootErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <TenantProvider>
            <CustomerAuthProvider>
              <PostHogRouteTracker />
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  contentStyle: { backgroundColor: colors.bg },
                  headerShown: false,
                }}
              />
            </CustomerAuthProvider>
          </TenantProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </RootErrorBoundary>
  );
}
