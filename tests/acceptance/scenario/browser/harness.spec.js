/**
 * Scenario 3D — browser layer against a TEST HARNESS (not the product UI).
 * SIMULATED / LOCAL: the page drives the REAL /api/creative handlers (served
 * by harness/server.mjs) with a local provider stand-in; the asset CDN is
 * MOCKED (https://cdn.fixture.invalid → local, via context.route so popups
 * are covered too). Every other outbound request is aborted and the test
 * fails if one is attempted.
 * VIEW LEG: the Asset Engineer's REAL viewer v2 (src/lib/assetViewer, 7eaa414,
 * unmodified) with its own /api/creative resolver (createCreativeAssetSource).
 * The `?viewer=harness` bare-GLTFLoader fallback is kept and covered below.
 * Runs at desktop (1280) and 390 px (see playwright.scenario.config.js).
 */
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { inspectGlb } from "../support/glbInspector.js";

const REFERENCE_PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);

async function fixture(request, path, body) {
  const r = body === undefined ? await request.get(path) : await request.post(path, { data: body });
  expect(r.ok()).toBeTruthy();
  return r.json();
}
const state = (request) => fixture(request, "/__fixture/state");

let blocked;
test.beforeEach(async ({ context, baseURL }) => {
  blocked = [];
  const local = new URL(baseURL).host;
  await context.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.host === local) return route.continue();
    if (u.origin === "https://cdn.fixture.invalid") {
      const response = await route.fetch({ url: `${baseURL}/__cdn${u.pathname}${u.search}` });
      return route.fulfill({ response });
    }
    blocked.push(u.href);
    return route.abort();
  });
});
test.afterEach(async ({ page }, info) => {
  expect(blocked, "no request may leave the machine").toEqual([]);
  if (info.project.name === "mobile-390") {
    const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
    expect(overflow, "no horizontal overflow at 390 px").toBeLessThanOrEqual(0);
  }
});

async function start(page, request, overrides = {}, query = "") {
  await fixture(request, "/__fixture/reset", overrides);
  await page.goto(`/?poll=300${query}`);
  await expect(page.getByTestId("harness-banner")).toContainText("TEST HARNESS");
  await page.setInputFiles("#reference", { name: "wardrobe.png", mimeType: "image/png", buffer: REFERENCE_PNG });
  await page.click("#upload");
  await expect(page.locator("body")).toHaveAttribute("data-reference", "ready");
}
const body = (page) => page.locator("body");


test("happy path: upload → generate → poll → view (REAL viewer v2 via its /api/creative resolver) → download → inspect the FILE → reopen with a fresh address", async ({ page, request }) => {
  await start(page, request);
  await page.click("#generate");
  await expect(body(page)).toHaveAttribute("data-status", "succeeded");
  await expect(page.getByTestId("concept-notice")).toContainText("AI-generated visual concept");
  await expect(body(page)).toHaveAttribute("data-view", "ok");
  await expect(body(page)).toHaveAttribute("data-viewer-status", "ready");
  await expect(body(page)).toHaveAttribute("data-meshes", "1");
  await expect(body(page)).toHaveAttribute("data-textures", "1");
  await expect(body(page)).toHaveAttribute("data-view-resolves", "1");
  await expect(body(page)).toHaveAttribute("data-proportions", "W:H:D 1.00 : 1.00 : 1.00");
  // contract §1: a concept never loads into the builder
  await expect(body(page)).toHaveAttribute("data-viewer-open-in-builder", "false");
  // the viewer shows the concept notice in its own overlay, and no real-world size
  await expect(page.getByTestId("viewer")).toContainText(/AI-generated|concept/i);
  await expect(page.getByTestId("viewer")).not.toContainText(/\d+\s?(cm|mm|m)\b/);

  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#download")]);
  expect(download.suggestedFilename()).toMatch(/^furniai-concept-[0-9a-f]{8}\.glb$/);
  await expect(body(page)).toHaveAttribute("data-download-content-type", "model/gltf-binary");
  const bytes = readFileSync(await download.path());
  const ins = inspectGlb(bytes);
  expect(ins.errors).toEqual([]);
  expect(ins.info).toMatchObject({ meshCount: 1, positionCount: 24, bbox: { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] } });

  const s1 = await state(request);
  expect(s1.provider.calls.generate).toBe(1);
  expect(s1.api.asset).toBe(2); // viewer load + download, each resolved fresh
  // every provider lookup issued a distinct URL (+1 lookup during the status refresh, for the format)
  expect(s1.provider.calls.asset).toBe(s1.api.asset + 1);
  expect(new Set(s1.provider.issuedUrls).size).toBe(s1.provider.calls.asset);

  // reopen: a reload knows nothing but the job list; the viewer resolves again
  await page.goto("/?poll=300&reopen=1");
  await expect(body(page)).toHaveAttribute("data-view", "ok");
  const s2 = await state(request);
  expect(s2.api.asset).toBe(3);
  expect(s2.provider.calls.generate).toBe(1);
  expect(new Set(s2.provider.issuedUrls).size).toBe(s2.provider.calls.asset);
  expect(s2.provider.calls.asset).toBe(4);
});

