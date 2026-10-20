import type { NextConfig } from "next";
import { parseServerEnv } from "./lib/env-schema";

// Fail `next dev` and `next build` (including on Vercel) right away, naming any bad variable.
parseServerEnv(process.env);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Enables forbidden() and app/forbidden.tsx, so reps get a real 403 on admin pages.
    authInterrupts: true,
  },
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
