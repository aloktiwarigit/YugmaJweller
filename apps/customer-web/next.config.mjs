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
  },
};

export default nextConfig;
