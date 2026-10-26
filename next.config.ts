import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server in .next/standalone, with only the files it uses: what the container image runs.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // Playwright drives a browser from its own package files; it is not for bundling.
  serverExternalPackages: ["playwright-core", "@duckdb/node-api"],
  // A recording is uploaded through a Server Action; the default limit is 1 MB.
  experimental: { serverActions: { bodySizeLimit: "50mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
