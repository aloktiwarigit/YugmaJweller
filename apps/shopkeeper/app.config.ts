import type { ExpoConfig } from 'expo/config';
import fs from 'node:fs';
import path from 'node:path';

const appName = process.env['EXPO_PUBLIC_APP_NAME'] ?? 'Ayodhya Swarnkar Manager';
const easBuildProfile = process.env['EAS_BUILD_PROFILE'];
const easBuildPlatform = process.env['EAS_BUILD_PLATFORM'];
const appEnv = process.env['APP_ENV'];
const buildTargetPlatform = process.env['BUILD_TARGET_PLATFORM'] ?? easBuildPlatform;
const isProductionProfile = appEnv === 'production' || easBuildProfile === 'production';
const iosGoogleServicesFile = './GoogleService-Info.plist';
const iosGoogleServicesPath = path.resolve(__dirname, iosGoogleServicesFile);
const hasIosGoogleServicesFile = fs.existsSync(iosGoogleServicesPath);
const androidGoogleServicesFile = process.env['GOOGLE_SERVICES_JSON'] ?? './android/app/google-services.json';
const androidGoogleServicesPath = path.resolve(__dirname, androidGoogleServicesFile);
const devFirebaseProjectId = 'goldsmith-dev';
const devApiBaseUrl = 'http://10.0.2.2:3000';
const devTenantSlug = 'anchor-dev';
const devAndroidPackage = 'com.goldsmith.shopkeeper.dev';
const devIosBundleIdentifier = 'com.goldsmith.shopkeeper.dev';
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
      android_client_info?: {
        package_name?: string;
      };
      mobilesdk_app_id?: string;
    };
    api_key?: Array<{
      current_key?: string;
    }>;
    oauth_client?: Array<{
      client_id?: string;
      client_type?: number;
    }>;
  }>;
};

function valueLooksLikePlaceholder(value: string): boolean {
  return value.includes('REPLACE_WITH_') || value.startsWith('SET-');
}

function targetPlatforms(): { android: boolean; ios: boolean } {
  const target = (buildTargetPlatform ?? '').toLowerCase();
  if (target === 'android') return { android: true, ios: false };
  if (target === 'ios') return { android: false, ios: true };
  return { android: true, ios: true };
}

function readAndroidFirebaseConfig(packageName: string): {
  apiKey?: string;
  appId?: string;
  projectId?: string;
  webClientId?: string;
} {
  if (!fs.existsSync(androidGoogleServicesPath)) return {};
  const raw = fs.readFileSync(androidGoogleServicesPath, 'utf8');
  const parsed = JSON.parse(raw) as AndroidGoogleServices;
  const clients = parsed.client ?? [];
  const configuredClient =
    clients.find(
      (client) => client.client_info?.android_client_info?.package_name === packageName,
    ) ?? clients[0];
  const webClient =
    configuredClient?.oauth_client?.find((client) => client.client_type === 3) ??
    clients
      .flatMap((client) => client.oauth_client ?? [])
      .find((client) => client.client_type === 3);
  return {
    apiKey: configuredClient?.api_key?.[0]?.current_key,
    appId: configuredClient?.client_info?.mobilesdk_app_id,
    projectId: parsed.project_info?.project_id,
    webClientId: webClient?.client_id,
  };
}

const androidPackage = process.env['EXPO_PUBLIC_ANDROID_PACKAGE'] ?? devAndroidPackage;
const iosBundleIdentifier =
  process.env['EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER'] ?? devIosBundleIdentifier;
const androidFirebaseConfig = readAndroidFirebaseConfig(androidPackage);
const firebaseProjectId =
  process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID'] ?? androidFirebaseConfig.projectId ?? devFirebaseProjectId;
const firebaseApiKey = process.env['EXPO_PUBLIC_FIREBASE_API_KEY'] ?? androidFirebaseConfig.apiKey;
const firebaseAppId = process.env['EXPO_PUBLIC_FIREBASE_APP_ID'] ?? androidFirebaseConfig.appId;
const googleWebClientId =
  process.env['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'] ?? androidFirebaseConfig.webClientId;
const firebaseAuthDomain =
  process.env['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'] ?? `${firebaseProjectId}.firebaseapp.com`;
const apiBaseUrl = process.env['EXPO_PUBLIC_API_BASE_URL'] ?? devApiBaseUrl;
const tenantSlug = process.env['EXPO_PUBLIC_TENANT_SLUG'] ?? devTenantSlug;
const usesCleartextTraffic = !isProductionProfile;

function requireProductionConfig(): void {
  if (!isProductionProfile) return;

  const failures: string[] = [];

  const requiredEnvVars: Record<string, string | undefined> = {
    EXPO_PUBLIC_APP_NAME: process.env['EXPO_PUBLIC_APP_NAME'],
    EXPO_PUBLIC_API_BASE_URL: process.env['EXPO_PUBLIC_API_BASE_URL'],
    EXPO_PUBLIC_TENANT_SLUG: process.env['EXPO_PUBLIC_TENANT_SLUG'],
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID'],
    EXPO_PUBLIC_ANDROID_PACKAGE: process.env['EXPO_PUBLIC_ANDROID_PACKAGE'],
  };

  for (const [name, value] of Object.entries(requiredEnvVars)) {
    if (!value) failures.push(`${name} is required`);
    if (value && valueLooksLikePlaceholder(value)) {
      failures.push(`${name} still contains a placeholder value`);
    }
  }

  if (
    apiBaseUrl === devApiBaseUrl ||
    apiBaseUrl.includes('localhost') ||
    apiBaseUrl.includes('10.0.2.2') ||
    !apiBaseUrl.startsWith('https://')
  ) {
    failures.push('EXPO_PUBLIC_API_BASE_URL must point at the HTTPS production API');
  }

  const targets = targetPlatforms();
  if (targets.android && !fs.existsSync(androidGoogleServicesPath)) {
    failures.push(`${androidGoogleServicesFile} is required for production Android builds`);
  }

  if (targets.android && fs.existsSync(androidGoogleServicesPath)) {
    if (!androidFirebaseConfig.projectId) {
      failures.push(`${androidGoogleServicesFile} must include a Firebase project id`);
    }
    if (androidFirebaseConfig.projectId !== firebaseProjectId) {
      failures.push(
        `${androidGoogleServicesFile} project id (${androidFirebaseConfig.projectId}) must match EXPO_PUBLIC_FIREBASE_PROJECT_ID (${firebaseProjectId})`,
      );
    }
    if (!androidFirebaseConfig.appId || !firebaseApiKey || !googleWebClientId) {
      failures.push(`${androidGoogleServicesFile} must include app id, API key, and Type-3 web OAuth client`);
    }
  }

  if (targets.ios && !hasIosGoogleServicesFile) {
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

  if (targets.ios && (iosBundleIdentifier === devIosBundleIdentifier || iosBundleIdentifier.endsWith('.dev'))) {
    failures.push('EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER must be a production iOS bundle identifier');
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
  version: process.env['EXPO_PUBLIC_APP_VERSION'] ?? (isProductionProfile ? '1.0.0' : '0.0.0'),
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
    ...(isProductionProfile ? [] : ['expo-dev-client' as const]),
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
    googleWebClientId,
    router: { origin: false },
  },
  web: {
    favicon,
  },
  experiments: { typedRoutes: true },
};

export default config;
