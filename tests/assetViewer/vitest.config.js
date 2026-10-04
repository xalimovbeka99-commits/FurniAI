/**
 * Runs ONLY the asset-viewer tests:
 *
 *   npx vitest run --config tests/assetViewer/vitest.config.js
 *
 * The root vitest.config.js include list (Integration-owned) does not cover
 * tests/assetViewer/**, so src/lib/assetViewer/assetViewer.collect.test.js
 * imports these suites to make plain `npx vitest run` execute them too. If
 * Integration adds "tests/assetViewer/**\/*.test.js" to the root include,
 * delete that collector to avoid running everything twice.
 */
import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
  root,
  test: {
    environment: "node",
    include: ["tests/assetViewer/**/*.test.js"],
  },
  resolve: {
    alias: { "@": path.resolve(root, "./src") },
  },
});
