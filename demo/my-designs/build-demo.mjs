/**
 * Build the My Designs demo into a TEMP directory (never dist/, never the
 * repo root) and optionally capture one screenshot per state.
 *
 *   node demo/my-designs/build-demo.mjs                 # build, print the path to open
 *   node demo/my-designs/build-demo.mjs --screenshots   # + PNGs into docs/m3/artifacts/my-designs/
 *   node demo/my-designs/build-demo.mjs --entry-check   # also bundle entry.js (IIFE, FurniMyDesigns) and smoke-load it
 *
 * Uses only the repo's existing esbuild and @playwright/test. MOCKED data only.
 */
import { build } from "esbuild";
import { copyFile, mkdir, mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const args = new Set(process.argv.slice(2));
const out = await mkdtemp(join(tmpdir(), "furniai-my-designs-demo-"));

await build({
  entryPoints: [join(here, "demo.js")],
  bundle: true,
  format: "iife",
  outfile: join(out, "demo.bundle.js"),
  logLevel: "warning",
});
await copyFile(join(here, "index.html"), join(out, "index.html"));
const pageUrl = pathToFileURL(join(out, "index.html")).href;
console.log(`demo built: ${join(out, "index.html")}`);

let entryBundle = null;
if (args.has("--entry-check")) {
  entryBundle = join(out, "my-designs.js");
  const result = await build({
    entryPoints: [join(repo, "src/lib/designs/myDesigns/entry.js")],
    bundle: true,
    format: "iife",
    globalName: "FurniMyDesigns",
    outfile: entryBundle,
    metafile: true,
    logLevel: "warning",
  });
  const inputs = Object.keys(result.metafile.inputs).map((p) => p.replace(/\\/g, "/"));
  const size = (await stat(entryBundle)).size;
  const src = await readFile(entryBundle, "utf8");
  const leaks = inputs.filter((p) => /fakeDesignsApiClient|persistence\//.test(p));
  console.log(`entry bundle: ${entryBundle} (${size} bytes, ${inputs.length} inputs)`);
  console.log(`entry inputs: ${inputs.join(", ")}`);
  console.log(`entry excludes fake client + persistence: ${leaks.length === 0 ? "yes" : "NO: " + leaks.join(", ")}`);
  console.log(`entry uses innerHTML: ${/innerHTML/.test(src) ? "YES" : "no"}`);
  if (leaks.length) process.exitCode = 1;
}

if (args.has("--screenshots") || entryBundle) {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch();
  try {
    if (entryBundle) {
      const page = await browser.newPage();
      await page.setContent("<!doctype html><html><head></head><body><div id=r></div></body></html>");
      await page.addScriptTag({ path: entryBundle });
      const smoke = await page.evaluate(async () => {
        const lib = window.FurniMyDesigns;
        const calls = [];
        const client = {
          async listDesigns() { return { ok: true, designs: [{ designId: "srv-1", ownerUserId: "u", name: "<b>x</b>", createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z" }] }; },
          async getDesign(id) { return { ok: true, design: { designId: id, ownerUserId: "u", name: "<b>x</b>", createdAt: "a", updatedAt: "a" }, latestRevision: { revision: 4, fingerprint: "f", specId: "s", validationStatus: "ACCEPTED", createdAt: "a" } }; },
          async getRevision(id, rev) { return { ok: true, designId: id, revision: rev, fingerprint: "f", furniSpec: {}, partGraph: {}, origins: null, validationStatus: "ACCEPTED", createdAt: "a" }; },
        };
        const h = lib.mountMyDesigns(document.getElementById("r"), { client, getAccessToken: async () => "t", onOpenDesign: (s) => calls.push(s) });
        await new Promise((r) => setTimeout(r, 50));
        document.querySelector(".fmd-open").click();
        await new Promise((r) => setTimeout(r, 50));
        const out = {
          globals: Object.keys(lib).sort(),
          boldElements: document.querySelectorAll("#r b").length,
          nameText: document.querySelector(".fmd-name").textContent,
          calls,
          state: h.getState().open.status,
        };
        h.destroy();
        out.afterDestroyChildren = document.getElementById("r").childElementCount;
        return out;
      });
      console.log(`entry smoke (real Chromium): ${JSON.stringify(smoke)}`);
      await page.close();
    }
    if (args.has("--screenshots")) {
      const dir = join(repo, "docs/m3/artifacts/my-designs");
      await mkdir(dir, { recursive: true });
      const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
      await page.goto(pageUrl);
      const scenarios = await page.evaluate(() => window.__myDesignsDemo.scenarios);
      for (const name of scenarios) {
        await page.goto(`${pageUrl}?state=${encodeURIComponent(name)}`);
        await page.waitForSelector(`body[data-demo-ready="${name}"]`, { timeout: 5000 });
        await page.waitForTimeout(80);
        const file = join(dir, `${name}.png`);
        await page.screenshot({ path: file, fullPage: true });
        const info = await page.evaluate(() => {
          const s = document.querySelector(".fmd");
          return {
            list: s.getAttribute("data-list-state"),
            open: s.getAttribute("data-open-state"),
            busy: s.getAttribute("aria-busy"),
            status: document.querySelector(".fmd-status").textContent,
            imgInjected: document.querySelectorAll("#myDesignsRoot img").length,
          };
        });
        console.log(`screenshot ${name}: ${file} ${JSON.stringify(info)}`);
      }
      // mobile width, list state
      await page.setViewportSize({ width: 390, height: 780 });
      await page.goto(`${pageUrl}?state=list`);
      await page.waitForSelector('body[data-demo-ready="list"]');
      const mobile = join(dir, "list-390.png");
      await page.screenshot({ path: mobile, fullPage: true });
      console.log(`screenshot list-390: ${mobile}`);
    }
  } finally {
    await browser.close();
  }
}