test("viewer v2 download({save:true}) re-resolves a FRESH address and the navigated FILE passes inspection", async ({ page, request, context }) => {
  await start(page, request);
  await page.click("#generate");
  await expect(body(page)).toHaveAttribute("data-view", "ok");
  const before = await state(request);
  const popupP = context.waitForEvent("page");
  const dlP = context.waitForEvent("download", { timeout: 15000 }).catch(() => null);
  await page.click("#download-viewer");
  await expect(body(page)).toHaveAttribute("data-viewer-download", "ok");
  const after = await state(request);
  expect(after.api.asset - before.api.asset).toBe(1); // fresh resolve, not the in-memory URL
  const lastUrl = after.provider.issuedUrls.at(-1);
  expect(before.provider.issuedUrls).not.toContain(lastUrl);
  const popup = await popupP;
  const download = (await dlP) || (await popup.waitForEvent("download", { timeout: 15000 }));
  // Cross-origin: the `download` attribute is ignored, so the CDN path names the file (documented in viewer §12.7).
  expect(download.suggestedFilename()).toMatch(/\.glb$/);
  const ins = inspectGlb(readFileSync(await download.path()));
  expect(ins.errors).toEqual([]);
  expect(ins.info.meshCount).toBe(1);
});

test("duplicate rapid clicks (dblclick + triple click) → exactly ONE provider job", async ({ page, request }) => {
  await start(page, request, { pollsUntilDone: 3 });
  await page.dblclick("#generate");
  await page.click("#generate", { clickCount: 3 });
  await expect(page.getByTestId("info")).toContainText("already being generated");
  await expect(body(page)).toHaveAttribute("data-status", "succeeded", { timeout: 15000 });
  const s = await state(request);
  expect(await page.evaluate(() => window.__harness.generateClicks)).toBeGreaterThanOrEqual(4);
  expect(s.api.jobsPost).toBeGreaterThanOrEqual(4);
  expect(s.provider.calls.generate).toBe(1);
  expect(s.jobs).toHaveLength(1);
});

test("failed generation: the provider's failure is shown (harness + viewer GENERATION_FAILED), polling stops, nothing is retried", async ({ page, request }) => {
  await start(page, request, { outcome: "failure" });
  await page.click("#generate");
  await expect(body(page)).toHaveAttribute("data-status", "failed");
  await expect(page.getByTestId("error")).toContainText("simulated generation failure");
  await expect(body(page)).toHaveAttribute("data-viewer-error", "GENERATION_FAILED");
  const before = await state(request);
  await page.waitForTimeout(2000);
  const after = await state(request);
  expect(after.provider.calls.generate).toBe(1);
  expect(after.api.jobsGet).toBe(before.api.jobsGet);
  expect(after.provider.calls.job).toBe(before.provider.calls.job);
  expect(after.api.asset).toBe(0);
  await expect(page.locator("#download")).toBeDisabled();
});

test("submission_unknown: warning says it may have been charged; viewer SUBMISSION_UNKNOWN; no auto-retry, no polling", async ({ page, request }) => {
  await start(page, request, { generateMode: "http500" });
  await page.click("#generate");
  await expect(body(page)).toHaveAttribute("data-status", "submission_unknown");
  await expect(page.getByTestId("warning")).toContainText("may have been charged");
  await expect(page.getByTestId("warning")).toContainText("NOT retried");
  await expect(body(page)).toHaveAttribute("data-viewer-error", "SUBMISSION_UNKNOWN");
  await page.waitForTimeout(2000);
  const s = await state(request);
  expect(s.provider.calls.generate).toBe(1);
  expect(s.api.jobsPost).toBe(1);
  expect(s.api.jobsGet).toBe(0);
  expect(s.api.asset).toBe(0);
  expect(s.jobs.map((j) => j.status)).toEqual(["submission_unknown"]);
});

