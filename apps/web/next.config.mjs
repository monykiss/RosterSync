const apiProxyTarget =
  process.env.API_PROXY_TARGET?.replace(/\/$/, '') ??
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    if (!apiProxyTarget) {
      return [];
    }

    return [
      {
        source: '/api/:path*',
        destination: `${apiProxyTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
