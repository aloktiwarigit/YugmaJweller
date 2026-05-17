// Warn about missing/unsafe production env vars at build time.
// Uses warn (not throw) so local `next build` still works without a full
// .env.production. Firebase App Hosting CI sets NEXT_PUBLIC_SITE_URL, which
// causes any localhost leaks to surface as visible console warnings in build logs.
// For strict CI gate, run `pnpm test` which calls lib/env.ts assertEnv().
if (process.env.NODE_ENV === 'production') {
  const REQUIRED = ['NEXT_PUBLIC_SHOP_SLUG', 'NEXT_PUBLIC_API_BASE', 'NEXT_PUBLIC_SITE_URL'];
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.warn(
      `[env] WARNING: Missing production env vars — set before deploying:\n` +
      missing.map((k) => `  - ${k}`).join('\n'),
    );
  }
  for (const k of REQUIRED) {
    if (process.env[k]?.includes('localhost')) {
      console.warn(`[env] WARNING: ${k} contains "localhost" — likely a dev default`);
    }
  }

  // Source-map upload requires SENTRY_AUTH_TOKEN.
  // Only enforce during actual `next build` (NEXT_PHASE=phase-production-build),
  // NOT during `next lint`, `next start`, or other phases that also set NODE_ENV=production.
  const isActualBuild = process.env.NEXT_PHASE === 'phase-production-build';
  if (isActualBuild && !process.env.SENTRY_AUTH_TOKEN) {
    throw new Error(
      '[Sentry] SENTRY_AUTH_TOKEN required for source-map upload in production build.\n' +
      'Set the SENTRY_AUTH_TOKEN secret in CI (GitHub Actions secret: SENTRY_AUTH_TOKEN).\n' +
      'For local dev builds, omit NODE_ENV=production or add SENTRY_AUTH_TOKEN to .env.local.',
    );
  }
}

import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // SSR via Firebase App Hosting (Blaze / Cloud Run).
  // output: 'export' is NOT set — this app needs per-request headers for
  // multi-tenant slug resolution and ISR for live gold rates.

  // Workspace packages export TS source (no compiled dist). Next must be told to transpile
  // them or production builds fail on TypeScript syntax. Add new workspace deps here.
  transpilePackages: [
    '@goldsmith/ui-tokens',
    '@goldsmith/auth-client',
    '@goldsmith/ui-web',
    '@goldsmith/customer-shared',
  ],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.blob.core.windows.net' },
      { protocol: 'https', hostname: 'ik.imagekit.io' },
    ],
    // Use AVIF for 30-50% smaller files; AVIF decode is fast on modern devices
    formats: ['image/avif', 'image/webp'],
  },

  poweredByHeader: false,
  compress: true,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Link', value: '<https://ik.imagekit.io>; rel=preconnect; crossorigin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https://*.blob.core.windows.net https://ik.imagekit.io",
              // sentry.io ingestion endpoint for client-side error reporting
              "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com wss://*.firebaseio.com https://*.sentry.io",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry webpack plugin options (source-map upload + tree-shake).
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for source-map upload. Required in production.
  // The build-time guard above ensures this is present before we reach here.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps to Sentry, then delete them from the build output
  // so they are NOT publicly served. Stack frames resolve via Sentry only.
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Silent in CI to avoid noisy output; set to false for local debugging.
  silent: true,

  // Disable the Sentry tunnel route (not needed; we connect directly to sentry.io).
  tunnelRoute: undefined,

  // Disable automatic tree-shaking of logger statements in production
  // (keep console.error visible in Cloud Run logs alongside Sentry).
  disableLogger: false,

  // Automatically inject Sentry's error handling into API routes.
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware: true,
  autoInstrumentAppDirectory: true,
});
