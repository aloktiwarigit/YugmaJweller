// Build-time environment validation.
// Import this module in next.config.mjs or any server entry to fail the build
// loudly when required production variables are absent.

export interface EnvValidationResult {
  ok: boolean;
  missing: string[];
  warnings: string[];
}

// Variables that MUST be set in every production deployment.
const REQUIRED_PRODUCTION = [
  'NEXT_PUBLIC_SHOP_SLUG',
  'NEXT_PUBLIC_API_BASE',
  'NEXT_PUBLIC_SITE_URL',
] as const;

// Variables required only when the admin console (/admin) is deployed.
const REQUIRED_FOR_ADMIN = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
] as const;

const LOCALHOST_SENTINEL = 'localhost';

export function validateEnv(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  const isDev = env['NODE_ENV'] === 'development' || env['NODE_ENV'] === undefined;
  if (isDev) return { ok: true, missing, warnings };

  for (const key of REQUIRED_PRODUCTION) {
    const value = env[key];
    if (!value) {
      missing.push(key);
    } else if (value.includes(LOCALHOST_SENTINEL)) {
      warnings.push(`${key} contains "localhost" — likely a dev default shipped to production`);
    }
  }

  for (const key of REQUIRED_FOR_ADMIN) {
    const value = env[key];
    if (!value) {
      warnings.push(`${key} is not set — /admin login will fail`);
    }
  }

  const apiBase = env['NEXT_PUBLIC_API_BASE'] ?? '';
  if (apiBase && !apiBase.startsWith('https://') && env['NODE_ENV'] === 'production') {
    warnings.push('NEXT_PUBLIC_API_BASE is not https — admin API calls will be insecure');
  }

  const siteUrl = env['NEXT_PUBLIC_SITE_URL'] ?? '';
  if (siteUrl && !siteUrl.startsWith('https://') && env['NODE_ENV'] === 'production') {
    warnings.push('NEXT_PUBLIC_SITE_URL is not https — sitemap will use http URLs');
  }

  return { ok: missing.length === 0, missing, warnings };
}

// Call during build to fail loudly for missing required vars.
export function assertEnv(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): void {
  const { ok, missing, warnings } = validateEnv(env);

  for (const w of warnings) {
    console.warn(`[env] WARNING: ${w}`);
  }

  if (!ok) {
    const lines = missing.map((k) => `  - ${k}`).join('\n');
    throw new Error(
      `[env] Missing required production environment variables:\n${lines}\n\n` +
      'Copy .env.production.example to .env.production and fill in the values.',
    );
  }
}
