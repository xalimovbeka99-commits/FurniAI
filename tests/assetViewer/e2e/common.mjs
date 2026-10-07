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

/** Expected browser messages for deliberately broken inputs. */
export const EXPECTED = {
  http4xx: /Failed to load resource: the server responded with a status of 4(03|04|10)/,
  cors: /blocked by CORS policy|net::ERR_FAILED|Failed to load resource: net::ERR_FAILED/,
  gltfTexture: /THREE\.GLTFLoader: Couldn't load texture/,
};
