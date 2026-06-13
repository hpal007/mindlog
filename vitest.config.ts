import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Path alias `@` -> repo root, matching tsconfig `"@/*": ["./*"]`.
const repoRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": repoRoot,
      // `server-only` is a Next.js build-time marker with no runtime; stub it so
      // route handlers can be imported and unit-tested outside the Next bundler.
      "server-only": fileURLToPath(new URL("tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    globals: true,
    // Default to jsdom for component tests. Route/unit files that need the Node
    // runtime opt in per-file with a `// @vitest-environment node` docblock.
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["lib/**/*.ts", "app/api/**/*.ts"],
      exclude: ["lib/**/*.d.ts", "**/*.test.*"],
    },
  },
});
