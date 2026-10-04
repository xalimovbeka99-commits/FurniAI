// LOCAL regression run of the existing editable-builder suite
// (playwright.config.js) on a UNIQUE port with reuseExistingServer:false,
// so it can never attach to whatever else is serving the shared port 4173.
//
// It runs UNTRACKED, sanitized copies of tests/browser/*.spec.js (see
// tests/acceptance/scenario/regression/sanitize-browser-specs.cjs): the lines
// that copy screenshots into C:/Users/xalim/.gemini/antigravity/brain/... are
// removed and docs/** evidence targets are redirected under test-results/.
// Same tests otherwise, same static server code (see the port wrapper).
const path = require("path");
const base = require("./playwright.config.js");
const { sanitizeBrowserSpecs } = require("./tests/acceptance/scenario/regression/sanitize-browser-specs.cjs");

const PORT = Number(process.env.SCENARIO_QA_STATIC_PORT || 4418);
if (PORT === 4173) throw new Error("use a unique port, not the shared 4173");
process.env.SCENARIO_QA_STATIC_PORT = String(PORT);
const { dir } = sanitizeBrowserSpecs(__dirname);

module.exports = {
  ...base,
  testDir: path.relative(__dirname, dir),
  use: { ...base.use, baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    ...base.webServer,
    command: "node tests/acceptance/scenario/regression/static-server-port.cjs",
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: false,
  },
};
