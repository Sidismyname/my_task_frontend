import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    const api = (process.env.API_URL ?? 'http://localhost:3001/api').replace(/\/+$/, '');
    return [{ source: '/api/tasks/:path*', destination: `${api}/tasks/:path*` }];
  },
};

export default nextConfig;
