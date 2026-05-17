import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const appRoot = resolve(__dirname, '..');
const managedEnvKeys = [
  'EAS_BUILD_PROFILE',
  'EAS_BUILD_PLATFORM',
  'EXPO_PUBLIC_API_BASE_URL',
  'EXPO_PUBLIC_TENANT_SLUG',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
  'EXPO_PUBLIC_ANDROID_PACKAGE',
  'EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER',
  'EXPO_PUBLIC_EAS_PROJECT_ID',
] as const;
let originalEnv: Record<string, string | undefined>;

async function loadAppConfig() {
  vi.resetModules();
  const config = await import('../app.config');
  return config.default;
}

function readPngMeta(relativePath: string): {
  colorType: number;
  height: number;
  sizeBytes: number;
  width: number;
} {
  const buffer = readFileSync(resolve(appRoot, relativePath));
  const signature = buffer.subarray(0, 8).toString('hex');
  const chunkType = buffer.subarray(12, 16).toString('ascii');

  expect(signature).toBe('89504e470d0a1a0a');
  expect(chunkType).toBe('IHDR');

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer.readUInt8(25),
    sizeBytes: buffer.byteLength,
  };
}

beforeEach(() => {
  originalEnv = {};
  for (const key of managedEnvKeys) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const key of managedEnvKeys) {
    const original = originalEnv[key];
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
  vi.resetModules();
});

