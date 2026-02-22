/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent Turbopack from bundling Node-only packages into the browser bundle.
  // @prisma/adapter-pg → pg requires dns/net/tls/fs which don't exist in browsers.
  serverExternalPackages: ['@prisma/client', 'prisma', '@prisma/adapter-pg', 'pg'],
};

export default nextConfig;
