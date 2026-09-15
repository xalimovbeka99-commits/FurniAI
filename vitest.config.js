import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    // tests/wardrobe-ai/** and tests/part-graph/** only — NOT tests/**, which also holds
    // tests/validator.test.js: CommonJS, deliberately run only via
    // `node --test` (see that file's own header comment). A broader glob
    // here would make vitest try to collect it too and break that harness.
    include: [
      "src/**/*.test.js",
      "tests/wardrobe-ai/**/*.test.js",
      "tests/part-graph/**/*.test.js",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
