import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ExpoConfig } from 'expo/config';

const appRoot = resolve(__dirname, '..');
const productionEnvKeys = [
  'APP_ENV',
  'BUILD_TARGET_PLATFORM',
  'EAS_BUILD_PLATFORM',
  'EAS_BUILD',
  'EXPO_PUBLIC_ANDROID_PACKAGE',
  'EXPO_PUBLIC_IOS_BUNDLE_ID',
  'EXPO_PUBLIC_APP_NAME',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_EAS_PROJECT_ID',
  'EXPO_PUBLIC_API_BASE_URL',
  'EXPO_PUBLIC_SHOP_SLUG',
  'GOOGLE_SERVICES_JSON',
  'GOOGLE_SERVICES_PLIST',
  'EXPO_PUBLIC_DEV_AUTH',
] as const;
const originalProductionEnv = new Map(
  productionEnvKeys.map((key) => [key, process.env[key]]),
);

async function loadAppConfig() {
  vi.resetModules();
  const config = await vi.importActual<{ default: ExpoConfig }>('../app.config');
  return config.default;
}

function restoreProductionEnv() {
  for (const key of productionEnvKeys) {
    const original = originalProductionEnv.get(key);
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
}

function stubProductionEnv(overrides: Record<string, string | undefined> = {}) {
  const env = {
    APP_ENV: 'production',
    EXPO_PUBLIC_ANDROID_PACKAGE: 'com.goldsmith.customer',
    EXPO_PUBLIC_IOS_BUNDLE_ID: 'com.goldsmith.customer',
    EXPO_PUBLIC_APP_NAME: 'Ayodhya Swarnkar',
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'goldsmith-prod',
    EXPO_PUBLIC_EAS_PROJECT_ID: '11111111-1111-4111-8111-111111111111',
    EXPO_PUBLIC_API_BASE_URL: 'https://api.goldsmith.example.com',
    EXPO_PUBLIC_SHOP_SLUG: 'anchor',
    GOOGLE_SERVICES_JSON: './google-services.json',
    GOOGLE_SERVICES_PLIST: './GoogleService-Info.plist',
    EXPO_PUBLIC_DEV_AUTH: undefined,
    ...overrides,
  };

  restoreProductionEnv();
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  restoreProductionEnv();
  vi.resetModules();
});

