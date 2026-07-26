import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const authUrl = process.env.AUTH_URL;
const allowedDevOrigins = authUrl ? [new URL(authUrl).host] : [];
const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  images: {
    domains: ['static.usernames.app-backend.toolsforhumanity.com'],
  },
  allowedDevOrigins,
  reactStrictMode: false,
  // Avoid picking ~/pnpm-lock.yaml as workspace root (breaks .next NFT traces).
  outputFileTracingRoot: appDir,
};

export default nextConfig;
