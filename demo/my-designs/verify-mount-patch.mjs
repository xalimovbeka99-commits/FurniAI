/**
 * Smoke-test docs/m3/patches/my-designs-mount.patch WITHOUT touching the
 * worktree: HEAD:index.html + the patch + the static assets are assembled in a
 * temp dir, served on 127.0.0.1, and driven in Chromium.
 *
 * MOCKED: vendor-supabase.min.js is replaced by a stub session (token
 * "stub-token"); window.FurniDesignsApi.createDesignsApiClient is a stub that
 * answers with the contract bodies; window.reopenDesignFromApi records its
 * arguments. Every non-127.0.0.1 request is aborted (no network, no API).
 *
 *   node demo/my-designs/verify-mount-patch.mjs
 */
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const out = await mkdtemp(join(tmpdir(), "furniai-my-designs-patch-"));

// 1. HEAD:index.html (LF, as committed) + the patch, applied in the temp dir.
await writeFile(join(out, "index.html"), execFileSync("git", ["show", "HEAD:index.html"], { cwd: repo }));
execFileSync("git", ["apply", join(repo, "docs/m3/patches/my-designs-mount.patch")], { cwd: out });
const patched = await readFile(join(out, "index.html"), "utf8");
if (!patched.includes('id="myDesignsRoot"')) throw new Error("patch did not apply");

