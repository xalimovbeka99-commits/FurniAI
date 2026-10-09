/**
 * Shared e2e fixtures: every test fails on a console error or any 5xx response
 * (replica-test rule), except errors a test DECLARES as the expected symptom of
 * the broken input it deliberately serves (allowConsole). axe comes from
 * /workspace/asset-viewer/tools (not a repo dependency; package.json untouched).
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { test as base, expect } from "@playwright/test";

const toolsRequire = createRequire("/workspace/asset-viewer/tools/package.json");
const AxeBuilder = toolsRequire("@axe-core/playwright").default;

export const BOX = "docs/creative/fixtures/SYNTHETIC-box-not-scenario-generated.glb";
export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
export const fixtureSha = (rel) => sha256(readFileSync(join(repoRoot(), rel)));

export function repoRoot() {
  // config cwd is tests/assetViewer/e2e when run with -c; fall back to the process cwd
  let d = process.cwd();
  for (let i = 0; i < 5; i++) {
    try {
      readFileSync(join(d, "vendor-three-r128.min.js"), { flag: "r" });
      return d;
    } catch {
      d = join(d, "..");
    }
  }
  return process.cwd();
}

export const test = base.extend({
  // { patterns: RegExp[] }: an object, because Playwright reads a bare array as [value, options]
  allowConsole: [{ patterns: [] }, { option: true }],
  guard: [
    async ({ page, allowConsole }, use) => {
      const problems = [];
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const t = m.text();
        if (!allowConsole.patterns.some((re) => re.test(t))) problems.push(`console error: ${t}`);
      });
      page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
      page.on("response", (r) => {
        if (r.status() >= 500) problems.push(`${r.status()} on ${r.url()}`);
      });
      await use(problems);
      expect(problems, "console errors / 5xx").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export async function openState(page, q) {
  await page.goto(`/docs/m3/asset-viewer/demo/host.html?state=${q}`);
  await expect(page.getByText("SIMULATED, demonstration asset, not a Scenario result")).toBeVisible();
}

export function viewer(page) {
  return page.getByRole("region", { name: "3D model preview" });
}

export async function waitStatus(page, status, timeout = 20_000) {
  await page.waitForFunction((s) => window.__host && window.__host.handle && window.__host.handle.getState().status === s, status, { timeout });
}

export const getState = (page) => page.evaluate(() => window.__host.handle.getState());
export const getView = (page) => page.evaluate(() => window.__host.handle.getView());

export async function axe(page, label) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const v = r.violations.map((x) => `${x.id} (${x.impact}): ${x.nodes.length} node(s) ${x.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
  test.info().annotations.push({ type: "axe", description: `${label}: ${r.violations.length} violations, ${r.passes.length} passes` });
  expect(v, `axe ${label}`).toEqual([]);
}

export async function noHorizontalOverflow(page) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(o, "horizontal overflow (px)").toBeLessThanOrEqual(0);
}

/**
 * Review round 5 (QE layout probe, 390 px): no element sticks out past the viewport's right edge
 * and no clipping box (overflow other than visible, e.g. the viewer root) has content wider than
 * itself, on top of the document-level check above.
 */
export async function noElementOverflow(page) {
  const bad = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    for (const e of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || e.closest("[hidden]")) continue;
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const name = `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}${[...e.attributes].filter((a) => a.name.startsWith("data-")).map((a) => `[${a.name}]`).join("")}`;
      if (r.right > vw + 0.5 || r.left < -0.5) out.push(`${name} off-viewport ${Math.round(r.left)}..${Math.round(r.right)} (vw ${vw})`);
      if (cs.overflowX !== "visible" && e.tagName !== "PRE" && e.scrollWidth > e.clientWidth + 1) out.push(`${name} content ${e.scrollWidth} > box ${e.clientWidth}`);
    }
    return out;
  });
  expect(bad, "elements overflowing horizontally").toEqual([]);
}

/** Every visible interactive control (viewer overlay and host/demo page) is at least 44 x 44 CSS px. */
export async function tapTargets(page, min = 44) {
  const r = await page.evaluate((m) => {
    const sel = "button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [tabindex]:not([tabindex='-1']):not(canvas)";
    const all = [...document.querySelectorAll(sel)].filter((e) => {
      const cs = getComputedStyle(e);
      const b = e.getBoundingClientRect();
      return cs.display !== "none" && cs.visibility !== "hidden" && b.width > 0 && b.height > 0;
    });
    const small = all
      .map((e) => ({ e, b: e.getBoundingClientRect() }))
      .filter(({ b }) => b.width < m - 0.01 || b.height < m - 0.01)
      .map(({ e, b }) => `${(e.getAttribute("aria-label") || e.textContent || e.tagName).trim().slice(0, 40)} ${b.width.toFixed(1)}x${b.height.toFixed(1)}`);
    const inViewer = all.filter((e) => e.closest("[data-asset-viewer]")).length;
    return { count: all.length, inViewer, small };
  }, min);
  expect(r.small, `controls under ${min}x${min} CSS px`).toEqual([]);
  return r;
}

/**
 * Records screen-reader announcements: every DOM text change inside a live region
 * (role=alert/status/log or aria-live other than off), from page load on. Call before goto.
 */
export async function recordAnnouncements(page) {
  await page.addInitScript(() => {
    const rec = (window.__announcements = []);
    const liveOf = (n) => {
      for (let e = n && n.nodeType === 1 ? n : n && n.parentElement; e; e = e.parentElement) {
        const role = e.getAttribute("role");
        const live = e.getAttribute("aria-live");
        if (/^(alert|status|log)$/.test(role || "") || (live && live !== "off")) return e;
      }
      return null;
    };
    new MutationObserver((ms) => {
      for (const m of ms) {
        const region = liveOf(m.target);
        if (!region) continue;
        const text = region.textContent.trim();
        if (text) rec.push({ role: region.getAttribute("role"), live: region.getAttribute("aria-live"), text });
      }
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
}

/** Expected browser messages for deliberately broken inputs. */
export const EXPECTED = {
  http4xx: /Failed to load resource: the server responded with a status of 4(03|04|10)/,
  cors: /blocked by CORS policy|net::ERR_FAILED|Failed to load resource: net::ERR_FAILED/,
  gltfTexture: /THREE\.GLTFLoader: Couldn't load texture/,
};
