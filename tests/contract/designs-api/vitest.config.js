/**
 * Runs ONLY the designs-api contract tests. The root vitest.config.js
 * include list does not cover tests/contract/** (and is not owned by the
 * Designs Engineer), so:
 *
 *   npx vitest run --config tests/contract/designs-api/vitest.config.js
 *
 * To fold these into `npx vitest run`, CraZy Integration can add
 * "tests/contract/**\/*.test.js" to the root include list.
 */
import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export default defineConfig({
  root,
  test: {
    environment: "node",
    include: ["tests/contract/designs-api/**/*.test.js"],
  },
  resolve: {
    alias: { "@": path.resolve(root, "./src") },
  },
});
