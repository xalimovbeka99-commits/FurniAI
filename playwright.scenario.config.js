// Scenario 3D acceptance — browser layer (TEST HARNESS, SIMULATED/LOCAL).
// Separate from playwright.config.js on purpose: its own unique port (4417,
// never the shared 4173), reuseExistingServer:false so it can never attach to
// someone else's server, and its own harness server that mounts the REAL
// /api/creative handler against a local provider stand-in.
const { defineConfig, devices } = require("@playwright/test");

const PORT = Number(process.env.SCENARIO_HARNESS_PORT || 4417);
// The REAL product page (index.html) for the Antigravity reference-panel check,
// served by scripts/static-server.js through the port wrapper (never 4173).
const UI_PORT = Number(process.env.SCENARIO_UI_PORT || 4420);
if (PORT === 4173 || UI_PORT === 4173) throw new Error("playwright.scenario.config.js must not use the shared port 4173");

module.exports = defineConfig({
  testDir: "tests/acceptance/scenario/browser",
  testMatch: "**/*.spec.js",
  timeout: 45000,
  fullyParallel: false,
  workers: 1, // one harness server with shared fixture state
  retries: 0,
  reporter: [["list"]],
  outputDir: "test-results/scenario-acceptance",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    acceptDownloads: true,
  },
  projects: [
    { name: "desktop", testMatch: "**/harness.spec.js", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobile-390", testMatch: "**/harness.spec.js", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    { name: "antigravity-ui", testMatch: "**/antigravity-reference-panel.spec.js", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, baseURL: `http://127.0.0.1:${UI_PORT}` } },
  ],
  webServer: [{
    command: "node tests/acceptance/scenario/harness/server.mjs",
    url: `http://127.0.0.1:${PORT}/__fixture/state`,
    env: { SCENARIO_HARNESS_PORT: String(PORT) },
    reuseExistingServer: false,
    timeout: 20000,
    stdout: "pipe",
    stderr: "pipe",
  }, {
    command: "node tests/acceptance/scenario/regression/static-server-port.cjs",
    url: `http://127.0.0.1:${UI_PORT}/`,
    env: { SCENARIO_QA_STATIC_PORT: String(UI_PORT) },
    reuseExistingServer: false,
    timeout: 20000,
    stdout: "pipe",
    stderr: "pipe",
  }],
});
