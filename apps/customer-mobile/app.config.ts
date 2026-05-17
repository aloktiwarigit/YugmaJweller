import type { ExpoConfig } from 'expo/config';

// White-label: appName MUST come from tenant runtime config when shipping a per-tenant build.
// EXPO_PUBLIC_APP_NAME is a build-time fallback for dev/anchor builds only.
const appName = process.env['EXPO_PUBLIC_APP_NAME'] ?? 'श्री राम ज्वैलर्स';

const isProduction = process.env['APP_ENV'] === 'production';
const devAuth      = process.env['EXPO_PUBLIC_DEV_AUTH'] === '1';

function serviceFilePointsToDevPlaceholder(path: string): boolean {
  const filename = path.replace(/\\/g, '/').split('/').pop() ?? path;
  return filename.endsWith('.dev') || filename.includes('.dev.');
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

if (isProduction) {
  // Hard-fail on missing critical production config so a misconfigured build
  // is caught at build time, not discovered after submission.
  const required: Array<[string, string | undefined]> = [
    ['EXPO_PUBLIC_ANDROID_PACKAGE',   process.env['EXPO_PUBLIC_ANDROID_PACKAGE']],
    ['EXPO_PUBLIC_IOS_BUNDLE_ID',     process.env['EXPO_PUBLIC_IOS_BUNDLE_ID']],
    ['EXPO_PUBLIC_APP_NAME',          process.env['EXPO_PUBLIC_APP_NAME']],
    ['EXPO_PUBLIC_FIREBASE_PROJECT_ID', process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID']],
    ['EXPO_PUBLIC_EAS_PROJECT_ID',    process.env['EXPO_PUBLIC_EAS_PROJECT_ID']],
    ['EXPO_PUBLIC_API_BASE_URL',      process.env['EXPO_PUBLIC_API_BASE_URL']],
    ['EXPO_PUBLIC_SHOP_SLUG',         process.env['EXPO_PUBLIC_SHOP_SLUG']],
    ['GOOGLE_SERVICES_JSON',          process.env['GOOGLE_SERVICES_JSON']],
    ['GOOGLE_SERVICES_PLIST',         process.env['GOOGLE_SERVICES_PLIST']],
  ];
  const missing = required.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(
      `[app.config.ts] Production build missing required env vars:\n  ${missing.join('\n  ')}\n` +
      'Set these in your EAS secret / CI environment before building.',
    );
  }
  if (devAuth) {
    throw new Error(
      '[app.config.ts] EXPO_PUBLIC_DEV_AUTH=1 must NOT be set in production builds.',
    );
  }
  const pkg = process.env['EXPO_PUBLIC_ANDROID_PACKAGE'] ?? '';
  const bid = process.env['EXPO_PUBLIC_IOS_BUNDLE_ID'] ?? '';
  if (pkg.endsWith('.dev') || bid.endsWith('.dev')) {
    throw new Error(
      '[app.config.ts] Production bundle identifiers must not end with .dev — update EXPO_PUBLIC_ANDROID_PACKAGE / EXPO_PUBLIC_IOS_BUNDLE_ID.',
    );
  }
  assertProductionApiBaseUrl(process.env['EXPO_PUBLIC_API_BASE_URL'] ?? '');

  const devServiceFiles = [
    ['GOOGLE_SERVICES_JSON', process.env['GOOGLE_SERVICES_JSON'] ?? ''],
    ['GOOGLE_SERVICES_PLIST', process.env['GOOGLE_SERVICES_PLIST'] ?? ''],
  ]
    .filter(([, value]) => serviceFilePointsToDevPlaceholder(value))
    .map(([key]) => key);
  if (devServiceFiles.length > 0) {
    throw new Error(
      `[app.config.ts] Production Firebase service files must not point to .dev placeholders:\n  ${devServiceFiles.join('\n  ')}`,
    );
  }
}

const easProjectId = process.env['EXPO_PUBLIC_EAS_PROJECT_ID'];
if (!easProjectId && !isProduction) {
  // Non-production: warn but don't fail (dev machines may not have EAS wired)
  // eslint-disable-next-line no-console
  console.warn('[app.config.ts] EXPO_PUBLIC_EAS_PROJECT_ID is not set. EAS builds will fail until configured.');
}

const config: ExpoConfig = {
  name: appName,
  slug: 'goldsmith-customer',
  scheme: 'goldsmithcustomer',
  // Bump to 1.0.0 for production; use EXPO_PUBLIC_APP_VERSION override in CI
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
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    // expo-dev-client is only needed for development/internal builds
    ...(isProduction ? [] : ['expo-dev-client' as const]),
    'expo-asset',
    'expo-font',
    'expo-router',
    'expo-secure-store',
    './plugins/with-pnpm-gradle-plugin-paths',
  ],
  // White-label: package / bundleIdentifier MUST differ per tenant build.
  android: {
    package: process.env['EXPO_PUBLIC_ANDROID_PACKAGE'] ?? 'com.goldsmith.customer.dev',
    googleServicesFile: process.env['GOOGLE_SERVICES_JSON'] ?? './google-services.json.dev',
    adaptiveIcon: {
      foregroundImage: './assets/app/adaptive-icon-foreground.png',
      backgroundImage: './assets/app/adaptive-icon-background.png',
      backgroundColor: '#F5EDDD',
    },
  },
  ios: {
    bundleIdentifier: process.env['EXPO_PUBLIC_IOS_BUNDLE_ID'] ?? 'com.goldsmith.customer.dev',
    supportsTablet: false,
    googleServicesFile: process.env['GOOGLE_SERVICES_PLIST'] ?? './GoogleService-Info.plist.dev',
  },
  extra: {
    apiBaseUrl:        process.env['EXPO_PUBLIC_API_BASE_URL'] ?? 'http://10.0.2.2:3001',
    tenantSlug:        process.env['EXPO_PUBLIC_SHOP_SLUG'] ?? 'anchor-dev',
    devAuth,
    firebaseProjectId: process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID'] ?? 'goldsmith-dev',
    router: { origin: false },
    eas: { projectId: easProjectId ?? 'SET-EXPO_PUBLIC_EAS_PROJECT_ID-IN-ENV' },
  },
  experiments: { typedRoutes: true },
};

export default config;
