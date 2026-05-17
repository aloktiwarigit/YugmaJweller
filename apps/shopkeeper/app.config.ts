import type { ExpoConfig } from 'expo/config';
import fs from 'node:fs';
import path from 'node:path';

const appName = process.env['EXPO_PUBLIC_APP_NAME'] ?? 'Ayodhya Swarnkar';
const easBuildProfile = process.env['EAS_BUILD_PROFILE'];
const easBuildPlatform = process.env['EAS_BUILD_PLATFORM'];
const isProductionProfile = easBuildProfile === 'production';
const iosGoogleServicesFile = './GoogleService-Info.plist';
const iosGoogleServicesPath = path.resolve(__dirname, iosGoogleServicesFile);
const hasIosGoogleServicesFile = fs.existsSync(iosGoogleServicesPath);
const androidGoogleServicesFile = './google-services.json';
const androidGoogleServicesPath = path.resolve(__dirname, androidGoogleServicesFile);
const productionFirebaseProjectId = 'goldsmith-prod';
const devFirebaseProjectId = 'goldsmith-dev';
const devApiBaseUrl = 'http://10.0.2.2:3000';
const devTenantSlug = 'anchor-dev';
const devAndroidPackage = 'com.goldsmith.shopkeeper.dev';
const devIosBundleIdentifier = 'com.goldsmith.shopkeeper.dev';
const placeholderEasProjectId = 'TBD-post-SOW';
const appIcon = './assets/app/icon.png';
const splashIcon = './assets/app/splash-icon.png';
const splashBackgroundColor = '#F8EFE3';
const adaptiveIconForeground = './assets/app/adaptive-icon-foreground.png';
const adaptiveIconMonochrome = './assets/app/adaptive-icon-monochrome.png';
const adaptiveIconBackgroundColor = '#2C1810';
const favicon = './assets/app/favicon.png';
const devCleartextTrafficPlugin = './plugins/with-dev-cleartext-traffic';

type AndroidGoogleServices = {
  project_info?: {
    project_id?: string;
  };
  client?: Array<{
    client_info?: {
      mobilesdk_app_id?: string;
    };
    api_key?: Array<{
      current_key?: string;
    }>;
  }>;
};

function readAndroidFirebaseConfig(): {
  apiKey?: string;
  appId?: string;
  projectId?: string;
} {
  if (!fs.existsSync(androidGoogleServicesPath)) return {};
  const raw = fs.readFileSync(androidGoogleServicesPath, 'utf8');
  const parsed = JSON.parse(raw) as AndroidGoogleServices;
  const firstClient = parsed.client?.[0];
  return {
    apiKey: firstClient?.api_key?.[0]?.current_key,
    appId: firstClient?.client_info?.mobilesdk_app_id,
    projectId: parsed.project_info?.project_id,
  };
}

const androidFirebaseConfig = readAndroidFirebaseConfig();
const firebaseProjectId =
  process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID'] ?? androidFirebaseConfig.projectId ?? devFirebaseProjectId;
const firebaseApiKey = process.env['EXPO_PUBLIC_FIREBASE_API_KEY'] ?? androidFirebaseConfig.apiKey;
const firebaseAppId = process.env['EXPO_PUBLIC_FIREBASE_APP_ID'] ?? androidFirebaseConfig.appId;
const firebaseAuthDomain =
  process.env['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'] ?? `${firebaseProjectId}.firebaseapp.com`;
const apiBaseUrl = process.env['EXPO_PUBLIC_API_BASE_URL'] ?? devApiBaseUrl;
const tenantSlug = process.env['EXPO_PUBLIC_TENANT_SLUG'] ?? devTenantSlug;
const androidPackage = process.env['EXPO_PUBLIC_ANDROID_PACKAGE'] ?? devAndroidPackage;
const iosBundleIdentifier =
  process.env['EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER'] ?? devIosBundleIdentifier;
const easProjectId = process.env['EXPO_PUBLIC_EAS_PROJECT_ID'] ?? placeholderEasProjectId;
const usesCleartextTraffic = !isProductionProfile;

