// Concept gallery e2e (replica-test). FIXTURE DATA only: the demo page over Claude's SIMULATED
// rev 2 pack; no /api/creative, no Scenario, no paid call.
//   npx playwright test -c tests/projects/e2e/playwright.config.mjs
import { defineConfig } from "@playwright/test";

const PORT = 5179;
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.mjs",
  timeout: 30000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/docs/m3/projects/demo/`,
    locale: "en-GB",
    timezoneId: "Asia/Dubai",
    reducedMotion: "reduce",
    acceptDownloads: true,
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  projects: [
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 900 } } },
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
  ],
  webServer: { command: `node docs/m3/projects/demo/serve.mjs ${PORT}`, cwd: "../../..", url: `http://127.0.0.1:${PORT}/docs/m3/projects/demo/`, reuseExistingServer: false },
});
