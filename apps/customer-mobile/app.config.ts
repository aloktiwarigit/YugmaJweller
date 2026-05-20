import type { ExpoConfig } from 'expo/config';
// NOTE: do NOT import from './src/build-validation' here. Expo's config loader
// transpiles app.config.ts but not its sibling .ts imports in clean checkouts
// (no compiled JS exists for them). The production guards below are inlined.

const appName = process.env['EXPO_PUBLIC_APP_NAME'] ?? 'श्री राम ज्वैलर्स';

const isProduction = process.env['APP_ENV'] === 'production';
const devAuth      = process.env['EXPO_PUBLIC_DEV_AUTH'] === '1';

// google-services.json lives at android/app/google-services.json (gitignored).
// For dev builds the file may be absent; the Gradle build.gradle only requires
// it when APP_ENV=production.
const androidGoogleServicesFile = process.env['GOOGLE_SERVICES_JSON'] ?? './google-services.json';
const iosGoogleServicesFile     = process.env['GOOGLE_SERVICES_PLIST'] ?? './GoogleService-Info.plist';

function serviceFilePointsToDevPlaceholder(path: string): boolean {
  const filename = path.replace(/\\/g, '/').split('/').pop() ?? path;
  return filename.endsWith('.dev') || filename.includes('.dev.');
}

function valueLooksLikePlaceholder(value: string): boolean {
  return value.includes('REPLACE_WITH_') || value.startsWith('SET-');
}

function assertNoPlaceholderValues(entries: Array<[string, string | undefined]>): void {
  const placeholders = entries
    .filter(([, value]) => value && valueLooksLikePlaceholder(value))
    .map(([key]) => key);

  if (placeholders.length > 0) {
    throw new Error(
      `[app.config.ts] Production build contains placeholder env vars:\n  ${placeholders.join('\n  ')}\n` +
      'Replace these values before building for the Play Store.',
    );
  }
}

function assertBundleIdentifier(value: string, key: string): void {
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/i.test(value)) {
    throw new Error(
      `[app.config.ts] ${key} must be a valid reverse-DNS identifier with at least three segments. Got: "${value}".`,
    );
  }
}

function assertProductionApiBaseUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      '[app.config.ts] EXPO_PUBLIC_API_BASE_URL must be a valid HTTPS URL in production builds.',
    );
  }

  const hostname = url.hostname.toLowerCase();
  const isLocalhost =
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '127.0.0.1' ||
    hostname === '::1';

  if (url.protocol !== 'https:') {
    throw new Error(
      '[app.config.ts] EXPO_PUBLIC_API_BASE_URL must use https:// in production builds.',
    );
  }
  if (isLocalhost) {
    throw new Error(
      '[app.config.ts] EXPO_PUBLIC_API_BASE_URL must not point to localhost in production builds.',
    );
  }
}

function productionServiceFileTargets(): { android: boolean; ios: boolean } {
  const target = (
    process.env['BUILD_TARGET_PLATFORM'] ??
    process.env['EAS_BUILD_PLATFORM'] ??
    ''
  ).toLowerCase();

  if (target === 'android') return { android: true, ios: false };
  if (target === 'ios') return { android: false, ios: true };
  return { android: true, ios: true };
}

function assertProductionFirebaseServiceFiles(): void {
  const targets = productionServiceFileTargets();
  const errors: string[] = [];

  if (targets.android) {
    if (!process.env['GOOGLE_SERVICES_JSON']) {
      errors.push('GOOGLE_SERVICES_JSON is required for production Android builds.');
    } else if (serviceFilePointsToDevPlaceholder(process.env['GOOGLE_SERVICES_JSON'])) {
      errors.push('GOOGLE_SERVICES_JSON must point to a production Firebase file, not a .dev placeholder.');
    }
  }

  if (targets.ios) {
    if (!process.env['GOOGLE_SERVICES_PLIST']) {
      errors.push('GOOGLE_SERVICES_PLIST is required for production iOS builds.');
    } else if (serviceFilePointsToDevPlaceholder(process.env['GOOGLE_SERVICES_PLIST'])) {
      errors.push('GOOGLE_SERVICES_PLIST must point to a production Firebase file, not a .dev placeholder.');
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `[app.config.ts] Production Firebase service files are invalid:\n  ${errors.join('\n  ')}`,
    );
  }
}

