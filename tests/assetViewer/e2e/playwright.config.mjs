/**
 * Asset-viewer e2e (replica-test skill, applied by reading the folder directly).
 * Own config: the root playwright configs only cover tests/browser and
 * tests/acceptance/scenario/browser. Runs the HOST page (host.html) served by
 * docs/m3/asset-viewer/demo/serve.mjs. Everything is SYNTHETIC/MOCKED or
 * SIMULATED; nothing is LIVE and no provider is called.
 *
 *   npx playwright test -c tests/assetViewer/e2e/playwright.config.mjs
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.AV_E2E_PORT || 4338);

export default defineConfig({
  testDir: ".",
  testMatch: /f0\d-.*\.spec\.mjs$/,
  fullyParallel: false,
  workers: 1, // the SIMULATED backend counts resolves; one worker keeps those counts exact
  retries: 0,
  timeout: 45_000,
  reporter: [["list"], ["json", { outputFile: "../../../test-results/asset-viewer-e2e/results.json" }]],
  outputDir: "../../../test-results/asset-viewer-e2e/artifacts",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  projects: [
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
    { name: "mobile-390", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true } },
  ],
  webServer: {
    command: `node docs/m3/asset-viewer/demo/serve.mjs ${PORT}`,
    cwd: "../../..",
    url: `http://127.0.0.1:${PORT}/docs/m3/asset-viewer/demo/host.html`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
