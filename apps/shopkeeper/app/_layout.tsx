import { Stack, useNavigationContainerRef } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { colors } from '@goldsmith/ui-tokens';
import PostHog, { PostHogProvider, usePostHog } from 'posthog-react-native';
import { AuthProvider } from '../src/providers/AuthProvider';
import { TenantProvider } from '../src/providers/TenantProvider';
import { ThemeProvider } from '../src/providers/ThemeProvider';

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const posthogClient = POSTHOG_API_KEY
  ? new PostHog(POSTHOG_API_KEY, { host: 'https://app.posthog.com' })
  : null;

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync().catch(() => {});

function ScreenTracker(): null {
  const posthog = usePostHog();
  const navRef = useNavigationContainerRef();
  const routeNameRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = navRef.addListener('state', () => {
      const current = navRef.getCurrentRoute();
      const routeName = current?.name;
      if (routeName && routeName !== routeNameRef.current) {
        routeNameRef.current = routeName;
        posthog?.screen(routeName);
      }
    });
    return unsubscribe;
  }, [navRef, posthog]);

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

  const tree = (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <TenantProvider>
              <ScreenTracker />
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  contentStyle: { backgroundColor: colors.bg },
                  headerShown: false,
                }}
              />
            </TenantProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );

  if (!posthogClient) return tree;

  return <PostHogProvider client={posthogClient}>{tree}</PostHogProvider>;
}
