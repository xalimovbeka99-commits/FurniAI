// Minimal static file server used only by playwright.config.js's webServer,
// so browser tests exercise the exact same flat files Vercel serves
// (index.html, styles.css, legacy-builder-adapter.js, app.js) with zero
// framework/build step in between — matching vercel.json's own
// `framework: null` static deployment.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const PORT = 4173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    const filePath = path.join(ROOT, urlPath === "/" ? "/index.html" : urlPath);
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
    });
  } catch (err) {
    // Test-only tooling, not shipped code — but an uncaught synchronous
    // throw here (e.g. decodeURIComponent on a malformed request) would
    // otherwise crash the whole process mid-suite, taking down every test
    // after it with a confusing ECONNREFUSED instead of a clear cause.
    console.error("static-server request error:", err && err.message);
    if (!res.headersSent) { res.writeHead(500); res.end("Internal error"); }
  }
});

server.on("error", (err) => {
  console.error("static-server fatal error:", err && err.message);
});

// Track open sockets so shutdown can actually terminate promptly.
// http.Server#close() alone only stops accepting NEW connections and waits
// for every EXISTING one to end on its own — a well-known Node gotcha: a
// browser holding one idle keep-alive socket open can make close() hang
// indefinitely, which would look exactly like "the whole test run finished
// but the process never exits." Destroying tracked sockets on shutdown
// avoids that regardless of whether it was ever the actual cause here.
const openSockets = new Set();
server.on("connection", (socket) => {
  openSockets.add(socket);
  socket.on("close", () => openSockets.delete(socket));
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close(() => process.exit(0));
  for (const socket of openSockets) socket.destroy();
  // Absolute backstop — .unref() so this timer's mere existence can never
  // itself be the reason the process doesn't exit naturally.
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

server.listen(PORT, "127.0.0.1", () => {
  console.log(`static-server listening on http://127.0.0.1:${PORT}`);
});
