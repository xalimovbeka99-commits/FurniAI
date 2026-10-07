// Concept gallery e2e, contract rev 2 (replica-test plan: docs/m3/projects/rev2/TEST_PLAN.md).
// FIXTURE DATA: Claude's SIMULATED pack + a SYNTHETIC GLB. Role/label selectors first.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const require = createRequire(import.meta.url);
const AXE = require.resolve("axe-core/axe.min.js");
const GLB = fileURLToPath(new URL("../fixtures/rev2/SYNTHETIC-box-not-scenario-generated.glb", import.meta.url));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const FREE_CLAIM = /no charge|not charged|free of charge|\bfree\b|nothing (was|is|will be) charged|wasn't charged|without charge|cost nothing/i;

/** Fails the test on console errors, page errors, 5xx and any request that leaves the local server. */
test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL).origin;
  const problems = [];
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => r.status() >= 500 && problems.push(`${r.status()} ${r.url()}`));
  page.on("request", (r) => !r.url().startsWith(origin) && problems.push(`external request ${r.url()}`));
  page.__problems = problems;
});
test.afterEach(async ({ page }) => {
  expect(page.__problems, "console errors / 5xx / external requests").toEqual([]);
});

async function go(page, state) {
  await page.goto(`?state=${state}`);
  if (state !== "loading") await page.waitForFunction(() => window.__gallery && window.__gallery.getState().list !== "loading");
}
async function axe(page) {
  await page.addScriptTag({ path: AXE });
  const r = await page.evaluate(() => window.axe.run(document.querySelector("[data-concept-gallery]"), { resultTypes: ["violations"] }));
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const cards = (page) => page.getByRole("article");

test("F01-H1 list: Claude's rev 2 fixture renders 7 cards; Open/Download only on the Ready one", async ({ page }) => {
  await go(page, "list");
  await expect(cards(page)).toHaveCount(7);
  await expect(page.getByRole("button", { name: /Open 3D view/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Download GLB" })).toHaveCount(1);
  const ready = cards(page).filter({ has: page.getByText("Ready", { exact: true }) });
  await expect(ready.getByRole("button")).toHaveCount(2);
  await expect(page.getByRole("img")).toHaveCount(0); // no thumbnail exists in the contract
  await expect(cards(page).first().getByRole("heading", { level: 3 })).toHaveText(/^3D concept · \d{1,2} Oct 2026, \d{2}:\d{2}$/);
  expect(await noOverflow(page)).toBe(0);
});

test("F01-H2 billing: each outcome has its own truthful line; nothing on any state claims 'free' / 'no charge'", async ({ page }) => {
  await go(page, "billing");
  const line = (outcome) => page.locator(`[data-billing="${outcome}"]`);
  await expect(line("not_submitted")).toHaveText(/^Not sent yet/);
  await expect(line("unconfirmed")).toHaveText(/^Not confirmed yet/);
  await expect(line("reported").first()).toHaveText("Cost reported by the generation service: 12 provider units (unit unverified).");
  await expect(line("unknown")).toHaveText("Not reported by this server.");
  for (const s of ["list", "billing", "failed", "submission_unknown", "rate_limited", "provider_refused"]) {
    await go(page, s);
    expect(await page.locator("[data-concept-gallery]").innerText(), s).not.toMatch(FREE_CLAIM);
  }
});

test("F01-H3 submission_unknown: 'May have been charged', no action but Refresh", async ({ page }) => {
  await go(page, "submission_unknown");
  await expect(page.locator("[data-submission-unknown]")).toContainText("May have been charged.");
  await expect(page.getByRole("button")).toHaveText(["Refresh"]);
});

const PANELS = [
  ["signed_out", "signed_out", /^Sign in to see your 3D concepts\.$/, false],
  ["forbidden", "forbidden", /permission/, false],
  ["network", "network", /Check your connection/, true],
  ["server_5xx", "server", /Try again in a moment\.$/, true],
  ["rate_limited", "rate_limited", /busy.*Try again in a moment\.$/, true],
  ["provider_refused", "provider_refused", /Try again later\.$/, true],
  ["not_configured", "not_configured", /aren't available on this deployment/, true],
  ["malformed", "malformed", /couldn't read/, true],
];
for (const [state, kind, text, retry] of PANELS) {
  test(`F01-E ${state}: one page-wide panel, honest text, Try again ${retry ? "offered" : "not offered"}`, async ({ page }) => {
    await go(page, state);
    const p = page.locator(`[data-panel="${kind}"]`);
    await expect(p).toHaveAttribute("role", "alert");
    await expect(p.locator("p")).toHaveText(text);
    await expect(p.getByRole("button", { name: "Try again" })).toHaveCount(retry ? 1 : 0);
    await expect(cards(page)).toHaveCount(0);
  });
}

test("F01-N1 empty and loading states", async ({ page }) => {
  await go(page, "empty");
  await expect(page.locator('[data-panel="empty"]')).toHaveText(/No 3D concepts yet/);
  await page.goto("?state=loading");
  await expect(page.locator('[data-panel="loading"]')).toBeAttached();
  await expect(page.locator("[data-concept-gallery]")).toHaveAttribute("aria-busy", "true");
});

test("F02-H1 Download: a fresh resolve per click and the real SYNTHETIC file", async ({ page }) => {
  await go(page, "list");
  const btn = page.getByRole("button", { name: "Download GLB" });
  for (let i = 1; i <= 2; i++) {
    const [d] = await Promise.all([page.waitForEvent("download"), btn.click()]);
    expect(sha(readFileSync(await d.path()))).toBe(sha(readFileSync(GLB)));
    await expect.poll(() => page.evaluate(() => window.__calls().filter((m) => m === "getAssetUrl").length)).toBe(i);
  }
  expect(await page.evaluate(() => JSON.stringify(window.__gallery.getState()))).not.toMatch(/https?:/); // no URL kept
});

test("F02-E1 Download 410: expired link said honestly, card stays Ready, nothing retried", async ({ page }) => {
  await go(page, "asset_unavailable");
  await expect(page.locator('[data-asset-error="ASSET_UNAVAILABLE"]')).toHaveText(/no longer available/);
  expect(await page.evaluate(() => window.__calls().filter((m) => m === "getAssetUrl").length)).toBe(1);
});

test("F02-E2 Download 429 twice: one retry after ~1 s, then 'try again in a moment'", async ({ page }) => {
  const t0 = Date.now();
  await go(page, "asset_rate_limited");
  await expect(page.locator('[data-asset-error="PROVIDER_RATE_LIMITED"]')).toHaveText("FurniAI couldn't get this file right now because the service is busy. Try again in a moment.");
  expect(Date.now() - t0).toBeGreaterThanOrEqual(1000);
  expect(await page.evaluate(() => window.__calls().filter((m) => m === "getAssetUrl").length)).toBe(2);
});

test("F02-E3 integrity: both cards lock, no Open/Download", async ({ page }) => {
  await go(page, "integrity");
  await expect(page.locator("[data-job-error]")).toHaveCount(2, { timeout: 8000 });
  await expect(page.getByRole("button", { name: /Download|Open/ })).toHaveCount(0);
});

test("F03-H1 Open: AE's viewer shows the SYNTHETIC box with the concept notice; Close returns focus", async ({ page }) => {
  await go(page, "list");
  await page.getByRole("button", { name: /Open 3D view/ }).click();
  const panel = page.locator("[data-viewer-panel]");
  await expect(panel.locator("canvas")).toBeVisible({ timeout: 15000 });
  await expect(panel.locator("[data-concept-notice]")).toContainText("AI-generated visual concept");
  await panel.getByRole("button", { name: "Close 3D view" }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Open 3D view/ })).toBeFocused();
});

test("F04-N1 keyboard: Tab reaches Download and Enter starts it", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard flow is checked on desktop");
  await go(page, "list");
  const btn = page.getByRole("button", { name: "Download GLB" });
  let reached = false;
  for (let i = 0; i < 20 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await btn.evaluate((b) => b === document.activeElement);
  }
  expect(reached).toBe(true);
  const [d] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("Enter")]);
  expect(d.suggestedFilename()).toMatch(/^furniai-concept-.*\.glb$/);
});

for (const state of ["list", "billing", "failed", "submission_unknown", "signed_out", "rate_limited", "asset_unavailable", "long"]) {
  test(`A11Y axe (serious/critical) and no horizontal overflow: ${state}`, async ({ page }) => {
    await go(page, state);
    if (state === "asset_unavailable") await page.locator("[data-asset-error]").waitFor();
    expect(await axe(page)).toEqual([]);
    expect(await noOverflow(page)).toBe(0);
  });
}
