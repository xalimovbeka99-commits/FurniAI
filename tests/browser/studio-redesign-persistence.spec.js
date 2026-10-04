import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const ARTIFACTS_DIR = path.join(process.cwd(), "docs", "artifacts", "studio-redesign-delivery");
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

test.describe("Studio Redesign & Persistence Verification", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
  });

  test("Desktop Studio Layout — prominent 3D canvas, one conversational input, grouped specs, drawings & save status", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/#/build/ai-wardrobe");
    await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.ready);

    // Initial draft input
    const inputArea = page.locator("#aiWardrobeInput");
    await expect(inputArea).toBeVisible();
    await inputArea.fill("Wardrobe 1800mm wide, 2400mm high, 600mm deep, oak finish");
    await page.locator("#aiWardrobeSubmitBtn").click();

    // Review section emerges
    const reviewSection = page.locator("#aiWardrobeReviewSection");
    await expect(reviewSection).toBeVisible();

    // Verify 3D canvas is present and active
    const canvas = page.locator("#bld3d");
    await expect(canvas).toBeVisible();

    // Verify duplicate chat widgets are hidden
    await expect(page.locator(".ai-fab")).toBeHidden();
    await expect(page.locator(".ai-drawer")).toBeHidden();
    await expect(page.locator("#createWithFurniAiBldBtn")).toBeHidden();
    await expect(page.locator("#bPrev")).toBeHidden();
    await expect(page.locator("#bNext")).toBeHidden();

    // Verify specification table grouping headers
    const groupHeaders = page.locator("#aiReviewSummaryTable .table-group-header");
    await expect(groupHeaders).toHaveCount(3);
    await expect(groupHeaders.nth(0)).toContainText("Dimensions & Envelope");
    await expect(groupHeaders.nth(1)).toContainText("Layout & Finish");
    await expect(groupHeaders.nth(2)).toContainText("Technical Diagnostics");

    // Verify customer vs defaulted origin tags
    await expect(page.locator("#revWidthOrigin")).toBeVisible();
    await expect(page.locator("#revHeightOrigin")).toBeVisible();
    await expect(page.locator("#revDepthOrigin")).toBeVisible();

    // Verify conversational refinement controls
    const convInput = page.locator("#aiConversationalInput");
    await expect(convInput).toBeVisible();
    const sendBtn = page.locator("#aiConversationalSendBtn");
    await expect(sendBtn).toBeVisible();

    // Verify Undo and Approve buttons
    const undoBtn = page.locator("#btnUndoEdit");
    await expect(undoBtn).toBeVisible();
    const approveBtn = page.locator("#btnApproveGenerate3D");
    await expect(approveBtn).toBeVisible();

    // Verify Save status badge and reopen action
    const saveBadge = page.locator("#aiSaveStatusBadge");
    await expect(saveBadge).toBeVisible();
    const reopenBtn = page.locator("#bReopenApi");
    await expect(reopenBtn).toBeVisible();

    // Verify Manufacturing & Blueprints dropdown
    const mfgBtn = page.locator("#btnMfgDropdown");
    await expect(mfgBtn).toBeVisible();
    await mfgBtn.click();
    await expect(page.locator("#btnExportShopDrawings")).toContainText("Shop Blueprints (SVG)");
    await expect(page.locator("#btnExportShopDrawingsPdf")).toContainText("Print drawings");

    // Capture desktop evidence screenshot
    await captureScreenshot(page, "desktop-studio-redesign-verified.png");
  });

  test("Mobile 390px Viewport — accessible controls, contextual tabs & keyboard-reduced viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#/build/ai-wardrobe");
    await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.ready);

    // Initial draft input on mobile
    const inputArea = page.locator("#aiWardrobeInput");
    await expect(inputArea).toBeVisible();
    await inputArea.fill("Wardrobe 1800mm wide, 2400mm high, 600mm deep, oak finish");
    await page.locator("#aiWardrobeSubmitBtn").click();

    await expect(page.locator("#aiWardrobeReviewSection")).toBeVisible();

    // Mobile tabs
    const tabLeft = page.locator("#tab-left");
    const tabRight = page.locator("#tab-right");
    await expect(tabLeft).toBeVisible();
    await expect(tabRight).toBeVisible();
    await expect(tabLeft).toHaveText("Design & AI");

    // Capture mobile 390px default screenshot
    await captureScreenshot(page, "mobile-390px-studio-verified.png");

    // Simulate virtual keyboard reduction (viewport height reduces to 480px)
    await page.setViewportSize({ width: 390, height: 480 });
    const convInput = page.locator("#aiConversationalInput");
    await expect(convInput).toBeVisible();
    await convInput.click();

    // Capture mobile keyboard-reduced screenshot
    await captureScreenshot(page, "mobile-390px-keyboard-reduced-verified.png");
  });

  test("Save Status Lifecycle, Unsaved Protection & Mocked API Persistence", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Mock /api/designs endpoints to verify authenticated persistence protocol
    let storedDesignId = "design_test_101";
    let storedRevision = 0;
    const revisionsDb = [];

    await page.route("**/api/designs", async (route) => {
      if (route.request().method() === "POST") {
        const body = JSON.parse(route.request().postData() || "{}");
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            designId: storedDesignId,
            name: body.name || "Test Wardrobe",
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
        storedRevision = body.revision;
        revisionsDb.push(body);
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            designId: storedDesignId,
            revision: storedRevision,
            fingerprint: body.fingerprint,
            validationStatus: "ACCEPTED",
            createdAt: new Date().toISOString(),
          }),
        });
      }
    });

    await page.route("**/api/designs/**/revisions/*", async (route) => {
      const rev = revisionsDb[revisionsDb.length - 1];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          designId: storedDesignId,
          revision: storedRevision,
          fingerprint: rev?.fingerprint,
          furniSpec: rev?.furniSpec,
          partGraph: rev?.partGraph,
          origins: rev?.origins,
          validationStatus: "ACCEPTED",
        }),
      });
    });

    await page.goto("/#/build/ai-wardrobe");
    await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.ready);

    // Initial unauthenticated draft
    const inputArea = page.locator("#aiWardrobeInput");
    await inputArea.fill("Wardrobe 1800mm wide, 2400mm high, 600mm deep, oak finish");
    await page.locator("#aiWardrobeSubmitBtn").click();

    await expect(page.locator("#aiWardrobeReviewSection")).toBeVisible();

    // Verify initial save badge state: unsaved draft
    const saveBadgeText = page.locator("#aiSaveStatusText");
    await expect(saveBadgeText).toContainText("Draft (unsaved)");

    // Check unsaved-change protection flag
    const hasUnsaved = await page.evaluate(() => window.hasUnsavedStudioChanges());
    expect(hasUnsaved).toBe(true);

    // Provide mock authenticated token and invoke persistAcceptedRevision
    const saveResult = await page.evaluate(async () => {
      return await window.persistAcceptedRevision({
        token: "mock-valid-supabase-token",
        quiet: false,
      });
    });
    expect(saveResult).not.toBeNull();
    expect(saveResult.revision).toBe(1);

    // Verify save status transitions to Saved (Rev 1)
    await expect(saveBadgeText).toContainText("Saved (Rev 1)");
    const hasUnsavedAfterSave = await page.evaluate(() => window.hasUnsavedStudioChanges());
    expect(hasUnsavedAfterSave).toBe(false);

    // Perform an edit: "Make it 2000 mm wide."
    const convInput = page.locator("#aiConversationalInput");
    await convInput.fill("Make it 2000 mm wide.");
    await page.locator("#aiConversationalSendBtn").click();

    // Revision advances in memory
    await expect(page.locator("#revRevision")).toHaveText("2");

    // Trigger persistence with token for revision 2
    const saveResult2 = await page.evaluate(async () => {
      return await window.persistAcceptedRevision({
        token: "mock-valid-supabase-token",
        quiet: false,
      });
    });
    expect(saveResult2.revision).toBe(2);
    await expect(saveBadgeText).toContainText("Saved (Rev 2)");

    // Test Undo action: restores state to revision 1 and sets status to unsaved
    await page.locator("#btnUndoEdit").click();
    await expect(page.locator("#revRevision")).toHaveText("1");
    await expect(saveBadgeText).toContainText("Unsaved changes (Undo)");

    // Reopen design via API helper: verify session id rotates and server revision is restored
    const priorSessionId = await page.evaluate(() => window.getActiveStudioSessionId());
    const reopened = await page.evaluate(async () => {
      return await window.reopenDesignFromApi("design_test_101", 1, "mock-valid-supabase-token");
    });
    expect(reopened.sessionId).not.toBe(priorSessionId);
    await expect(saveBadgeText).toContainText("Saved (Rev 1)");

    await captureScreenshot(page, "persistence-lifecycle-verified.png");
  });
});
