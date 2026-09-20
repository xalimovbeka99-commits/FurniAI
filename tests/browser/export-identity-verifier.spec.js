import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const OUT_DIR = path.join(process.cwd(), "docs", "artifacts", "design-with-ai");
const BRAIN_DIR = "C:/Users/xalim/.gemini/antigravity/brain/2923d744-82b4-4a9b-96bd-89fc98f2c0d1";

fs.mkdirSync(OUT_DIR, { recursive: true });
try {
  fs.mkdirSync(BRAIN_DIR, { recursive: true });
} catch (_) {}

async function saveScreenshot(page, filename) {
  const target = path.join(OUT_DIR, filename);
  await page.screenshot({ path: target, fullPage: false });
  try {
    fs.copyFileSync(target, path.join(BRAIN_DIR, filename));
  } catch (_) {}
}

async function getViewerAndExportIdentity(page) {
  return page.evaluate(() => {
    const num = (txt) => {
      const m = String(txt || "").match(/(\d+(?:\.\d+)?)/);
      return m ? Number(m[1]) : null;
    };

    const state = window.aiWardrobeState || {};
    const viewerWidth = num(document.getElementById("revWidth")?.textContent);
    const viewerHeight = num(document.getElementById("revHeight")?.textContent);
    const viewerRevision = num(document.getElementById("revRevision")?.textContent);
    const viewerSpecId = document.getElementById("revProposalId")?.textContent?.trim();

    const pg = getActivePartGraph();
    const env = pg?.summary?.envelope;
    const topPanel = pg?.parts?.find((p) => (p.id || p.partId) === "CARC_TOP");
    const exportTopLengthMm = topPanel
      ? (topPanel.finished?.lengthDmm ?? topPanel.lengthDmm) / 10
      : null;

    const cutList = globalThis.PartGraphBridge?.compileNestingManifest
      ? globalThis.PartGraphBridge.compileNestingManifest(pg)
      : null;

    return {
      viewerWidth,
      viewerHeight,
      viewerRevision,
      viewerSpecId,
      exportEnvelopeWidthMm: env?.widthDmm ? env.widthDmm / 10 : null,
      exportEnvelopeHeightMm: env?.heightDmm ? env.heightDmm / 10 : null,
      exportTopLengthMm,
      exportPartCount: pg?.parts?.length || 0,
      exportSourceSpecId: pg?.sourceSpecId,
      sheetCount: cutList?.sheetCount,
      isAiDesignActive: Boolean(state.partGraph),
    };
  });
}

