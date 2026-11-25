import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Vitest mirrors the `@/*` path alias from tsconfig.json so tests can import
 * modules that use it (the zod schemas import `@/server/validation/input`).
 * Before this file existed tests could only import alias-free modules.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
