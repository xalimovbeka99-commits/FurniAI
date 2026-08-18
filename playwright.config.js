// Real browser testing (Codex Blocker 3): the static site is served exactly
// as Vercel serves it — plain files, no framework — and driven by an actual
// headless Chromium instance. This is deliberately separate from `npm test`
// (vitest): it is slower, needs a browser binary, and its scope is "does the
// real DOM/WebGL/JS survive real navigation," not unit-level logic.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests/browser',
  globalTeardown: require.resolve('./tests/browser/global-teardown.js'),
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'node scripts/static-server.js',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: false,
    timeout: 15000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
