import { PHASE_PRODUCTION_BUILD } from 'next/constants.js';
import { withSentryConfig } from '@sentry/nextjs';
import { assertEnv, publicApiOrigin } from './lib/env.mjs';

// Source-map upload posture: SENTRY_AUTH_TOKEN enables source-map upload to
// Sentry at build time (so production stack traces show readable code, not
// minified). It is OPTIONAL — the Sentry RUNTIME SDK still captures errors
// without it (driven by NEXT_PUBLIC_SENTRY_DSN). When the token is absent
// during a production build, log a warning so it's visible in CI logs and
// continue; pre-paying-tenant environments are expected to run without
// source-map upload until the first deploy. Hardened on first paying tenant
// per Story 19.6 marker text.
if (
  process.env.NODE_ENV === 'production' &&
  process.env.NEXT_PHASE === 'phase-production-build' &&
  !process.env.SENTRY_AUTH_TOKEN
) {
  // eslint-disable-next-line no-console
  console.warn(
    '[Sentry] SENTRY_AUTH_TOKEN not set — source-map upload is disabled for this build.\n' +
      'Production stack traces in Sentry will show minified code until the token is configured.\n' +
      'Runtime error capture (via NEXT_PUBLIC_SENTRY_DSN) is unaffected.\n' +
      'To enable upload: set the SENTRY_AUTH_TOKEN secret in GitHub Actions or .env.local.',
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloud Run / Firebase App Hosting deploys: emit a self-contained server.js
  // plus only the node_modules actually used. ~80% smaller image than copying
  // the full workspace.
  output: 'standalone',

  // SSR via Firebase App Hosting (Blaze / Cloud Run). output: 'export' is not
  // set because the storefront uses request headers and ISR for live rates.
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
    formats: ['image/avif', 'image/webp'],
    // Cache optimizer output for 1 year. Default is 60s, which forces browsers
    // to revalidate every visit — compounds with no-CDN Cloud Run into slow
    // image loads. Demo assets in /demo-shop are immutable.
    minimumCacheTTL: 31536000,
  },

  poweredByHeader: false,
  compress: true,

  async headers() {
    // Widen connect-src with the configured API origin so /admin fetches
    // aren't CSP-blocked. publicApiOrigin() returns null for non-HTTPS in
    // production — never silently accept an insecure backend.
    const connectSrc = [
      "'self'",
      'https://*.googleapis.com',
      'https://*.firebaseio.com',
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
      'https://firestore.googleapis.com',
      'wss://*.firebaseio.com',
      // Sentry ingestion endpoint for browser-side error reporting (Story 19.1).
      'https://*.sentry.io',
    ];
    const apiOrigin = publicApiOrigin(process.env);
    if (apiOrigin) connectSrc.push(apiOrigin);

    // Allow http://localhost:* in dev so the storefront can hit the local API.
    if (process.env.NODE_ENV !== 'production') {
      connectSrc.push('http://localhost:*', 'http://127.0.0.1:*');
    }

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Link', value: '<https://ik.imagekit.io>; rel=preconnect; crossorigin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
          // HSTS: only send in production. Sending on localhost bricks the dev
          // browser for 2 years (Chrome enforces HSTS on localhost; no override).
          ...(process.env.NODE_ENV === 'production' ? [{
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          }] : []),
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''} https://www.gstatic.com https://apis.google.com`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https://*.blob.core.windows.net https://ik.imagekit.io",
              `connect-src ${connectSrc.join(' ')}`,
              "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      // In production, Next.js gives every static chunk a content-addressed
      // filename (hash in the name), so immutable caching is safe. In dev mode
      // chunk filenames don't have hashes; after a server restart the browser
      // would serve stale factories whose module IDs no longer match the fresh
      // RSC payload → "Cannot read properties of undefined (reading 'call')".
      ...(process.env.NODE_ENV === 'production' ? [{
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      }] : []),
      {
        // Static demo assets — JPEG/PNG/SVG/WEBP under /demo-shop. Cache for
        // 1 year. These are content-addressed (filename = content); rotate by
        // renaming the file.
        source: '/demo-shop/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

// Wrap with Sentry (Story 19.1) so source-map upload runs at build time.
const wrappedConfig = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  silent: true,
  tunnelRoute: undefined,
  disableLogger: false,
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware: true,
  autoInstrumentAppDirectory: true,
});

// Export a phase-aware config function: runs env assertion at PRODUCTION_BUILD,
// then returns the Sentry-wrapped Next config.
export default function config(phase) {
  if (phase === PHASE_PRODUCTION_BUILD && process.env.npm_lifecycle_event !== 'lint') {
    assertEnv(process.env);
  }
  return wrappedConfig;
}
