// LOCAL regression run of the existing editable-builder suite
// (playwright.config.js) on a UNIQUE port with reuseExistingServer:false,
// so it can never attach to whatever else is serving the shared port 4173.
// Same testDir, same specs, same static server code (see the wrapper).
const base = require("./playwright.config.js");

const PORT = Number(process.env.SCENARIO_QA_STATIC_PORT || 4418);
process.env.SCENARIO_QA_STATIC_PORT = String(PORT);

module.exports = {
  ...base,
  use: { ...base.use, baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    ...base.webServer,
    command: "node tests/acceptance/scenario/regression/static-server-port.cjs",
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: false,
  },
};