test("expired/removed asset: 410 ASSET_UNAVAILABLE is shown by viewer + download and NOT re-called", async ({ page, request }) => {
  await start(page, request);
  await page.click("#generate");
  await expect(body(page)).toHaveAttribute("data-view", "ok");
  const before = await state(request);
  await fixture(request, "/__fixture/set", { assetMode: "gone404" });
  await page.click("#view");
  await expect(body(page)).toHaveAttribute("data-view", "refused-410");
  await expect(body(page)).toHaveAttribute("data-viewer-error", "ASSET_UNAVAILABLE");
  await expect(page.getByTestId("asset-error")).toContainText("no longer available");
  await page.click("#download");
  await expect(body(page)).toHaveAttribute("data-download", "failed-ASSET_UNAVAILABLE");
  const after = await state(request);
  expect(after.api.asset - before.api.asset).toBe(2); // one per action, no re-call
});

test("an expired signed URL: the viewer re-resolves exactly once and then loads", async ({ page, request }) => {
  await start(page, request, { cdnFailNext: 1 });
  await page.click("#generate");
  await expect(body(page)).toHaveAttribute("data-view", "ok");
  await expect(body(page)).toHaveAttribute("data-view-resolves", "2");
  expect((await state(request)).api.asset).toBe(2);
});

test("a CDN that keeps refusing the address: viewer fails with ASSET_DISPLAY_FAILED after exactly ONE re-call (no retry storm)", async ({ page, request }) => {
  // NOTE: a missing-CORS host (contract U7) cannot be simulated through
  // route.fulfill — Playwright adds Access-Control-Allow-Origin to fulfilled
  // responses. U7 stays unverified; this covers the failure path.
  await start(page, request, { cdnFailNext: 1000 });
  await page.click("#generate");
  await expect(body(page)).toHaveAttribute("data-view", "failed");
  await expect(body(page)).toHaveAttribute("data-viewer-error", "ASSET_DISPLAY_FAILED");
  await expect(body(page)).toHaveAttribute("data-view-resolves", "2");
  await expect(page.getByTestId("asset-error")).toContainText("could not be loaded");
  await page.waitForTimeout(1000);
  expect((await state(request)).api.asset).toBe(2);
});

test("HTML served as .glb: the API says format 'glb' (URL only); the viewer sniffs, re-resolves once, refuses; the downloaded FILE fails inspection", async ({ page, request }) => {
  await start(page, request, { cdnVariant: "html" });
  await page.click("#generate");
  await expect(body(page)).toHaveAttribute("data-view", "failed");
  await expect(body(page)).toHaveAttribute("data-viewer-error", "ASSET_DISPLAY_FAILED");
  await expect(body(page)).toHaveAttribute("data-view-resolves", "2");
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#download")]);
  expect(download.suggestedFilename()).toMatch(/\.glb$/); // format "glb" comes from the URL only
  const ins = inspectGlb(readFileSync(await download.path()));
  expect(ins.ok).toBe(false);
  expect(ins.errors).toContain("LOOKS_LIKE_HTML");
});

test.describe("fallback view leg (?viewer=harness, bare GLTFLoader)", () => {
  test("happy path loads and re-resolves on an expired URL", async ({ page, request }) => {
    await start(page, request, { cdnFailNext: 1 }, "&viewer=harness");
    await page.click("#generate");
    await expect(body(page)).toHaveAttribute("data-view", "ok");
    await expect(body(page)).toHaveAttribute("data-bbox", "1.000,1.000,1.000");
    await expect(body(page)).toHaveAttribute("data-view-attempts", "2");
    expect((await state(request)).api.asset).toBe(2);
  });
});

test.fixme("Antigravity's real upload + Generate UI wired to /api/creative — BLOCKED: the only reference panel (index.html generateReferenceConcepts) is a client-side mock (see antigravity-reference-panel.spec.js)", async () => {
  // Expected once delivered: re-run every test above against the product page
  // instead of the harness (same fixture server, same counts).
});

test.fixme("viewer v2 / Projects gallery attached to a product page — BLOCKED: viewer v2 (7eaa414) and the concept gallery (34f80a7) are not attached to any page at 485f8a6", async () => {
  // Expected once attached: the product page mounts mountAssetViewer with
  // createCreativeAssetSource and passes the same view-leg tests above.
});