describe('Android Expo SDK config', () => {
  it('aligns direct navigation dependencies with Expo Router 3', () => {
    const pkg = JSON.parse(readFileSync(resolve(appRoot, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };

    expect(pkg.dependencies['@react-navigation/native']).toBe('^6.1.18');
    expect(pkg.dependencies['@react-navigation/native-stack']).toBe('^6.9.26');
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

  it('configures production-ready launcher, splash, and Play Store graphic assets', async () => {
    const config = await loadAppConfig();
    const splashPlugin = config.plugins?.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
    ) as [string, Record<string, unknown>] | undefined;

    expect(config.icon).toBe('./assets/app/icon.png');
    expect(config.splash).toEqual({
      image: './assets/app/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#F8EFE3',
    });
    expect(config.web?.favicon).toBe('./assets/app/favicon.png');
    expect(config.android?.adaptiveIcon).toEqual({
      foregroundImage: './assets/app/adaptive-icon-foreground.png',
      monochromeImage: './assets/app/adaptive-icon-monochrome.png',
      backgroundColor: '#2C1810',
    });
    expect(splashPlugin?.[1]).toMatchObject({
      image: './assets/app/splash-icon.png',
      imageWidth: 220,
      resizeMode: 'contain',
      backgroundColor: '#F8EFE3',
    });

    expect(readPngMeta('assets/app/icon.png')).toMatchObject({
      width: 1024,
      height: 1024,
      colorType: 6,
    });
    expect(readPngMeta('assets/app/adaptive-icon-foreground.png')).toMatchObject({
      width: 1024,
      height: 1024,
      colorType: 6,
    });
    expect(readPngMeta('assets/app/adaptive-icon-monochrome.png')).toMatchObject({
      width: 1024,
      height: 1024,
      colorType: 6,
    });
    expect(readPngMeta('assets/app/splash-icon.png')).toMatchObject({
      width: 1024,
      height: 1024,
      colorType: 6,
    });
    expect(readPngMeta('assets/app/favicon.png')).toMatchObject({
      width: 48,
      height: 48,
      colorType: 6,
    });

    const playIcon = readPngMeta('assets/play-store/app-icon-512.png');
    expect(playIcon).toMatchObject({ width: 512, height: 512, colorType: 6 });
    expect(playIcon.sizeBytes).toBeLessThanOrEqual(1024 * 1024);
    expect(readPngMeta('assets/play-store/feature-graphic-1024x500.png')).toMatchObject({
      width: 1024,
      height: 500,
      colorType: 2,
    });
  });

  it('preserves local development defaults outside the production EAS profile', async () => {
    vi.stubEnv('EAS_BUILD_PROFILE', 'development');

    const config = await loadAppConfig();

    expect(config.android?.package).toBe('com.goldsmith.shopkeeper.dev');
    expect(config.plugins).toContain('./plugins/with-dev-cleartext-traffic');
    expect(config.ios?.bundleIdentifier).toBe('com.goldsmith.shopkeeper.dev');
    expect(config.extra?.apiBaseUrl).toBe('http://10.0.2.2:3000');
    expect(config.extra?.tenantSlug).toBe('anchor-dev');
    expect(config.extra?.firebaseProjectId).toBe('goldsmith-dev');
    expect(config.extra?.eas?.projectId).toBe('TBD-post-SOW');
  });

  it('fails production EAS config when required production values are missing', async () => {
    vi.stubEnv('EAS_BUILD_PROFILE', 'production');

    await expect(loadAppConfig()).rejects.toThrow(
      /Production shopkeeper builds require production configuration/,
    );
    await expect(loadAppConfig()).rejects.toThrow(/EXPO_PUBLIC_API_BASE_URL is required/);
    await expect(loadAppConfig()).rejects.toThrow(/EXPO_PUBLIC_FIREBASE_PROJECT_ID is required/);
    await expect(loadAppConfig()).rejects.toThrow(/EXPO_PUBLIC_EAS_PROJECT_ID is required/);
  });

  it('accepts explicit production EAS config', async () => {
    vi.stubEnv('EAS_BUILD_PROFILE', 'production');
    vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.goldsmith.example.com');
    vi.stubEnv('EXPO_PUBLIC_TENANT_SLUG', 'anchor');
    vi.stubEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'goldsmith-prod');
    vi.stubEnv('EXPO_PUBLIC_FIREBASE_API_KEY', 'production-api-key');
    vi.stubEnv('EXPO_PUBLIC_FIREBASE_APP_ID', '1:1234567890:android:abcdef');
    vi.stubEnv('EXPO_PUBLIC_ANDROID_PACKAGE', 'com.goldsmith.shopkeeper');
    vi.stubEnv('EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER', 'com.goldsmith.shopkeeper');
    vi.stubEnv('EXPO_PUBLIC_EAS_PROJECT_ID', '11111111-1111-4111-8111-111111111111');

    const config = await loadAppConfig();

    expect(config.android?.package).toBe('com.goldsmith.shopkeeper');
    expect(config.plugins).not.toContain('./plugins/with-dev-cleartext-traffic');
    expect(config.ios?.bundleIdentifier).toBe('com.goldsmith.shopkeeper');
    expect(config.extra?.apiBaseUrl).toBe('https://api.goldsmith.example.com');
    expect(config.extra?.tenantSlug).toBe('anchor');
    expect(config.extra?.firebaseProjectId).toBe('goldsmith-prod');
    expect(config.extra?.eas?.projectId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('rejects non-HTTPS production API URLs', async () => {
    vi.stubEnv('EAS_BUILD_PROFILE', 'production');
    vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'http://api.goldsmith.example.com');
    vi.stubEnv('EXPO_PUBLIC_TENANT_SLUG', 'anchor');
    vi.stubEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'goldsmith-prod');
    vi.stubEnv('EXPO_PUBLIC_FIREBASE_API_KEY', 'production-api-key');
    vi.stubEnv('EXPO_PUBLIC_FIREBASE_APP_ID', '1:1234567890:android:abcdef');
    vi.stubEnv('EXPO_PUBLIC_ANDROID_PACKAGE', 'com.goldsmith.shopkeeper');
    vi.stubEnv('EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER', 'com.goldsmith.shopkeeper');
    vi.stubEnv('EXPO_PUBLIC_EAS_PROJECT_ID', '11111111-1111-4111-8111-111111111111');

    await expect(loadAppConfig()).rejects.toThrow(/HTTPS production API/);
  });

  it('rejects production Android builds when google-services.json targets dev Firebase', async () => {
    vi.stubEnv('EAS_BUILD_PROFILE', 'production');
    vi.stubEnv('EAS_BUILD_PLATFORM', 'android');
    vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.goldsmith.example.com');
    vi.stubEnv('EXPO_PUBLIC_TENANT_SLUG', 'anchor');
    vi.stubEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'goldsmith-prod');
    vi.stubEnv('EXPO_PUBLIC_FIREBASE_API_KEY', 'production-api-key');
    vi.stubEnv('EXPO_PUBLIC_FIREBASE_APP_ID', '1:1234567890:android:abcdef');
    vi.stubEnv('EXPO_PUBLIC_ANDROID_PACKAGE', 'com.goldsmith.shopkeeper');
    vi.stubEnv('EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER', 'com.goldsmith.shopkeeper');
    vi.stubEnv('EXPO_PUBLIC_EAS_PROJECT_ID', '11111111-1111-4111-8111-111111111111');

    // Accept either failure mode — both block a bad prod Android build:
    //   1. "must target goldsmith-prod" — file present but pointed at dev project
    //      (local dev checkout where google-services.json is a dev placeholder)
    //   2. "is required for production Android builds" — file absent from working
    //      tree (CI checkout — google-services.json is gitignored, never committed)
    // The semantic invariant ("production Android builds must use a goldsmith-prod
    // google-services.json") is enforced by both error paths in app.config.ts.
    await expect(loadAppConfig()).rejects.toThrow(
      /google-services\.json (must target goldsmith-prod|is required for production Android builds)/,
    );
  });
});
