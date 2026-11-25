import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

import { securityHeaderRoutes } from "./src/server/security/security-headers";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",

  /** Do not advertise the framework (`x-powered-by: Next.js`). */
  poweredByHeader: false,

  /**
   * Security headers on every response — pages, API and static files. The
   * policy and its reasons live in one authority,
   * src/server/security/security-headers.ts; nothing else writes them.
   */
  async headers() {
    return securityHeaderRoutes();
  },

  turbopack: {
    root: appRoot,
  },
};

export default nextConfig;
