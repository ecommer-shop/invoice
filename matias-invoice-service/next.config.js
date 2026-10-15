const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Docker / Railway container deploys
  output: 'standalone',
  // Avoid picking a parent lockfile (e.g. ~/package-lock.json) as the workspace root
  outputFileTracingRoot: path.join(__dirname),
  // API Routes configuration
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-API-Key,Content-Type,Authorization' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

