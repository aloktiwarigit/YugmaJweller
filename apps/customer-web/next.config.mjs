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
}

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
              "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com wss://*.firebaseio.com",
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

export default nextConfig;
