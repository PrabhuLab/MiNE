import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  // Keep production builds from replacing a running development server's chunks.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  outputFileTracingRoot: __dirname,
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  
  transpilePackages: ['motion'],
  allowedDevOrigins: ['*.run.app', 'localhost:3000'],
};

export default nextConfig;
