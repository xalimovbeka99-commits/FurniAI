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

// No SIGTERM/SIGINT handling here on purpose — verified against
// Playwright's own source (packages/utils/processLauncher.ts,
// packages/playwright/src/plugins/webServerPlugin.ts) that on Windows it
// spawns the webServer command with shell:true (so this process is a
// GRANDCHILD of the cmd.exe Playwright directly manages) and its
// attemptToGracefullyClose() unconditionally throws
// ("Graceful shutdown is not supported on Windows"), falling through to
// `taskkill /pid <pid> /T /F` on the whole process tree every time. A
// signal handler registered here would never be invoked by Playwright's
// actual Windows teardown path, so keeping one was dead code creating a
// false sense of the shutdown mechanism — removed rather than left as
// unverified, unnecessary complexity.

server.listen(PORT, "127.0.0.1", () => {
  console.log(`static-server listening on http://127.0.0.1:${PORT}`);
});
