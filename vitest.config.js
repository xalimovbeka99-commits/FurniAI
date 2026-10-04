import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    // tests/wardrobe-ai/**, tests/part-graph/**, tests/production/** only — NOT tests/**,
    // which also holds tests/validator.test.js: CommonJS, deliberately run only via
    // `node --test` (see that file's own header comment). A broader glob
    // here would make vitest try to collect it too and break that harness.
    include: [
      "src/**/*.test.js",
      "tests/wardrobe-ai/**/*.test.js",
      "tests/part-graph/**/*.test.js",
      "tests/production/**/*.test.js",
      "tests/contract/**/*.test.js",
      "tests/projects/**/*.test.js",
      "tests/assetViewer/**/*.test.js",
      // Scenario 3D acceptance (Grok QA): SIMULATED/MOCKED/LOCAL, real /api/creative handlers.
      "tests/acceptance/scenario/**/*.test.js",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});