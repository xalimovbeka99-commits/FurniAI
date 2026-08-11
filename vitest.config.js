import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    // tests/wardrobe-ai/** only — NOT tests/**, which also holds
    // tests/validator.test.js: CommonJS, deliberately run only via
    // `node --test` (see that file's own header comment). A broader glob
    // here would make vitest try to collect it too and break that harness.
    include: ["src/**/*.test.js", "tests/wardrobe-ai/**/*.test.js"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