describe('Android Expo SDK config', () => {
  it('pins native dependencies to Expo SDK 51 compatible versions', () => {
    const pkg = JSON.parse(readFileSync(resolve(appRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(pkg.scripts['android']).toBe('expo run:android');
    expect(pkg.dependencies['expo-image']).toBe('~1.12.15');
    expect(pkg.dependencies['expo-dev-client']).toBeUndefined();
    expect(pkg.dependencies['react-native']).toBe('0.74.0');
    expect(pkg.dependencies['react-native-safe-area-context']).toBe('4.10.0');
    expect(pkg.dependencies['react-native-screens']).toBe('3.31.0');
    expect(pkg.dependencies['react-native-svg']).toBe('~15.2.0');
    expect(pkg.devDependencies['expo-dev-client']).toBe('~4.0.0');
    expect(pkg.devDependencies['typescript']).toBe('^5.4.0');
  });

  it('keeps prebuild Gradle plugin resolution inside React Native pnpm scope', () => {
    const config = readFileSync(resolve(appRoot, 'app.config.ts'), 'utf8');
    const plugin = readFileSync(
      resolve(appRoot, 'plugins', 'with-pnpm-gradle-plugin-paths.js'),
      'utf8',
    );

    expect(config).toContain('./plugins/with-pnpm-gradle-plugin-paths');
    expect(plugin).toContain("require('expo/config-plugins')");
    expect(plugin).toContain("paths: [require.resolve('react-native/package.json')]");
  });

  it('keeps the EAS Android production profile Play-internal ready', () => {
    const eas = JSON.parse(readFileSync(resolve(appRoot, 'eas.json'), 'utf8')) as {
      build: Record<string, unknown>;
    };
    const production = eas.build.production as {
      autoIncrement?: boolean;
      environment?: string;
      android?: { buildType?: string };
      env?: Record<string, string>;
    };

    expect(production.environment).toBe('production');
    expect(production.autoIncrement).toBe(true);
    expect(production.android?.buildType).toBe('app-bundle');
    expect(production.env?.BUILD_TARGET_PLATFORM).toBe('android');
    expect(JSON.stringify(production)).not.toContain('REPLACE_WITH_');
  });

  it('keeps the native Android launcher manifest production-neutral', () => {
    const gradle = readFileSync(resolve(appRoot, 'android', 'app', 'build.gradle'), 'utf8');
    const manifest = readFileSync(
      resolve(appRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
      'utf8',
    );

    expect(gradle).toContain("namespace 'com.goldsmith.customer'");
    expect(gradle).not.toContain("namespace 'com.goldsmith.customer.dev'");
    expect(manifest).toContain('android:name=".MainActivity"');
    expect(manifest).not.toContain('exp+goldsmith-customer');
  });

  it('fails production config on EAS build workers when Firebase service files are missing', async () => {
    stubProductionEnv({
      EAS_BUILD: 'true',
      GOOGLE_SERVICES_JSON: undefined,
      GOOGLE_SERVICES_PLIST: undefined,
    });

    await expect(loadAppConfig()).rejects.toThrow(/GOOGLE_SERVICES_JSON/);
    await expect(loadAppConfig()).rejects.toThrow(/GOOGLE_SERVICES_PLIST/);
  });

  it('fails production config when Firebase service files point to dev placeholders', async () => {
    stubProductionEnv({
      GOOGLE_SERVICES_JSON: './google-services.json.dev',
      GOOGLE_SERVICES_PLIST: './GoogleService-Info.plist.dev',
    });

    await expect(loadAppConfig()).rejects.toThrow(/Production Firebase service files/);
    await expect(loadAppConfig()).rejects.toThrow(/GOOGLE_SERVICES_JSON/);
    await expect(loadAppConfig()).rejects.toThrow(/GOOGLE_SERVICES_PLIST/);
  });

  it('requires production API base URL to use HTTPS', async () => {
    stubProductionEnv({ EXPO_PUBLIC_API_BASE_URL: 'http://api.goldsmith.example.com' });

    await expect(loadAppConfig()).rejects.toThrow(/must use https:\/\//);
  });

  it('rejects production placeholder values', async () => {
    stubProductionEnv({ EXPO_PUBLIC_SHOP_SLUG: 'REPLACE_WITH_TENANT_SLUG' });

    await expect(loadAppConfig()).rejects.toThrow(/placeholder env vars/);
    await expect(loadAppConfig()).rejects.toThrow(/EXPO_PUBLIC_SHOP_SLUG/);
  });

  it('rejects malformed Android package names in production', async () => {
    stubProductionEnv({ EXPO_PUBLIC_ANDROID_PACKAGE: 'not_a_package' });

    await expect(loadAppConfig()).rejects.toThrow(/EXPO_PUBLIC_ANDROID_PACKAGE/);
    await expect(loadAppConfig()).rejects.toThrow(/reverse-DNS/);
  });

  it('rejects localhost API base URL in production', async () => {
    stubProductionEnv({ EXPO_PUBLIC_API_BASE_URL: 'https://localhost:3001' });

    await expect(loadAppConfig()).rejects.toThrow(/must not point to localhost/);
  });

  it('allows Android-only production config without an iOS Firebase plist', async () => {
    stubProductionEnv({
      BUILD_TARGET_PLATFORM: 'android',
      GOOGLE_SERVICES_PLIST: undefined,
    });

    const config = await loadAppConfig();

    expect(config.android?.package).toBe('com.goldsmith.customer');
    expect(config.android?.googleServicesFile).toBe('./google-services.json');
  });

  it('accepts explicit production config with production service files', async () => {
    stubProductionEnv();

    const config = await loadAppConfig();

    expect(config.android?.package).toBe('com.goldsmith.customer');
    expect(config.android?.googleServicesFile).toBe('./google-services.json');
    expect(config.icon).toBe('./assets/app/icon.png');
    expect(config.splash?.image).toBe('./assets/app/splash-icon.png');
    expect(config.android?.adaptiveIcon?.foregroundImage).toBe('./assets/app/adaptive-icon-foreground.png');
    expect(config.plugins).toContainEqual([
      'expo-build-properties',
      {
        android: {
          buildToolsVersion: '35.0.0',
          compileSdkVersion: 35,
          targetSdkVersion: 35,
        },
      },
    ]);
    expect(config.ios?.bundleIdentifier).toBe('com.goldsmith.customer');
    expect(config.ios?.googleServicesFile).toBe('./GoogleService-Info.plist');
    expect(config.extra?.apiBaseUrl).toBe('https://api.goldsmith.example.com');
    expect(config.extra?.tenantSlug).toBe('anchor');
    expect(config.extra?.firebaseProjectId).toBe('goldsmith-prod');
    expect(config.extra?.eas?.projectId).toBe('11111111-1111-4111-8111-111111111111');
    expect(config.plugins).not.toContain('expo-dev-client');
  });
});
