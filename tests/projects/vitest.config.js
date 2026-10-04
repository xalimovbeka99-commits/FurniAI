// Runs only the concept-gallery suites:  npx vitest run --config tests/projects/vitest.config.js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { root: new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), include: ["tests/projects/**/*.test.js"] },
});
