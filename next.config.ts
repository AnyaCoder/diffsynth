import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  serverExternalPackages: ['macstats', 'osx-temperature-sensor'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('osx-temperature-sensor', 'macstats');
    }
    return config;
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '100gb',
    },
    middlewareClientMaxBodySize: '100gb',
  },
};

export default withNextIntl(nextConfig);
