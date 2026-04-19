import type { ExpoConfig } from 'expo/config';

const appName = process.env['EXPO_PUBLIC_APP_NAME'] ?? 'अयोध्या स्वर्णकार';

const config: ExpoConfig = {
  name: appName,
  slug: 'goldsmith-shopkeeper',
  scheme: 'goldsmithshopkeeper',
  version: '0.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  platforms: ['ios', 'android'],
  plugins: [
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    'expo-dev-client',
    'expo-font',
    'expo-router',
  ],
  android: {
    package: 'com.goldsmith.shopkeeper.dev',
    googleServicesFile: './google-services.json',
  },
  ios: {
    bundleIdentifier: 'com.goldsmith.shopkeeper.dev',
    googleServicesFile: './GoogleService-Info.plist',
    supportsTablet: false,
  },
  extra: {
    apiBaseUrl: process.env['EXPO_PUBLIC_API_BASE_URL'] ?? 'http://10.0.2.2:3000',
    tenantSlug: process.env['EXPO_PUBLIC_TENANT_SLUG'] ?? 'anchor-dev',
    firebaseProjectId: process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID'] ?? 'goldsmith-dev',
    router: { origin: false },
    eas: { projectId: 'TBD-post-SOW' },
  },
  experiments: { typedRoutes: true },
};

export default config;
