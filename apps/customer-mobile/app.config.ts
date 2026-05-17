import type { ExpoConfig } from 'expo/config';
import { assertProductionBuildEnv } from './src/build-validation';

// White-label: appName MUST come from tenant runtime config when shipping a per-tenant build.
// EXPO_PUBLIC_APP_NAME is a build-time fallback for dev/anchor builds only.
const appName = process.env['EXPO_PUBLIC_APP_NAME'] ?? 'अयोध्या स्वर्णकार';

// Production build guard — fails fast if env vars are unsafe for a store build.
// Guards: HTTPS-only API URL, no .dev package/bundle IDs in non-dev builds.
// Only runs when EXPO_PUBLIC_DEV_AUTH is not set to '1'.
// See src/build-validation.ts for the rules and docs/runbook.md §17 for remediation.
if (process.env['EXPO_PUBLIC_DEV_AUTH'] !== '1') {
  assertProductionBuildEnv({
    apiBaseUrl: process.env['EXPO_PUBLIC_API_BASE_URL'],
    devAuth: process.env['EXPO_PUBLIC_DEV_AUTH'],
    androidPackage: process.env['EXPO_PUBLIC_ANDROID_PACKAGE'],
    iosBundleId: process.env['EXPO_PUBLIC_IOS_BUNDLE_ID'],
  });
}

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
