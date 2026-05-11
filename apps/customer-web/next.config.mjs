/** @type {import('next').NextConfig} */
const nextConfig = {
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
          // Preconnect to ImageKit CDN so first product image fetch skips DNS+TCP handshake
          { key: 'Link', value: '<https://ik.imagekit.io>; rel=preconnect; crossorigin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        ],
      },
      {
        // Immutable cache for hashed Next.js static assets (JS/CSS chunks)
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
