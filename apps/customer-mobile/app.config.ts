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
  // Firebase plugins (@react-native-firebase/app + auth) and the
  // googleServicesFile entries are deferred to follow-up story EPIC7-S1
  // (Customer Phone OTP). This branch only ships the dev-mode mock auth
  // path, which has no Firebase dependency. Adding the plugins now would
  // require checking google-services.json / GoogleService-Info.plist into
  // the repo (or making EAS env vars mandatory), which a clean checkout
  // would fail without — and the artifacts aren't usable until OTP ships
  // anyway.
  plugins: [
    'expo-dev-client',
    'expo-font',
    'expo-router',
    'expo-secure-store',
    './plugins/with-pnpm-gradle-plugin-paths',
    // Sentry Expo plugin — wires native crash reporting + source-map upload.
    // @sentry/react-native ≥ 5.x uses this plugin directly (sentry-expo is deprecated for SDK 50+).
    // Source-map upload uses SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT at build time.
    [
      '@sentry/react-native/expo',
      {
        url: 'https://sentry.io',
        project: process.env['SENTRY_PROJECT'] ?? 'goldsmith-customer-mobile',
        organization: process.env['SENTRY_ORG'] ?? 'goldsmith',
      },
    ],
  ],
  // White-label: package / bundleIdentifier MUST differ per tenant build
  // — app stores and devices identify apps by these values, so two tenant
  // builds with the same identifier would conflict. Driven from build-time
  // env so a tenant-specific build pipeline can set them per artifact.
  // The dev fallback (`com.goldsmith.customer.dev`) is used only by the
  // anchor dev build invoked from a developer's machine.
  android: {
    package: process.env['EXPO_PUBLIC_ANDROID_PACKAGE'] ?? 'com.goldsmith.customer.dev',
  },
  ios: {
    bundleIdentifier: process.env['EXPO_PUBLIC_IOS_BUNDLE_ID'] ?? 'com.goldsmith.customer.dev',
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
