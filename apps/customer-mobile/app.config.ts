import type { ExpoConfig } from 'expo/config';

// White-label: appName MUST come from tenant runtime config when shipping a per-tenant build.
// EXPO_PUBLIC_APP_NAME is a build-time fallback for dev/anchor builds only.
const appName = process.env['EXPO_PUBLIC_APP_NAME'] ?? 'अयोध्या स्वर्णकार';

const config: ExpoConfig = {
  name: appName,
  slug: 'goldsmith-customer',
  scheme: 'goldsmithcustomer',
  version: '0.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  // 'web' is included so `expo export --platform web` (the WS-E smoke
  // gate) bundles successfully. Native iOS/Android remain the primary
  // distribution targets.
  platforms: ['ios', 'android', 'web'],
  plugins: [
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    'expo-dev-client',
    'expo-font',
    'expo-router',
    'expo-secure-store',
  ],
  android: {
    package: 'com.goldsmith.customer.dev',
    googleServicesFile: process.env['GOOGLE_SERVICES_FILE'] ?? './google-services.json',
  },
  ios: {
    bundleIdentifier: 'com.goldsmith.customer.dev',
    googleServicesFile: process.env['GOOGLE_SERVICES_INFO_PLIST'] ?? './GoogleService-Info.plist',
    supportsTablet: false,
  },
  extra: {
    apiBaseUrl: process.env['EXPO_PUBLIC_API_BASE_URL'] ?? 'http://10.0.2.2:3000',
    tenantSlug: process.env['EXPO_PUBLIC_SHOP_SLUG'] ?? 'anchor-dev',
    devAuth: process.env['EXPO_PUBLIC_DEV_AUTH'] === '1',
    firebaseProjectId: process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID'] ?? 'goldsmith-dev',
    router: { origin: false },
    eas: { projectId: 'TBD-post-SOW' },
  },
  experiments: { typedRoutes: true },
};

export default config;