// 2. Static assets the page loads, as build-static.mjs would ship them.
for (const f of ["styles.css", "app.js", "legacy-builder-adapter.js", "partgraph-runtime-bridge.js", "ai-designer-transport.js", "vendor-three-r128.min.js"]) {
  await copyFile(join(repo, f), join(out, f));
}
await build({
  entryPoints: [join(repo, "src/lib/designs/myDesigns/entry.js")],
  bundle: true, format: "iife", globalName: "FurniMyDesigns",
  outfile: join(out, "my-designs.js"), logLevel: "warning",
});
await writeFile(join(out, "vendor-supabase.min.js"), `
window.supabase={createClient:function(){return{
  auth:{getSession:async function(){return{data:{session:{access_token:"stub-token",user:{id:"stub-user",email:"stub@example.invalid"}}},error:null}},
        onAuthStateChange:function(){return{data:{subscription:{unsubscribe:function(){}}}}},signOut:async function(){return{error:null}}},
  from:function(){var q={select:function(){return q},order:async function(){return{data:[],error:null}},insert:async function(){return{error:null}},delete:function(){return q},eq:async function(){return{error:null}}};return q}
}}};`);

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = createServer(async (req, res) => {
  const raw = new URL(req.url, "http://x").pathname;
  const path = raw === "/" ? "/index.html" : raw;
  try {
    const body = await readFile(join(out, path.slice(1)));
    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const CLIENT_STUB = (withReopen) => {
  window.__fmdCalls = [];
  window.FurniDesignsApi = {
    createDesignsApiClient(opts) {
      window.__fmdFactoryOpts = Object.keys(opts || {});
      const design = { designId: "3f7d2c1e-9a4b-4c7e-8f10-2b6a9d0e1c11", ownerUserId: "stub-user", name: "Bedroom wardrobe", createdAt: "2026-09-20T08:00:00.000Z", updatedAt: "2026-09-28T17:30:00.000Z" };
      return {
        async listDesigns(o) { window.__fmdCalls.push(["listDesigns", o && o.accessToken]); return { ok: true, designs: [design] }; },
        async getDesign(id, o) { window.__fmdCalls.push(["getDesign", id, o && o.accessToken]); return { ok: true, design, latestRevision: { revision: 2, fingerprint: "fs256:stub", specId: "furnispec-stub", validationStatus: "ACCEPTED", createdAt: design.updatedAt } }; },
        async getRevision(id, rev, o) { window.__fmdCalls.push(["getRevision", id, rev, o && o.accessToken]); return { ok: true, designId: id, revision: rev, fingerprint: "fs256:stub", furniSpec: { specId: "furnispec-stub" }, partGraph: { parts: [] }, origins: null, validationStatus: "ACCEPTED", createdAt: design.updatedAt }; },
      };
    },
  };
  if (withReopen) window.reopenDesignFromApi = (selection, record) => { window.__reopened = { selection, fingerprint: record && record.fingerprint }; };
};

const { chromium } = await import("@playwright/test");
const browser = await chromium.launch();
const report = {};
try {
  for (const variant of ["with-client", "without-reopen", "without-client"]) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e && e.message)));
    await page.route("**/*", (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
    if (variant !== "without-client") await page.addInitScript(CLIENT_STUB, variant === "with-client");
    await page.goto(`${origin}/#/projects`);
    await page.waitForFunction(() => window.__furniaiBootOk === true, null, { timeout: 10000 }).catch(() => {});
    const r = { bootOk: await page.evaluate(() => window.__furniaiBootOk === true) };
    if (variant === "with-client") {
      await page.waitForSelector("#myDesignsRoot .fmd-open", { timeout: 10000 });
      // PRE-EXISTING (base c6bbe89, not this patch): on a direct #/projects load the legacy
      // loadProjects() runs before sb.auth.getSession() resolves, sees currentUser=null and
      // opens the auth modal over the page. Record it, then close it to reach the panel.
      r.legacyAuthModalOpened = await page.evaluate(() => {
        const m = document.getElementById("authModal");
        const open = !!m && !m.hidden && getComputedStyle(m).display !== "none";
        if (m) { m.hidden = true; m.style.display = "none"; m.classList.remove("open", "show", "active"); }
        return open;
      });
      await page.click("#myDesignsRoot .fmd-open");
      await page.waitForFunction(() => !!window.__reopened, null, { timeout: 5000 });
      Object.assign(r, await page.evaluate(() => ({
        rootHidden: document.getElementById("myDesignsRoot").hidden,
        factoryOpts: window.__fmdFactoryOpts,
        calls: window.__fmdCalls,
        reopened: window.__reopened,
        status: document.querySelector("#myDesignsRoot .fmd-status").textContent,
        legacyGridPresent: !!document.getElementById("projectsGrid"),
      })));
      const shot = join(repo, "docs/m3/artifacts/my-designs/patched-index-projects.png");
      await mkdir(dirname(shot), { recursive: true });
      await page.screenshot({ path: shot });
      r.screenshot = shot;
    } else if (variant === "without-reopen") {
      await page.waitForSelector("#myDesignsRoot .fmd-open", { timeout: 10000 });
      await page.evaluate(() => {
        const m = document.getElementById("authModal");
        if (m) { m.hidden = true; m.style.display = "none"; m.classList.remove("open", "show", "active"); }
      });
      await page.click("#myDesignsRoot .fmd-open", { force: true }).catch(() => {});
      await page.waitForTimeout(200);
      Object.assign(r, await page.evaluate(() => ({
        rootHidden: document.getElementById("myDesignsRoot").hidden,
        buttons: document.querySelectorAll("#myDesignsRoot .fmd-open").length,
        allDisabled: [...document.querySelectorAll("#myDesignsRoot .fmd-open")].every((b) => b.disabled),
        notice: document.querySelector("#myDesignsRoot .fmd-notice")?.textContent || null,
        calls: window.__fmdCalls.map((c) => c[0]),
        reopenDefined: typeof window.reopenDesignFromApi === "function",
      })));
      const shot = join(repo, "docs/m3/artifacts/my-designs/patched-index-open-disabled.png");
      await page.screenshot({ path: shot });
      r.screenshot = shot;
    } else {
      await page.waitForTimeout(500);
      Object.assign(r, await page.evaluate(() => ({
        rootHidden: document.getElementById("myDesignsRoot").hidden,
        moduleLoaded: typeof window.FurniMyDesigns?.mountMyDesigns === "function",
        mountedChildren: document.getElementById("myDesignsRoot").childElementCount,
      })));
    }
    r.pageErrors = errors;
    report[variant] = r;
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify(report, null, 2));
const ok =
  report["with-client"].reopened?.selection?.designId === "3f7d2c1e-9a4b-4c7e-8f10-2b6a9d0e1c11" &&
  report["with-client"].reopened?.selection?.revision === 2 &&
  report["without-client"].rootHidden === true &&
  report["without-reopen"].rootHidden === false &&
  report["without-reopen"].buttons > 0 &&
  report["without-reopen"].allDisabled === true &&
  !!report["without-reopen"].notice &&
  JSON.stringify(report["without-reopen"].calls) === JSON.stringify(["listDesigns"]) &&
  report["without-reopen"].pageErrors.length === 0 &&
  report["with-client"].pageErrors.length === 0 &&
  report["without-client"].pageErrors.length === 0;
console.log(ok ? "MOUNT PATCH SMOKE: PASS (MOCKED)" : "MOUNT PATCH SMOKE: FAIL");
process.exitCode = ok ? 0 : 1;