test.describe("Verifier Suite: Manufacturing Export ↔ Viewer PartGraph Identity", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/#/build/ai-wardrobe");
    await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.ready);
  });

  test("1. Original 2000 mm viewer/export mismatch reproduction fix: non-golden AI draft feeds manufacturing export", async ({
    page,
  }) => {
    // Control check before AI draft: fallback is golden
    const controlState = await getViewerAndExportIdentity(page);
    expect(controlState.isAiDesignActive).toBe(false);
    expect(controlState.exportEnvelopeWidthMm).toBe(1800); // Golden fallback

    // Non-golden AI draft: 2000 mm wide
    const inputArea = page.locator("#aiWardrobeInput");
    await inputArea.fill("Wardrobe 2000mm wide, 2400mm high, 600mm deep, oak finish");
    await inputArea.press("Enter");

    await expect(page.locator("#aiWardrobeReviewSection")).toBeVisible({ timeout: 15000 });
    await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.parts?.[0]);

    const afterDraft = await getViewerAndExportIdentity(page);

    // Assert: Viewer and Export are completely identical (2000 mm, NOT 1800 mm golden fallback!)
    expect(afterDraft.viewerWidth).toBe(2000);
    expect(afterDraft.exportEnvelopeWidthMm).toBe(2000);
    expect(afterDraft.exportTopLengthMm).toBe(2000);
    expect(afterDraft.viewerRevision).toBe(1);

    await saveScreenshot(page, "verifier-01-2000mm-draft-export-identity.png");
  });

  test("2. Edit → export consistency: editing width updates both viewer and manufacturing export", async ({
    page,
  }) => {
    const inputArea = page.locator("#aiWardrobeInput");
    await inputArea.fill("Wardrobe 2000mm wide, 2400mm high, 600mm deep, oak finish");
    await inputArea.press("Enter");
    await expect(page.locator("#aiWardrobeReviewSection")).toBeVisible({ timeout: 15000 });

    // Apply edit: height 2100 mm
    const convInput = page.locator("#aiConversationalInput");
    const sendBtn = page.locator("#aiConversationalSendBtn");
    await convInput.fill("Change height to 2100 mm");
    await sendBtn.click();

    await page.waitForFunction(() => {
      const el = document.getElementById("revRevision");
      const h = document.getElementById("revHeight");
      return el && el.textContent === "2" && h && h.textContent.includes("2100");
    }, null, { timeout: 15000 });

    const afterEdit = await getViewerAndExportIdentity(page);
    expect(afterEdit.viewerRevision).toBe(2);
    expect(afterEdit.viewerHeight).toBe(2100);
    expect(afterEdit.exportEnvelopeHeightMm).toBe(2100);
    expect(afterEdit.exportEnvelopeWidthMm).toBe(2000);
    expect(afterEdit.exportTopLengthMm).toBe(2000);

    await saveScreenshot(page, "verifier-02-edit-export-identity.png");
  });

  test("3. Undo → export consistency: Undo restores export source to the restored PartGraph and revision", async ({
    page,
  }) => {
    const inputArea = page.locator("#aiWardrobeInput");
    await inputArea.fill("Wardrobe 2000mm wide, 2400mm high, 600mm deep, oak finish");
    await inputArea.press("Enter");
    await expect(page.locator("#aiWardrobeReviewSection")).toBeVisible({ timeout: 15000 });

    const convInput = page.locator("#aiConversationalInput");
    const sendBtn = page.locator("#aiConversationalSendBtn");
    await convInput.fill("Change height to 2100 mm");
    await sendBtn.click();
    await page.waitForFunction(() => {
      const el = document.getElementById("revRevision");
      return el && el.textContent === "2";
    });

    // Press Undo
    const undoBtn = page.locator("#btnUndoEdit");
    await undoBtn.click();

    await page.waitForFunction(() => {
      const el = document.getElementById("revRevision");
      const h = document.getElementById("revHeight");
      return el && el.textContent === "1" && h && h.textContent.includes("2400");
    }, null, { timeout: 15000 });

    const afterUndo = await getViewerAndExportIdentity(page);
    expect(afterUndo.viewerRevision).toBe(1);
    expect(afterUndo.viewerHeight).toBe(2400);
    expect(afterUndo.exportEnvelopeHeightMm).toBe(2400);
    expect(afterUndo.exportEnvelopeWidthMm).toBe(2000);

    await saveScreenshot(page, "verifier-03-undo-export-identity.png");
  });

  test("4. Rejected request → unchanged export: rejected proposal leaves export PartGraph untouched", async ({
    page,
  }) => {
    const inputArea = page.locator("#aiWardrobeInput");
    await inputArea.fill("Wardrobe 2000mm wide, 2400mm high, 600mm deep, oak finish");
    await inputArea.press("Enter");
    await expect(page.locator("#aiWardrobeReviewSection")).toBeVisible({ timeout: 15000 });

    const beforeReject = await getViewerAndExportIdentity(page);

    // Request unsupported sliding mirror doors
    const convInput = page.locator("#aiConversationalInput");
    const sendBtn = page.locator("#aiConversationalSendBtn");
    await convInput.fill("Add sliding mirror doors");
    await sendBtn.click();

    await page.waitForFunction(
      () => {
        const stream = document.getElementById("aiConversationalStream");
        return stream && stream.textContent.includes("Sorry");
      },
      null,
      { timeout: 15000 }
    );

    const afterReject = await getViewerAndExportIdentity(page);
    expect(afterReject.viewerRevision).toBe(beforeReject.viewerRevision);
    expect(afterReject.viewerWidth).toBe(beforeReject.viewerWidth);
    expect(afterReject.exportEnvelopeWidthMm).toBe(beforeReject.exportEnvelopeWidthMm);
    expect(afterReject.exportEnvelopeHeightMm).toBe(beforeReject.exportEnvelopeHeightMm);
    expect(afterReject.exportTopLengthMm).toBe(beforeReject.exportTopLengthMm);

    await saveScreenshot(page, "verifier-04-rejected-export-unchanged.png");
  });
});
