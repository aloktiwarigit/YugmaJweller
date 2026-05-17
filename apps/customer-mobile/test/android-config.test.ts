import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ExpoConfig } from 'expo/config';

const appRoot = resolve(__dirname, '..');
const productionEnvKeys = [
  'APP_ENV',
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
    expect(pkg.dependencies['react-native']).toBe('0.74.0');
    expect(pkg.dependencies['react-native-safe-area-context']).toBe('4.10.0');
    expect(pkg.dependencies['react-native-screens']).toBe('3.31.0');
    expect(pkg.dependencies['react-native-svg']).toBe('~15.2.0');
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

  it('fails production config when Firebase service files are missing', async () => {
    stubProductionEnv({
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

  it('rejects localhost API base URL in production', async () => {
    stubProductionEnv({ EXPO_PUBLIC_API_BASE_URL: 'https://localhost:3001' });

    await expect(loadAppConfig()).rejects.toThrow(/must not point to localhost/);
  });

  it('accepts explicit production config with production service files', async () => {
    stubProductionEnv();

    const config = await loadAppConfig();

    expect(config.android?.package).toBe('com.goldsmith.customer');
    expect(config.android?.googleServicesFile).toBe('./google-services.json');
    expect(config.icon).toBe('./assets/app/icon.png');
    expect(config.splash?.image).toBe('./assets/app/splash-icon.png');
    expect(config.android?.adaptiveIcon?.foregroundImage).toBe('./assets/app/adaptive-icon-foreground.png');
    expect(config.ios?.bundleIdentifier).toBe('com.goldsmith.customer');
    expect(config.ios?.googleServicesFile).toBe('./GoogleService-Info.plist');
    expect(config.extra?.apiBaseUrl).toBe('https://api.goldsmith.example.com');
    expect(config.extra?.tenantSlug).toBe('anchor');
    expect(config.extra?.firebaseProjectId).toBe('goldsmith-prod');
    expect(config.extra?.eas?.projectId).toBe('11111111-1111-4111-8111-111111111111');
  });
});
