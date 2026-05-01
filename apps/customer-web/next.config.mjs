/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@goldsmith/ui-tokens'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.blob.core.windows.net' },
      { protocol: 'https', hostname: 'ik.imagekit.io' },
    ],
  },
};

export default nextConfig;
