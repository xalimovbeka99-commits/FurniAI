// LOCAL regression helper — NOT product code.
// Runs the project's own scripts/static-server.js UNCHANGED, but makes its
// hard-coded `listen(4173)` bind to $SCENARIO_QA_STATIC_PORT instead, so the
// editable-builder suite can run without touching the shared port 4173.
const http = require("http");
const path = require("path");
const port = Number(process.env.SCENARIO_QA_STATIC_PORT || 4418);
const origListen = http.Server.prototype.listen;
http.Server.prototype.listen = function patchedListen(...args) {
  if (args[0] === 4173) args[0] = port;
  else if (args[0] && typeof args[0] === "object" && args[0].port === 4173) args[0] = { ...args[0], port };
  const redirected = args[0] === port || (args[0] && args[0].port === port);
  const srv = origListen.apply(this, args);
  if (redirected) srv.once("listening", () => console.log(`[static-server-port] scripts/static-server.js is ACTUALLY bound to 127.0.0.1:${srv.address().port} (its own log line says 4173; that is the hard-coded constant)`));
  return srv;
};
require(path.resolve(process.cwd(), "scripts/static-server.js"));
