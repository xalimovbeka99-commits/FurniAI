// Concept gallery e2e, contract rev 2 (replica-test plan: docs/m3/projects/rev2/TEST_PLAN.md).
// Evidence label: SYNTHETIC/MOCKED. Claude's SIMULATED pack + a SYNTHETIC GLB + serve.mjs's MOCKED
// /__mock-api/creative for the reload case. Not LIVE: no real backend, no Scenario. Role/label selectors first.
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
  // The other local host name on the same port is the demo's stand-in for a cross-origin CDN.
  const local = [origin, origin.replace("127.0.0.1", "localhost")];
  page.on("request", (r) => !local.some((o) => r.url().startsWith(o)) && problems.push(`external request ${r.url()}`));
  page.__problems = problems;
});
test.afterEach(async ({ page }) => {
  expect(page.__problems, "console errors / 5xx / external requests").toEqual([]);
  // Browser storage is never used as persistence (or at all) by the gallery.
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
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
  await expect(ready.locator('[data-result="available"]')).toHaveText("Available (GLB)");
  await expect(page.locator('[data-result="available"]')).toHaveCount(1);
  await expect(page.getByRole("img")).toHaveCount(0); // no thumbnail resolver in this state (the contract has no field)
  await expect(cards(page).first().getByRole("heading", { level: 3 })).toHaveText(/^3D concept · \d{1,2} Oct 2026, \d{2}:\d{2}$/);
  expect(await noOverflow(page)).toBe(0);
});

