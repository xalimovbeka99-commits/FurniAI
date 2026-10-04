/**
 * Antigravity's REAL product page (index.html, served unmodified by
 * scripts/static-server.js on a unique port) — the "Create from a reference"
 * panel. LOCAL: every non-local request is aborted; /api/creative is
 * intercepted and answered 503 so a real call would be visible, never billed.
 *
 * KNOWN_DEFECT (Antigravity UI, high): the panel is a client-side mock. It
 * never calls /api/creative; it shows canned stock images badged "Scenario
 * Visual Reference", prints W×H×D cm dimensions, and offers "Build to my sizes
 * with this style", which loads the concept into the builder. Contract §1:
 * concepts carry no dimensions and never load into the builder; an output may
 * only be presented as a Scenario result if it came from /api/creative.
 * `test.fail` = these assertions state the CONTRACT and currently fail; the
 * CURRENT_BEHAVIOUR test pins what the page does today.
 */
import { test, expect } from "@playwright/test";

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);
let creativeCalls;
let blocked;

test.beforeEach(async ({ context, baseURL }) => {
  creativeCalls = [];
  blocked = [];
  const local = new URL(baseURL).host;
  await context.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.startsWith("/api/creative")) {
      creativeCalls.push(`${route.request().method()} ${u.pathname}${u.search}`);
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "TEST_STUB", error: "local stub" }) });
    }
    if (u.host === local) return route.continue();
    blocked.push(u.href);
    return route.abort();
  });
});

async function openPanelAndGenerate(page) {
  await page.goto("/#/build/ai-wardrobe");
  await page.locator("#btnModeRef").click();
  await expect(page.locator("#referenceCreationPanel")).toBeVisible();
  await page.setInputFiles("#refImageInput", { name: "wardrobe.png", mimeType: "image/png", buffer: PNG });
  await page.fill("#refPromptInput", "glass wardrobe");
  await page.click("#btnGenerateConcepts");
  // the mock renders after a fixed 600 ms timer
  await expect(page.locator("#refConceptsStream .concept-card").first()).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(500);
}

test("CURRENT_BEHAVIOUR: Generate Visual Concepts makes ZERO /api/creative calls and renders canned cards with cm dimensions and a builder hand-off", async ({ page }) => {
  await openPanelAndGenerate(page);
  expect(creativeCalls).toEqual([]);
  const cards = page.locator("#refConceptsStream .concept-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.first().locator(".concept-badge")).toContainText("Scenario Visual Reference");
  await expect(cards.first().locator(".concept-meta")).toContainText(/\d+×\d+×\d+ cm/);
  await expect(cards.first().getByRole("button", { name: /Build to my sizes with this style/ })).toBeVisible();
  const srcs = await cards.locator("img.concept-img").evaluateAll((els) => els.map((e) => e.getAttribute("src")));
  expect(srcs.every((s) => s.startsWith("images/"))).toBe(true); // bundled stock images, not provider output
  // the page's own Google Fonts stylesheet is aborted (no egress) but is not a creative call
  expect(blocked.filter((u) => !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u))).toEqual([]);
});

test.fail("KNOWN_DEFECT contract §1/§2: the reference panel submits through /api/creative (upload + jobs)", async ({ page }) => {
  await openPanelAndGenerate(page);
  expect(creativeCalls.some((c) => c.startsWith("POST /api/creative"))).toBe(true);
});

test.fail("KNOWN_DEFECT contract §1: a concept shows no real-world dimensions", async ({ page }) => {
  await openPanelAndGenerate(page);
  await expect(page.locator("#refConceptsStream")).not.toContainText(/\d+\s*(×|x)\s*\d+.*cm/);
});

test.fail("KNOWN_DEFECT contract §1: a concept cannot be loaded into the builder", async ({ page }) => {
  await openPanelAndGenerate(page);
  await expect(page.locator("#refConceptsStream").getByRole("button", { name: /Build to my sizes/ })).toHaveCount(0);
});

test.fail("KNOWN_DEFECT: nothing is labelled a Scenario output unless it came from /api/creative", async ({ page }) => {
  await openPanelAndGenerate(page);
  const labelled = await page.locator("#refConceptsStream").getByText(/Scenario/).count();
  expect(labelled > 0 ? creativeCalls.length : 1).toBeGreaterThan(0);
});
