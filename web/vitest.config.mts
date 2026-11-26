import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Vitest mirrors the `@/*` path alias from tsconfig.json so tests can import
 * modules that use it (the zod schemas import `@/server/validation/input`).
 * DATABASE_URL is a dummy so modules that build the Prisma client at import
 * time load without a database; integration tests use their own
 * CN_TEST_DATABASE_URL.
 */
export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 15000,
    env: {
      DATABASE_URL: "postgresql://lopest_app_user:dummy_password@localhost:5432/lopest_core?schema=public",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