test("F01-H2 billing: each outcome has its own truthful line; nothing on any state claims 'free' / 'no charge'", async ({ page }) => {
  await go(page, "billing");
  const line = (outcome) => page.locator(`[data-billing="${outcome}"]`);
  await expect(line("not_submitted")).toHaveText(/^Not sent yet/);
  await expect(line("unconfirmed")).toHaveText(/^Not confirmed yet/);
  await expect(line("reported").first()).toHaveText("Cost reported by the generation service: 12 provider units (unit unverified).");
  await expect(line("unknown")).toHaveText("This server didn't report billing for this concept, so it isn't known whether it was charged.");
  await expect(page.locator("[data-concept-gallery]")).not.toContainText(/no cost has been reported/i);
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
  ["forbidden", "forbidden", /^This account doesn't have permission to see these 3D concepts\.$/, false],
  ["network", "network", /Check your connection/, true],
  ["server_5xx", "server", /Try again in a moment\.$/, true],
  ["rate_limited", "rate_limited", /busy.*Try again in a moment\.$/, true],
  ["provider_refused", "provider_refused", /Try again later\.$/, false],
  ["provider_unavailable", "provider_unavailable", /isn't responding right now/, true],
  ["not_configured", "not_configured", /aren't available on this deployment/, false],
  ["malformed", "malformed", /couldn't read/, false],
];
test("F06-N2 403 is page-wide with NO sign-in prompt (AE confirmed); 401 keeps it", async ({ page }) => {
  await go(page, "forbidden");
  const gallery = page.locator(".fcg");
  await expect(page.locator('[data-panel="forbidden"]')).toBeVisible();
  await expect(gallery.getByRole("button", { name: /sign\s*-?\s*in/i })).toHaveCount(0);
  await expect(gallery.getByRole("link", { name: /sign\s*-?\s*in/i })).toHaveCount(0);
  await expect(gallery).not.toContainText(/sign(ing)?[\s-]*in/i);
  await go(page, "signed_out");
  await expect(page.locator('[data-panel="signed_out"]')).toContainText("Sign in to see your 3D concepts.");
});

for (const [state, kind, text, retry] of PANELS) {
  test(`F01-E ${state}: one page-wide panel, honest text, Try again ${retry ? "offered" : "not offered"}`, async ({ page }) => {
    await go(page, state);
    const p = page.locator(`[data-panel="${kind}"]`);
    await expect(p).toHaveAttribute("role", "alert");
    await expect(p.locator("p").last()).toHaveText(text);
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

test("F02-E2 Download 429: ONE request, no automatic retry; only 'Try download again' sends another", async ({ page }) => {
  await go(page, "asset_rate_limited");
  await expect(page.locator('[data-asset-error="PROVIDER_RATE_LIMITED"]')).toHaveText("FurniAI couldn't get this file right now because the service is busy. Try again in a moment.");
  const count = () => page.evaluate(() => window.__calls().filter((m) => m === "getAssetUrl").length);
  await page.waitForTimeout(2500); // the old ~1 s auto re-resolve would have fired by now
  expect(await count()).toBe(1);
  await page.getByRole("button", { name: "Try download again" }).click();
  await expect.poll(count).toBe(2);
  await page.waitForTimeout(1500);
  expect(await count()).toBe(2);
});

test("F02-E4 Download 502 PROVIDER_UNAVAILABLE: provider wording, one request, visible Try again", async ({ page }) => {
  await go(page, "asset_provider_unavailable");
  await expect(page.locator('[data-asset-error="PROVIDER_UNAVAILABLE"]')).toHaveText(/3D generation service isn't responding/);
  await expect(page.getByRole("button", { name: "Try download again" })).toBeVisible();
  expect(await page.evaluate(() => window.__calls().filter((m) => m === "getAssetUrl").length)).toBe(1);
});

test("F05-H1 reload: the server's job list restores the card, unfinished job resumes polling, then Ready (MOCKED server)", async ({ page, request }, info) => {
  const sid = `e2e-${info.project.name}`;
  const stats = async () => (await (await request.get(`/__mock-api/${sid}/stats`)).json());
  await request.post(`/__mock-api/${sid}/reset?after=3`);
  await go(page, `reload&sid=${sid}`);
  const c = cards(page);
  await expect(c).toHaveCount(1);
  await expect(c.getByText("Generating", { exact: true })).toBeVisible();
  await expect.poll(async () => (await stats()).getJob, { timeout: 8000 }).toBeGreaterThanOrEqual(1); // polling ran
  await page.reload();
  await page.waitForFunction(() => window.__gallery && window.__gallery.getState().list !== "loading");
  expect((await stats()).list).toBe(2); // the reload re-read GET ?resource=jobs: that is the only source
  await expect(c).toHaveCount(1);
  await expect(c.getByText("Generating", { exact: true })).toBeVisible(); // restored, not lost and not invented
  expect(await page.evaluate(() => window.__gallery.getState().polling)).toBe(true); // resumed
  await expect(c.getByText("Ready", { exact: true })).toBeVisible({ timeout: 10000 });
  expect(await page.evaluate(() => window.__gallery.getState().polling)).toBe(false); // terminal: stops
  await expect(page.getByRole("button", { name: "Download GLB" })).toBeVisible();
  const [d] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download GLB" }).click()]);
  expect(sha(readFileSync(await d.path()))).toBe(sha(readFileSync(GLB)));
});

test("F06-E1 error vs empty: a failed request looks and reads differently from an empty gallery", async ({ page }) => {
  await go(page, "empty");
  const empty = page.locator('[data-panel="empty"]');
  await expect(empty).not.toHaveAttribute("role", "alert");
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
  const emptyStyle = await empty.evaluate((n) => [getComputedStyle(n).borderTopStyle, getComputedStyle(n).backgroundColor]);
  await go(page, "server_5xx");
  const err = page.getByRole("alert").filter({ hasText: "couldn't be loaded" });
  await expect(err).toContainText("This doesn't mean you have none.");
  await expect(err.getByRole("button", { name: "Try again" })).toBeVisible();
  const errStyle = await err.evaluate((n) => [getComputedStyle(n).borderTopStyle, getComputedStyle(n).backgroundColor]);
  expect(errStyle).not.toEqual(emptyStyle);
});

test("F06-E2 list failure: one request, nothing automatic; Try again sends exactly one more", async ({ page }) => {
  await go(page, "server_5xx");
  const n = () => page.evaluate(() => window.__calls().filter((m) => m === "listJobs").length);
  await page.waitForTimeout(2000);
  expect(await n()).toBe(1);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect.poll(n).toBe(2);
});

test("F07-E1 polling: a 429 status check pauses polling with a visible 'Check status again'", async ({ page }) => {
  await go(page, "poll_paused");
  await expect(page.locator("[data-poll-paused]")).toContainText("paused because FurniAI is busy", { timeout: 8000 });
  const n = () => page.evaluate(() => window.__calls().filter((m) => m === "getJob").length);
  const before = await n();
  await page.waitForTimeout(4000);
  expect(await n()).toBe(before);
  await page.getByRole("button", { name: "Check status again" }).click();
  await expect.poll(n).toBe(before + 1);
});

test("F08-H1 budget / availability from GET ?resource=config: unavailable says why; the list still shows", async ({ page }) => {
  await go(page, "unavailable");
  await expect(page.locator('[data-availability="off"]')).toHaveText(/no per-concept budget is set/);
  await expect(cards(page)).toHaveCount(2);
  await go(page, "list");
  await expect(page.locator('[data-availability="ready"]')).toHaveText(/Budget limit per concept: 20 provider units \(unit unverified\)/);
});

test("F09-H1 concept vs design: every card has a visible Concept label and the notice; no dimensions or Studio links", async ({ page }) => {
  await go(page, "list");
  const all = cards(page);
  const n = await all.count();
  for (let i = 0; i < n; i++) {
    await expect(all.nth(i).locator('[data-kind-label="concept"]')).toHaveText("Concept");
    await expect(all.nth(i).locator('[data-kind-label="concept"]')).toBeVisible();
    await expect(all.nth(i).locator("[data-concept-notice]")).toContainText("AI-generated visual concept");
    expect(await all.nth(i).innerText()).not.toMatch(/\bmm\b|width|height|depth/i);
  }
  await expect(page.locator("[data-concept-gallery] a")).toHaveCount(0);
});

test("F10-H1 reference thumbnails: the reference image where the host has one, a placeholder otherwise", async ({ page }) => {
  await go(page, "thumbnails");
  await expect(page.getByRole("img", { name: "Reference image this concept was made from" })).toHaveCount(2);
  await expect(page.locator('[data-thumbnail="none"]')).toHaveCount(1);
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

test("QE INT-403: a 403 on Open closes the real viewer panel; ONE permission alert; no sign-in wording", async ({ page }) => {
  // Counts every write of permission text into a live region (role=alert/status or aria-live).
  // The gallery must write it once; the viewer's own alert (v3.1 announces one) leaves with the viewer.
  await page.addInitScript(() => {
    window.__liveWrites = { gallery: 0, viewer: 0 };
    const live = (n) => n && n.nodeType === 1 && (/^(alert|status)$/.test(n.getAttribute("role") || "") || n.hasAttribute("aria-live"));
    const liveOf = (n) => {
      for (let p = n; p; p = p.parentNode) if (live(p)) return p;
      return null;
    };
    new MutationObserver((recs) => {
      for (const r of recs) {
        const nodes = r.type === "characterData" ? [r.target] : [...r.addedNodes];
        for (const n of nodes) {
          const region = liveOf(n.nodeType === 1 ? n : n.parentNode);
          if (!region || !/permission/i.test(n.textContent || "")) continue;
          const inViewer = region.closest && (region.closest("[data-viewer-panel]") || region.closest("[data-asset-viewer]"));
          if (inViewer) window.__liveWrites.viewer++;
          else window.__liveWrites.gallery++;
        }
      }
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  await go(page, "open_forbidden");
  await expect(page.locator('[data-panel="forbidden"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator("[data-viewer-panel]")).toHaveCount(0);
  await expect(page.locator("[data-asset-viewer]")).toHaveCount(0);
  const alerts = page.locator('[role="alert"]').filter({ hasText: /permission/ });
  await expect(alerts).toHaveCount(1);
  await expect(page.locator('[role="status"]').filter({ hasText: /permission/ })).toHaveCount(0);
  await page.waitForTimeout(300); // let any late channel (event / statechange / onError) fire
  const writes = await page.evaluate(() => window.__liveWrites);
  expect(writes.gallery).toBe(1);
  await expect(alerts).toHaveCount(1);
  await expect(page.locator(".fcg")).not.toContainText(/sign(ing)?[\s-]*in/i);
  await expect(page.locator('[data-panel="forbidden"] [data-action="retry"]')).toHaveCount(0);
  expect(await axe(page)).toEqual([]);
});

test("QE download name: a cross-origin address is saved under the FurniAI name, never the provider's", async ({ page }) => {
  await go(page, "download_cross_origin");
  const ready = cards(page).first();
  const [d] = await Promise.all([page.waitForEvent("download"), ready.getByRole("button", { name: "Download GLB" }).click()]);
  expect(d.suggestedFilename()).toMatch(/^furniai-concept-[A-Za-z0-9_-]+-0\.glb$/);
  expect(d.suggestedFilename()).not.toMatch(/asset_out|SYNTHETIC-box/);
  expect(sha(readFileSync(await d.path()))).toBe(sha(readFileSync(GLB)));
});

test("QE tap targets: every gallery control is at least 44 x 44 px; no horizontal overflow", async ({ page }) => {
  for (const state of ["list", "asset_rate_limited", "poll_paused", "signed_out_sign_in_hook", "network", "open"]) {
    await go(page, state);
    if (state.startsWith("asset_")) await page.locator("[data-asset-error]").waitFor();
    if (state === "poll_paused") await page.locator("[data-poll-paused]").waitFor({ timeout: 8000 });
    if (state === "open") await page.locator('[data-action="close-viewer"]').waitFor({ timeout: 15000 });
    const sizes = await page.locator("[data-concept-gallery] button:visible").evaluateAll((bs) => bs.map((b) => [b.textContent, Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height)]));
    expect(sizes.length, state).toBeGreaterThan(0);
    expect(sizes.filter(([, w, h]) => w < 44 || h < 44), state).toEqual([]);
    expect(await noOverflow(page), state).toBe(0);
  }
});

test("QE sign-in: a Sign in button only on the 401 panel and only with a host hook; never on 403", async ({ page }) => {
  await go(page, "signed_out_sign_in_hook");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("#log")).toContainText("sign-in hook was called");
  await go(page, "signed_out");
  await expect(page.getByRole("button", { name: "Sign in" })).toHaveCount(0);
  await go(page, "forbidden");
  await expect(page.getByRole("button", { name: /sign/i })).toHaveCount(0);
});

for (const state of ["open_forbidden", "signed_out_sign_in_hook", "list", "empty", "billing", "failed", "submission_unknown", "signed_out", "forbidden", "rate_limited", "provider_unavailable", "not_configured", "asset_unavailable", "asset_rate_limited", "poll_paused", "unavailable", "thumbnails", "long"]) {
  test(`A11Y axe (serious/critical) and no horizontal overflow: ${state}`, async ({ page }) => {
    await go(page, state);
    if (state.startsWith("asset_")) await page.locator("[data-asset-error]").waitFor();
    if (state === "poll_paused") await page.locator("[data-poll-paused]").waitFor({ timeout: 8000 });
    if (state === "thumbnails") await page.locator("img").first().waitFor();
    if (state === "open_forbidden") await page.locator('[data-panel="forbidden"]').waitFor({ timeout: 10000 });
    expect(await axe(page)).toEqual([]);
    expect(await noOverflow(page)).toBe(0);
  });
}
