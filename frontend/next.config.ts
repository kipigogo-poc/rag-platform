import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    // BACKEND_URL is a server-side runtime env var — not baked in at build time.
    // Locally it falls back to http://localhost:3001.
    // In Docker it is set to http://backend:3001 (internal service name).
    const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3001';
    return [
      {
        source: '/nest/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
