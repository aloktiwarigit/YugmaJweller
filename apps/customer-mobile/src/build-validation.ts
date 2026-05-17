/**
 * Production build validation guards.
 *
 * These are pure functions so they can be unit-tested independently of
 * app.config.ts (which runs in the Expo config evaluation context and is
 * harder to test in isolation).
 *
 * Rules enforced:
 * 1. HTTPS guard — EXPO_PUBLIC_API_BASE_URL must start with https:// in
 *    production (when EXPO_PUBLIC_DEV_AUTH !== '1').
 * 2. No-dev-bundle guard — Android package and iOS bundle ID must NOT end
 *    with '.dev' in production.
 *
 * These guards are evaluated at build time (via app.config.ts) and are also
 * tested in the unit-test suite to catch regressions early.
 */

export interface BuildEnv {
  apiBaseUrl: string | undefined;
  devAuth: string | undefined;
  androidPackage: string | undefined;
  iosBundleId: string | undefined;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate that the build environment is safe for a production release.
 * Returns {valid: true, errors: []} when all guards pass.
 * Returns {valid: false, errors: [...]} listing every violation.
 */
export function validateProductionBuild(env: BuildEnv): ValidationResult {
  const errors: string[] = [];
  const isDevAuth = env.devAuth === '1';

  // Guard 1: HTTPS required in production
  if (!isDevAuth) {
    const url = env.apiBaseUrl ?? '';
    if (!url.startsWith('https://')) {
      errors.push(
        `EXPO_PUBLIC_API_BASE_URL must start with https:// in production builds. ` +
          `Got: "${url}". ` +
          `Set EXPO_PUBLIC_DEV_AUTH=1 only for local dev builds.`,
      );
    }
  }

  // Guard 2: No .dev bundle IDs in production
  if (!isDevAuth) {
    const pkg = env.androidPackage ?? '';
    if (pkg.endsWith('.dev')) {
      errors.push(
        `EXPO_PUBLIC_ANDROID_PACKAGE must not end with ".dev" in production builds. ` +
          `Got: "${pkg}". ` +
          `Set a tenant-specific package name (e.g., com.aanchaljewellers.customer).`,
      );
    }

    const bid = env.iosBundleId ?? '';
    if (bid.endsWith('.dev')) {
      errors.push(
        `EXPO_PUBLIC_IOS_BUNDLE_ID must not end with ".dev" in production builds. ` +
          `Got: "${bid}". ` +
          `Set a tenant-specific bundle identifier (e.g., com.aanchaljewellers.customer).`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Throw if the build environment has any production-guard violations.
 * Call this from app.config.ts when EXPO_PUBLIC_DEV_AUTH !== '1' and
 * the build targets a non-dev EAS profile.
 */
export function assertProductionBuildEnv(env: BuildEnv): void {
  const result = validateProductionBuild(env);
  if (!result.valid) {
    const message = [
      'Production build validation failed:',
      ...result.errors.map((e) => `  • ${e}`),
      '',
      'Fix these env vars before running `eas build --profile production`.',
      'See docs/runbook.md §17 and apps/customer-mobile/.env.production.example.',
    ].join('\n');
    throw new Error(message);
  }
}
