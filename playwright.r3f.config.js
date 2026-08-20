// Real-browser regression suite for the Next.js /builder route (React
// Three Fiber), separate from playwright.config.js (the legacy static-site
// suite) on purpose — the two target entirely different rendering stacks
// (React/R3F vs. vanilla-JS Three.js) and, per hard-won experience earlier
// in this project, running unrelated Playwright suites through the same
// config/webServer causes real cross-suite interference.
//
// Uses `next start` (a production server) against a pre-existing `.next`
// build, not `next dev`: Next.js's dev server holds a single-instance lock
// scoped to the whole project directory (not just a port), so a second
// `next dev` refuses to start at all while another one is already running
// from this same checkout — this suite must not require killing anyone
// else's dev session to run. Run `npm run build` before this script if
// `.next` isn't already built (the required Phase 6 quality gate build
// already produces it in the normal verification sequence).
//
// tests/browser/r3f-builder.spec.js polls for real rendered GPU pixels
// rather than assuming a fixed short wait, to correctly account for the
// page's genuine (bounded, fallback-covered) Suspense-resolution latency
// during initial hydration — see that file's own doc comment for the
// measured numbers and why a short/fixed wait previously misdiagnosed
// this normal state as "the Builder is blank."
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests/browser',
  testMatch: 'r3f-builder.spec.js',
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3099',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npx next start -p 3099',
    url: 'http://127.0.0.1:3099/builder',
    reuseExistingServer: false,
    timeout: 60000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
