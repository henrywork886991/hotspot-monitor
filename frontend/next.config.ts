import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow SQLite native module
  serverExternalPackages: ['better-sqlite3'],

  // Allow external images (source logos, crypto icons)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cryptologos.cc' },
      { protocol: 'https', hostname: '**.coingecko.com' },
    ],
  },
};

export default nextConfig;
