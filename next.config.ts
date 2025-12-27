import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/api/**/*': ['./node_modules/.prisma/**/*', './node_modules/@prisma/client/**/*'],
  },
  turbopack: {},
};

export default nextConfig;
