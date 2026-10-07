import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const ARTIFACTS_DIR = path.join(process.cwd(), "docs", "artifacts", "customer-workflow");
const BRAIN_DIR = "C:/Users/xalim/.gemini/antigravity/brain/aa668b8a-afc9-445c-922a-5e668174f73a";

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
try {
  fs.mkdirSync(BRAIN_DIR, { recursive: true });
} catch (_) {}

async function captureScreenshot(page, filename) {
  const target = path.join(ARTIFACTS_DIR, filename);
  await page.screenshot({ path: target, fullPage: false });
  try {
    fs.copyFileSync(target, path.join(BRAIN_DIR, filename));
  } catch (_) {}
}

test.describe("Customer Workflow End-to-End: Description → Draft → Edit → Undo → Save → Reopen → Drawings & Cut List", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
  });

  test("Complete 7-Step Workflow: Verified Mathematical and Dimensional Identity", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Mock durable persistence backend adhering to Claude's /api/designs contract
    let persistedDesignId = "design_wf_777";
    const serverRevisions = new Map();

    await page.route("**/api/designs", async (route) => {
      if (route.request().method() === "POST") {
        const body = JSON.parse(route.request().postData() || "{}");
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            designId: persistedDesignId,
            name: body.name || "Customer Wardrobe",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            latestRevision: null,
          }),
        });
      }
      return route.fulfill({ status: 200, body: JSON.stringify({ ok: true, designs: [] }) });
    });

    await page.route("**/api/designs/**/revisions", async (route) => {
      if (route.request().method() === "POST") {
        const body = JSON.parse(route.request().postData() || "{}");
        const revNum = body.revision;
        serverRevisions.set(revNum, body);
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            designId: persistedDesignId,
            revision: revNum,
            fingerprint: body.fingerprint,
            validationStatus: "ACCEPTED",
            createdAt: new Date().toISOString(),
          }),
        });
      }
    });

    await page.route("**/api/designs/**/revisions/*", async (route) => {
      const url = route.request().url();
      const revNum = Number(url.split("/").pop());
      const stored = serverRevisions.get(revNum);
      if (!stored) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, code: "MISSING_DESIGN", error: "Revision not found" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          designId: persistedDesignId,
          revision: revNum,
          fingerprint: stored.fingerprint,
          furniSpec: stored.furniSpec,
          partGraph: stored.partGraph,
          origins: stored.origins,
          validationStatus: "ACCEPTED",
          createdAt: new Date().toISOString(),
        }),
      });
    });

    // -------------------------------------------------------------
    // STEP 1: Description
    // -------------------------------------------------------------
    await page.goto("/#/build/ai-wardrobe");
    await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.ready);

    const inputArea = page.locator("#aiWardrobeInput");
    await expect(inputArea).toBeVisible();
    await inputArea.fill("Wardrobe 1800mm wide, 2400mm high, 600mm deep, oak finish");
    await captureScreenshot(page, "01-step-description-entered.png");
    await page.locator("#aiWardrobeSubmitBtn").click();

    // -------------------------------------------------------------
    // STEP 2: Validated Draft
    // -------------------------------------------------------------
    await expect(page.locator("#aiWardrobeReviewSection")).toBeVisible();
    await expect(page.locator("#revWidth")).toHaveText("1800 mm");
    await expect(page.locator("#revHeight")).toHaveText("2400 mm");
    await expect(page.locator("#revDepth")).toHaveText("600 mm");
    await expect(page.locator("#revFinish")).toBeVisible();
    await expect(page.locator("#revRevision")).toHaveText("1");
    await expect(page.locator("#aiSaveStatusText")).toContainText("Draft (unsaved)");

    // Verify 3D canvas and parts
    const draft3dState = await page.evaluate(() => {
      const pg = getActivePartGraph();
      const top = pg?.parts?.find((p) => (p.id || p.partId) === "CARC_TOP");
      return {
        partCount: pg?.parts?.length || 0,
        topLengthMm: top ? (top.finished?.lengthDmm ?? top.lengthDmm) / 10 : null,
      };
    });
    expect(draft3dState.partCount).toBe(19);
    expect(draft3dState.topLengthMm).toBe(1800);
    await captureScreenshot(page, "02-step-validated-draft.png");

    // -------------------------------------------------------------
    // STEP 3: Live AI-Assisted Edit
    // -------------------------------------------------------------
    const convInput = page.locator("#aiConversationalInput");
    await convInput.fill("Make it 2000 mm wide.");
    await page.locator("#aiConversationalSendBtn").click();

    // Verify revision 2
    await expect(page.locator("#revRevision")).toHaveText("2");
    await expect(page.locator("#revWidth")).toHaveText("2000 mm");

    const edit3dState = await page.evaluate(() => {
      const pg = getActivePartGraph();
      const top = pg?.parts?.find((p) => (p.id || p.partId) === "CARC_TOP");
      return {
        partCount: pg?.parts?.length || 0,
        topLengthMm: top ? (top.finished?.lengthDmm ?? top.lengthDmm) / 10 : null,
      };
    });
    expect(edit3dState.topLengthMm).toBe(2000);
    await captureScreenshot(page, "03-step-ai-assisted-edit.png");

    // -------------------------------------------------------------
    // STEP 4: Undo
    // -------------------------------------------------------------
    await page.locator("#btnUndoEdit").click();
    await expect(page.locator("#revRevision")).toHaveText("1");
    await expect(page.locator("#revWidth")).toHaveText("1800 mm");
    await expect(page.locator("#aiSaveStatusText")).toContainText("Unsaved changes (Undo)");

    const undo3dState = await page.evaluate(() => {
      const pg = getActivePartGraph();
      const top = pg?.parts?.find((p) => (p.id || p.partId) === "CARC_TOP");
      return {
        partCount: pg?.parts?.length || 0,
        topLengthMm: top ? (top.finished?.lengthDmm ?? top.lengthDmm) / 10 : null,
      };
    });
    expect(undo3dState.topLengthMm).toBe(1800);
    await captureScreenshot(page, "04-step-undo-restored.png");

    // -------------------------------------------------------------
    // STEP 5: Save
    // -------------------------------------------------------------
    const saveResult = await page.evaluate(async () => {
      return await window.persistAcceptedRevision({
        token: "mock-valid-supabase-token",
        quiet: false,
      });
    });
    expect(saveResult).not.toBeNull();
    expect(saveResult.revision).toBe(1);
    await expect(page.locator("#aiSaveStatusText")).toContainText("Saved (Rev 1)");
    const unsavedCheck = await page.evaluate(() => window.hasUnsavedStudioChanges());
    expect(unsavedCheck).toBe(false);
    await captureScreenshot(page, "05-step-saved-durably.png");

    // -------------------------------------------------------------
    // STEP 6: Reload / Reopen
    // -------------------------------------------------------------
    const preSessionId = await page.evaluate(() => window.getActiveStudioSessionId());
    const reopened = await page.evaluate(async () => {
      return await window.reopenDesignFromApi("design_wf_777", 1, "mock-valid-supabase-token");
    });
    expect(reopened.sessionId).not.toBe(preSessionId); // Fresh session identity
    expect(reopened.editSequence).toBe(0); // Sequence reset
    expect(reopened.undoStack.length).toBe(0); // Clean cross-session undo boundary
    await expect(page.locator("#revRevision")).toHaveText("1");
    await expect(page.locator("#revWidth")).toHaveText("1800 mm");
    await expect(page.locator("#revFinish")).toBeVisible();
    await expect(page.locator("#aiSaveStatusText")).toContainText("Saved (Rev 1)");
    await captureScreenshot(page, "06-step-reopened-fresh-session.png");

    // -------------------------------------------------------------
    // STEP 7: Matching Drawings & Cut List (Identity Assertion)
    // -------------------------------------------------------------
    const exportIdentity = await page.evaluate(() => {
      const pg = getActivePartGraph();
      if (!pg || !globalThis.PartGraphBridge) return null;

      // 1. Generate Drawings SVG
      const svg = globalThis.PartGraphBridge.generateShopDrawingsSVG(pg);

      // 2. Generate Cut List CSV
      const csv = globalThis.PartGraphBridge.generateCutListCsv(pg);

      // 3. Inspect top panel
      const topPanel = pg.parts.find((p) => (p.id || p.partId) === "CARC_TOP");

      return {
        partCount: pg.parts.length,
        envelopeWidthMm: pg.summary?.envelope?.widthDmm / 10,
        envelopeHeightMm: pg.summary?.envelope?.heightDmm / 10,
        envelopeDepthMm: pg.summary?.envelope?.depthDmm / 10,
        topFinishedLengthMm: (topPanel?.finished?.lengthDmm ?? topPanel?.lengthDmm) / 10,
        svgHasWidthAnnotation: svg.includes("1800") || svg.includes("1800.0"),
        svgHasSpecId: svg.includes(pg.sourceSpecId || "furnispec"),
        csvHasCarcTop: csv.includes("CARC_TOP") && (csv.includes("1800.0") || csv.includes("1800")),
        csvRowCount: csv.trim().split("\n").length,
      };
    });

    expect(exportIdentity).not.toBeNull();
    // Mathematical identity between saved, reopened, 3D, and exports:
    expect(exportIdentity.partCount).toBe(19);
    expect(exportIdentity.envelopeWidthMm).toBe(1800);
    expect(exportIdentity.envelopeHeightMm).toBe(2400);
    expect(exportIdentity.envelopeDepthMm).toBe(600);
    expect(exportIdentity.topFinishedLengthMm).toBe(1800);
    expect(exportIdentity.svgHasWidthAnnotation).toBe(true);
    expect(exportIdentity.csvHasCarcTop).toBe(true);
    expect(exportIdentity.csvRowCount).toBeGreaterThanOrEqual(20); // Header + 19 parts

    await captureScreenshot(page, "07-step-matching-drawings-cutlist.png");
  });
});
