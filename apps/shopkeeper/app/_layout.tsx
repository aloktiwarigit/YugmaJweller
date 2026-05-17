import 'react-native-gesture-handler';
import { Stack, useNavigationContainerRef } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PostHogClient, { PostHogProvider, usePostHog } from 'posthog-react-native';
import { AuthProvider } from '../src/providers/AuthProvider';
import { TenantProvider } from '../src/providers/TenantProvider';
import { ThemeProvider } from '../src/providers/ThemeProvider';
import { OfflineProvider } from '../src/providers/OfflineProvider';

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const posthogClient = POSTHOG_API_KEY
  ? new PostHogClient(POSTHOG_API_KEY, { host: 'https://app.posthog.com' })
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
    NotoSansDevanagari: require('../assets/fonts/MuktaVaani-400.ttf'),
    'NotoSansDevanagari-Regular': require('../assets/fonts/MuktaVaani-400.ttf'),
    'NotoSansDevanagari-Bold': require('../assets/fonts/MuktaVaani-700.ttf'),
    'NotoSansDevanagari-SemiBold': require('../assets/fonts/MuktaVaani-600.ttf'),
    NotoSansDevanagari_400Regular: require('../assets/fonts/MuktaVaani-400.ttf'),
    NotoSansDevanagari_700Bold: require('../assets/fonts/MuktaVaani-700.ttf'),
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
              <OfflineProvider>
                <ScreenTracker />
                <StatusBar style="dark" />
                <Stack
                  screenOptions={{
                    headerShown: false,
                  }}
                />
              </OfflineProvider>
            </TenantProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );

  if (!posthogClient) return tree;

  return <PostHogProvider client={posthogClient}>{tree}</PostHogProvider>;
}
