import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@mindyourlanguage/shared",
    "@mindyourlanguage/dictionary",
  ],
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