function requireProductionConfig(): void {
  if (!isProductionProfile) return;

  const failures: string[] = [];

  const requiredEnvVars: Record<string, string | undefined> = {
    EXPO_PUBLIC_API_BASE_URL: process.env['EXPO_PUBLIC_API_BASE_URL'],
    EXPO_PUBLIC_TENANT_SLUG: process.env['EXPO_PUBLIC_TENANT_SLUG'],
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID'],
    EXPO_PUBLIC_FIREBASE_API_KEY: firebaseApiKey,
    EXPO_PUBLIC_FIREBASE_APP_ID: firebaseAppId,
    EXPO_PUBLIC_ANDROID_PACKAGE: process.env['EXPO_PUBLIC_ANDROID_PACKAGE'],
    EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER: process.env['EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER'],
    EXPO_PUBLIC_EAS_PROJECT_ID: process.env['EXPO_PUBLIC_EAS_PROJECT_ID'],
  };

  for (const [name, value] of Object.entries(requiredEnvVars)) {
    if (!value) failures.push(`${name} is required`);
  }

  if (
    apiBaseUrl === devApiBaseUrl ||
    apiBaseUrl.includes('localhost') ||
    apiBaseUrl.includes('10.0.2.2') ||
    !apiBaseUrl.startsWith('https://')
  ) {
    failures.push('EXPO_PUBLIC_API_BASE_URL must point at the HTTPS production API');
  }

  if (tenantSlug === devTenantSlug || tenantSlug.endsWith('-dev')) {
    failures.push('EXPO_PUBLIC_TENANT_SLUG must be a production tenant slug');
  }

  if (firebaseProjectId === devFirebaseProjectId || firebaseProjectId.endsWith('-dev')) {
    failures.push('EXPO_PUBLIC_FIREBASE_PROJECT_ID must be a production Firebase project');
  }

  if (firebaseProjectId !== productionFirebaseProjectId) {
    failures.push(`EXPO_PUBLIC_FIREBASE_PROJECT_ID must be ${productionFirebaseProjectId}`);
  }

  if (easBuildPlatform === 'android' && !fs.existsSync(androidGoogleServicesPath)) {
    failures.push('google-services.json is required for production Android builds');
  }

  if (
    easBuildPlatform === 'android' &&
    fs.existsSync(androidGoogleServicesPath) &&
    androidFirebaseConfig.projectId !== productionFirebaseProjectId
  ) {
    failures.push(`google-services.json must target ${productionFirebaseProjectId}`);
  }

  if (easBuildPlatform === 'ios' && !hasIosGoogleServicesFile) {
    failures.push('GoogleService-Info.plist is required for production iOS builds');
  }

  if (
    easBuildPlatform === 'ios' &&
    hasIosGoogleServicesFile &&
    fs.readFileSync(iosGoogleServicesPath, 'utf8').includes(devFirebaseProjectId)
  ) {
    failures.push(`GoogleService-Info.plist must not target ${devFirebaseProjectId}`);
  }

  if (androidPackage === devAndroidPackage || androidPackage.endsWith('.dev')) {
    failures.push('EXPO_PUBLIC_ANDROID_PACKAGE must be a production Android package');
  }

  if (iosBundleIdentifier === devIosBundleIdentifier || iosBundleIdentifier.endsWith('.dev')) {
    failures.push('EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER must be a production iOS bundle identifier');
  }

  if (easProjectId === placeholderEasProjectId) {
    failures.push('EXPO_PUBLIC_EAS_PROJECT_ID must be the real EAS project ID');
  }

  if (failures.length > 0) {
    throw new Error(
      `Production shopkeeper builds require production configuration:\n- ${failures.join('\n- ')}`,
    );
  }
}

requireProductionConfig();

const config: ExpoConfig = {
  name: appName,
  slug: 'goldsmith-shopkeeper',
  scheme: 'goldsmithshopkeeper',
  version: '0.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  platforms: ['ios', 'android'],
  icon: appIcon,
  splash: {
    image: splashIcon,
    resizeMode: 'contain',
    backgroundColor: splashBackgroundColor,
  },
  plugins: [
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    '@react-native-google-signin/google-signin',
    'expo-dev-client',
    'expo-font',
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: splashIcon,
        imageWidth: 220,
        resizeMode: 'contain',
        backgroundColor: splashBackgroundColor,
      },
    ],
    './plugins/with-pnpm-gradle-plugin-paths',
    ...(usesCleartextTraffic ? [devCleartextTrafficPlugin] : []),
  ],
  android: {
    package: androidPackage,
    googleServicesFile: androidGoogleServicesFile,
    adaptiveIcon: {
      foregroundImage: adaptiveIconForeground,
      monochromeImage: adaptiveIconMonochrome,
      backgroundColor: adaptiveIconBackgroundColor,
    },
  },
  ios: {
    bundleIdentifier: iosBundleIdentifier,
    ...(hasIosGoogleServicesFile ? { googleServicesFile: iosGoogleServicesFile } : {}),
    supportsTablet: false,
  },
  extra: {
    apiBaseUrl,
    tenantSlug,
    firebaseProjectId,
    firebase: {
      apiKey: firebaseApiKey,
      authDomain: firebaseAuthDomain,
      projectId: firebaseProjectId,
      appId: firebaseAppId,
    },
    router: { origin: false },
    eas: { projectId: easProjectId },
  },
  web: {
    favicon,
  },
  experiments: { typedRoutes: true },
};

export default config;