if (isProduction) {
  // Hard-fail on missing critical production config so a misconfigured build
  // is caught at build time, not discovered after submission.
  const required: Array<[string, string | undefined]> = [
    ['EXPO_PUBLIC_APP_NAME',            process.env['EXPO_PUBLIC_APP_NAME']],
    ['EXPO_PUBLIC_FIREBASE_PROJECT_ID', process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID']],
    ['EXPO_PUBLIC_API_BASE_URL',        process.env['EXPO_PUBLIC_API_BASE_URL']],
    ['EXPO_PUBLIC_SHOP_SLUG',           process.env['EXPO_PUBLIC_SHOP_SLUG']],
    ['EXPO_PUBLIC_ANDROID_PACKAGE',     process.env['EXPO_PUBLIC_ANDROID_PACKAGE']],
    ['EXPO_PUBLIC_EAS_PROJECT_ID',      process.env['EXPO_PUBLIC_EAS_PROJECT_ID']],
  ];

  const missing = required.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(
      `[app.config.ts] Production build missing required env vars:\n  ${missing.join('\n  ')}\n` +
      'Set these before running the Gradle release build.',
    );
  }
  assertNoPlaceholderValues(required);

  if (devAuth) {
    throw new Error('[app.config.ts] EXPO_PUBLIC_DEV_AUTH=1 must NOT be set in production builds.');
  }

  const pkg = process.env['EXPO_PUBLIC_ANDROID_PACKAGE'] ?? '';
  if (pkg.endsWith('.dev')) {
    throw new Error(
      '[app.config.ts] Production package must not end with .dev — update EXPO_PUBLIC_ANDROID_PACKAGE.',
    );
  }
  assertBundleIdentifier(pkg, 'EXPO_PUBLIC_ANDROID_PACKAGE');
  assertProductionApiBaseUrl(process.env['EXPO_PUBLIC_API_BASE_URL'] ?? '');
  assertProductionFirebaseServiceFiles();
}

const config: ExpoConfig = {
  name: appName,
  slug: 'goldsmith-customer',
  scheme: 'goldsmithcustomer',
  version: process.env['EXPO_PUBLIC_APP_VERSION'] ?? (isProduction ? '1.0.0' : '0.0.0'),
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  platforms: ['ios', 'android', 'web'],
  icon: './assets/app/icon.png',
  splash: {
    image: './assets/app/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#F5EDDD',
  },
  plugins: [
    [
      'expo-build-properties',
      {
        android: {
          buildToolsVersion: '35.0.0',
          compileSdkVersion: 35,
          targetSdkVersion: 35,
        },
      },
    ],
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    ...(isProduction ? [] : ['expo-dev-client' as const]),
    'expo-asset',
    'expo-font',
    'expo-router',
    'expo-secure-store',
    './plugins/with-pnpm-gradle-plugin-paths',
    // NOTE: @sentry/react-native/expo plugin is NOT used here. The installed
    // SDK 5.14 does not export an Expo config plugin entry. The Sentry runtime
    // SDK still works without the plugin (initSentry() in src/lib/sentry.ts).
  ],
  android: {
    package: process.env['EXPO_PUBLIC_ANDROID_PACKAGE'] ?? 'com.goldsmith.customer.dev',
    googleServicesFile: androidGoogleServicesFile,
    adaptiveIcon: {
      foregroundImage: './assets/app/adaptive-icon-foreground.png',
      backgroundImage: './assets/app/adaptive-icon-background.png',
      backgroundColor: '#F5EDDD',
    },
  },
  ios: {
    bundleIdentifier: process.env['EXPO_PUBLIC_IOS_BUNDLE_ID'] ?? 'com.goldsmith.customer.dev',
    googleServicesFile: iosGoogleServicesFile,
    supportsTablet: false,
  },
  extra: {
    apiBaseUrl:        process.env['EXPO_PUBLIC_API_BASE_URL'] ?? 'http://10.0.2.2:3001',
    tenantSlug:        process.env['EXPO_PUBLIC_SHOP_SLUG'] ?? 'anchor-dev',
    devAuth,
    firebaseProjectId: process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID'] ?? 'goldsmith-dev',
    eas: { projectId: process.env['EXPO_PUBLIC_EAS_PROJECT_ID'] },
    router: { origin: false },
  },
  experiments: { typedRoutes: true },
};

export default config;
