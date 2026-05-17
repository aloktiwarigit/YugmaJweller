/* eslint-env node, es2022 */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

// Plain ESM mirror of env.ts for next.config.mjs. Keep validation behavior in
// sync with env.ts; Vitest covers the TypeScript source.

export const REQUIRED_PRODUCTION = [
  'API_URL',
  'NEXT_PUBLIC_SHOP_SLUG',
  'NEXT_PUBLIC_API_BASE',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
];

export const REQUIRED_HTTPS_KEYS = ['API_URL', 'NEXT_PUBLIC_API_BASE', 'NEXT_PUBLIC_SITE_URL'];

const LOCALHOST_SENTINEL = 'localhost';

export function validateEnv(env = process.env) {
  const missing = [];
  const errors = [];
  const warnings = [];

  const isDev = env.NODE_ENV === 'development' || env.NODE_ENV === undefined;
  if (isDev) return { ok: true, missing, errors, warnings };

  for (const key of REQUIRED_PRODUCTION) {
    const value = env[key];
    if (!value) {
      missing.push(key);
      continue;
    }
    if (value.includes(LOCALHOST_SENTINEL)) {
      errors.push(`${key} contains "localhost" - shipping a dev default to production`);
    }
  }

  for (const key of REQUIRED_HTTPS_KEYS) {
    const value = env[key];
    if (value && !value.includes(LOCALHOST_SENTINEL) && !value.startsWith('https://')) {
      errors.push(`${key} must be an https:// URL in production (got "${value}")`);
    }
  }

  const slug = env.NEXT_PUBLIC_SHOP_SLUG ?? '';
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

export function assertEnv(env = process.env) {
  const skip = env.SKIP_ENV_VALIDATION === '1';
  if (skip) {
    if (env.CI === 'true' || env.CI === '1') {
      throw new Error(
        '[env] SKIP_ENV_VALIDATION=1 is forbidden in CI. ' +
          'It is a local-developer escape hatch only.',
      );
    }
    console.warn(
      '[env] WARNING: SKIP_ENV_VALIDATION=1 - production env checks are bypassed. ' +
        'NEVER set this in CI or in a deploy pipeline.',
    );
    return;
  }

  const { ok, missing, errors, warnings } = validateEnv(env);
  for (const warning of warnings) console.warn(`[env] WARNING: ${warning}`);
  if (!ok) {
    const lines = [
      ...missing.map((key) => `  - missing ${key}`),
      ...errors.map((error) => `  - ${error}`),
    ].join('\n');
    throw new Error(
      `[env] Production environment validation failed:\n${lines}\n\n` +
        'Fix the values in your deployment env before building. ' +
        'Local builds may set SKIP_ENV_VALIDATION=1 (NOT for CI).',
    );
  }
}

export function publicApiOrigin(env = process.env) {
  const raw = env.NEXT_PUBLIC_API_BASE ?? env.API_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (env.NODE_ENV === 'production' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}
