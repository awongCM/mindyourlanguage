import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', '*.trycloudflare.com'],
  transpilePackages: [
    "@mindyourlanguage/shared",
    "@mindyourlanguage/dictionary",
  ],
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
