// Build-time environment validation.
//
// Production-mode `next build` MUST fail loudly when:
//   - a required env var is missing
//   - a required URL contains `localhost`
//   - NEXT_PUBLIC_API_BASE or NEXT_PUBLIC_SITE_URL is not https://
//
// Warnings (non-blocking) are still printed but don't fail the build.
//
// Localhost values silently shipping to Cloud Run caused the `ECONNREFUSED`
// SSR outage where every page fetch failed but `next build` still exited 0.
//
// Developer escape hatch: set `SKIP_ENV_VALIDATION=1` for a *local* `next
// build`. The skip is logged at WARN and is REJECTED when CI=true so an
// accidental CI bypass is caught.

export interface EnvValidationResult {
  ok:       boolean;
  missing:  string[];
  errors:   string[];
  warnings: string[];
}

// Hard-required in production. Missing OR containing "localhost" blocks build.
const REQUIRED_PRODUCTION = [
  'API_URL',
  'NEXT_PUBLIC_SHOP_SLUG',
  'NEXT_PUBLIC_API_BASE',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
] as const;

// Keys that must be https:// in production (not http://, not localhost).
const REQUIRED_HTTPS_KEYS = ['API_URL', 'NEXT_PUBLIC_API_BASE', 'NEXT_PUBLIC_SITE_URL'] as const;

const LOCALHOST_SENTINEL = 'localhost';

export function validateEnv(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): EnvValidationResult {
  const missing:  string[] = [];
  const errors:   string[] = [];
  const warnings: string[] = [];

  const isDev = env['NODE_ENV'] === 'development' || env['NODE_ENV'] === undefined;
  if (isDev) return { ok: true, missing, errors, warnings };

  for (const key of REQUIRED_PRODUCTION) {
    const value = env[key];
    if (!value) {
      missing.push(key);
      continue;
    }
    if (value.includes(LOCALHOST_SENTINEL)) {
      errors.push(`${key} contains "localhost" — shipping a dev default to production`);
    }
  }

  for (const key of REQUIRED_HTTPS_KEYS) {
    const value = env[key];
    if (value && !value.includes(LOCALHOST_SENTINEL) && !value.startsWith('https://')) {
      errors.push(`${key} must be an https:// URL in production (got "${value}")`);
    }
  }

  const slug = env['NEXT_PUBLIC_SHOP_SLUG'] ?? '';
  if (slug && !/^[a-z0-9-]+$/.test(slug)) {
    errors.push('NEXT_PUBLIC_SHOP_SLUG must contain only lowercase letters, numbers, and hyphens');
  }

  return {
    ok: missing.length === 0 && errors.length === 0,
    missing,
    errors,
    warnings,
  };
}

/**
 * Throw if production env validation fails. Honours `SKIP_ENV_VALIDATION=1`
 * as a *local-only* escape hatch — when CI=true is also set, the skip itself
 * becomes an error so accidental CI bypass is caught.
 */
export function assertEnv(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): void {
  const skip = env['SKIP_ENV_VALIDATION'] === '1';
  if (skip) {
    if (env['CI'] === 'true' || env['CI'] === '1') {
      throw new Error(
        '[env] SKIP_ENV_VALIDATION=1 is forbidden in CI. ' +
        'It is a local-developer escape hatch only.',
      );
    }
    console.warn(
      '[env] WARNING: SKIP_ENV_VALIDATION=1 — production env checks are bypassed. ' +
      'NEVER set this in CI or in a deploy pipeline.',
    );
    return;
  }

  const { ok, missing, errors, warnings } = validateEnv(env);

  for (const w of warnings) console.warn(`[env] WARNING: ${w}`);

  if (!ok) {
    const lines = [
      ...missing.map((k) => `  - missing ${k}`),
      ...errors.map((e)  => `  - ${e}`),
    ].join('\n');
    throw new Error(
      `[env] Production environment validation failed:\n${lines}\n\n` +
      'Fix the values in your deployment env (Firebase App Hosting / Cloud Run) ' +
      'before building. Local builds may set SKIP_ENV_VALIDATION=1 (NOT for CI).',
    );
  }
}
