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

async function getSummaryState(page) {
  return page.evaluate(() => {
    const num = (txt) => {
      const m = String(txt || "").match(/(\d+(?:\.\d+)?)/);
      return m ? Number(m[1]) : null;
    };
    return {
      revision: num(document.getElementById("revRevision")?.textContent),
      widthMm: num(document.getElementById("revWidth")?.textContent),
      heightMm: num(document.getElementById("revHeight")?.textContent),
      depthMm: num(document.getElementById("revDepth")?.textContent),
      finish: document.getElementById("revFinish")?.textContent?.trim(),
      bays: num(document.getElementById("revBays")?.textContent),
      doors: num(document.getElementById("revDoors")?.textContent),
      fingerprint: document.getElementById("revFingerprint")?.textContent?.trim(),
      widthOrigin: document.getElementById("revWidthOrigin")?.textContent?.trim(),
      heightOrigin: document.getElementById("revHeightOrigin")?.textContent?.trim(),
      finishOrigin: document.getElementById("revFinishOrigin")?.textContent?.trim(),
      partsCount: typeof Builder !== "undefined" && Builder.parts ? Builder.parts.length : 0,
      has3dMesh: typeof Builder !== "undefined" && Boolean(Builder.parts?.[0]),
    };
  });
}

test.describe("Design with AI — Comprehensive Customer Journey & Live Readiness", () => {
  test("full customer journey: description → draft → AI-assisted edit → finish change → Undo → rejected request → successful next edit (desktop & 390px mobile)", async ({
    page,
  }) => {
    test.setTimeout(120000);

    // -------------------------------------------------------------
    // STEP 1: Entry Point & Inactive Control Omission
    // -------------------------------------------------------------
    await page.goto("/");
    const navBtn = page.locator("#createWithFurniAiHeroBtn, #createWithFurniAiNavBtn").first();
    await expect(navBtn).toBeVisible();
    await navBtn.click();
    await expect(page).toHaveURL(/#\/build\/ai-wardrobe/);
    await expect(page.locator("#view-builder")).toBeVisible();
    await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.ready);

    // Verify Requirement 7: Inactive upload control is omitted
    await expect(page.locator("#aiAttachDocBtn")).toHaveCount(0);
    await expect(page.locator("#aiDocFileInput")).toHaveCount(0);

    // -------------------------------------------------------------
    // STEP 2: Initial Description via Keyboard (Enter key) → Immediate Draft with Labelled Defaults
    // -------------------------------------------------------------
    const inputArea = page.locator("#aiWardrobeInput");
    await expect(inputArea).toBeVisible();
    await inputArea.fill("A 4-door wardrobe, 1800mm wide, 2400mm high, 600mm deep, with a 100mm plinth, 2 equal bays, oak finish, and shelves");

    // Submit via Enter key (keyboard accessibility check)
    await inputArea.press("Enter");

    // Review section becomes visible immediately
    await expect(page.locator("#aiWardrobeReviewSection")).toBeVisible({ timeout: 15000 });
    await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.parts?.[0]);

    const draftState = await getSummaryState(page);
    expect(draftState.has3dMesh).toBe(true);
    expect(draftState.revision).toBe(1);
    expect(draftState.widthMm).toBe(1800);
    expect(draftState.heightMm).toBe(2400);
    expect(draftState.depthMm).toBe(600);
    expect(draftState.bays).toBe(2);
    expect(draftState.doors).toBe(4);

    // Check labelled defaults:
    // Width and height were stated by customer in prompt
    expect(draftState.widthOrigin).toContain("Customer Stated");
    expect(draftState.heightOrigin).toContain("Customer Stated");
    // Finish is defaulted to Bekzod-approved Golden standard
    expect(draftState.finishOrigin).toContain("Defaulted");

    // Stream shows user message and initial assistant message with source tag
    const streamLocator = page.locator("#aiConversationalStream");
    await expect(streamLocator).toBeVisible();
    await expect(streamLocator.locator(".ai-msg.user").first()).toContainText("A 4-door wardrobe");
    const firstAssistant = streamLocator.locator(".ai-msg.assistant[data-role='assistant']").first();
    await expect(firstAssistant).toBeVisible();
    await expect(firstAssistant).toContainText("Here is your draft wardrobe (Revision 1)");
    await expect(firstAssistant).toContainText("[Rules]");

    await saveScreenshot(page, "01-initial-draft-labelled-defaults.png");

    // -------------------------------------------------------------
    // STEP 3: Delayed In-flight Response Protection (changeToken guard)
    // -------------------------------------------------------------
    // Verify that transport discards an in-flight response when user has already made an edit or pressed Undo
    const isStaleProtected = await page.evaluate(async () => {
      if (!globalThis.AiDesignerTransport) return false;
      const state = window.aiWardrobeState;
      const initialSeq = state.editSequence;
      let liveSeq = initialSeq;

      // Simulate an in-flight proposal call that resolves after token bump
      const mockFetch = async () => {
        // bump sequence before response arrives to simulate intervening edit
        liveSeq += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            edits: [{ key: "envelope.widthMm", value: 2400 }],
            reply: "Delayed 2400mm reply",
            provider: "anthropic",
          }),
        };
      };

      const result = await globalThis.AiDesignerTransport.proposeDesignChange({
        message: "Could you open it up a bit more across the front, please?",
        currentObservations: state.observations,
        specId: state.specId,
        revision: state.revision,
        changeToken: initialSeq,
        currentDesignId: () => state.specId,
        currentChangeToken: () => liveSeq,
        fetchImpl: mockFetch,
      });

      return result.kind === "STALE_REVISION" && result.ok === false;
    });
    expect(isStaleProtected).toBe(true);

    // -------------------------------------------------------------
    // STEP 4: AI-Assisted Edit with Visible Result & Source Distinction
    // -------------------------------------------------------------
    const convInput = page.locator("#aiConversationalInput");
    const sendBtn = page.locator("#aiConversationalSendBtn");
    await convInput.fill("Make it 2000 mm wide.");
    await sendBtn.click();

    await page.waitForFunction(() => {
      const el = document.getElementById("revRevision");
      const w = document.getElementById("revWidth");
      return el && el.textContent === "2" && w && w.textContent.includes("2000");
    }, null, { timeout: 15000 });

    const editState = await getSummaryState(page);
    expect(editState.revision).toBe(2);
    expect(editState.widthMm).toBe(2000);
    // Unrelated dimensions preserved:
    expect(editState.heightMm).toBe(draftState.heightMm);
    expect(editState.depthMm).toBe(draftState.depthMm);
    expect(editState.bays).toBe(draftState.bays);
    expect(editState.doors).toBe(draftState.doors);

    // Check that source tag is present in latest assistant bubble
    const latestAssistant = streamLocator.locator(".ai-msg.assistant[data-role='assistant']").last();
    await expect(latestAssistant).toContainText("Revision 2");
    await expect(latestAssistant).toContainText("[Rules]");

    await saveScreenshot(page, "02-conversational-edit-visible-change.png");

    // -------------------------------------------------------------
    // STEP 5: Finish Change (Material Swatch Update)
    // -------------------------------------------------------------
    await convInput.fill("Change finish to walnut.");
    await convInput.press("Enter");

    await page.waitForFunction(() => {
      const el = document.getElementById("revRevision");
      const f = document.getElementById("revFinish");
      return el && el.textContent === "3" && f && f.textContent.toLowerCase().includes("walnut");
    }, null, { timeout: 15000 });

    const finishState = await getSummaryState(page);
    expect(finishState.revision).toBe(3);
    expect(finishState.finish.toLowerCase()).toContain("walnut");
    // Geometry unchanged:
    expect(finishState.widthMm).toBe(2000);
    expect(finishState.heightMm).toBe(draftState.heightMm);

    await saveScreenshot(page, "03-finish-swatch-change.png");

    // -------------------------------------------------------------
    // STEP 6: Accessible Undo Restoring Previous Revision
    // -------------------------------------------------------------
    const undoBtn = page.locator("#btnUndoEdit");
    await expect(undoBtn).toBeVisible();
    await undoBtn.click();

    await page.waitForFunction(() => {
      const el = document.getElementById("revRevision");
      const f = document.getElementById("revFinish");
      return el && el.textContent === "2" && f && !f.textContent.toLowerCase().includes("walnut");
    }, null, { timeout: 15000 });

    const undoState = await getSummaryState(page);
    expect(undoState.revision).toBe(2);
    expect(undoState.widthMm).toBe(2000);
    expect(undoState.finish.toLowerCase()).toBe(draftState.finish.toLowerCase());

    await saveScreenshot(page, "04-undo-restored-state.png");

    // -------------------------------------------------------------
    // STEP 7: Rejected Request Leaving Current Design Intact
    // -------------------------------------------------------------
    const assistCountBefore = await streamLocator.locator(".ai-msg.assistant[data-role='assistant']").count();
    await convInput.fill("Add sliding mirror doors");
    await sendBtn.click();

    await page.waitForFunction(
      (n) => document.querySelectorAll("#aiConversationalStream .ai-msg.assistant[data-role='assistant']").length > n,
      assistCountBefore,
      { timeout: 15000 }
    );
    await expect(sendBtn).toBeEnabled();

    const rejectedAssistant = streamLocator.locator(".ai-msg.assistant[data-role='assistant']").last();
    const rejectText = await rejectedAssistant.textContent();
    expect(rejectText).toMatch(/mirror|sliding|manufacturing slice|supported|deferred|unchanged/i);

    // Design is completely preserved:
    const postRejectState = await getSummaryState(page);
    expect(postRejectState.revision).toBe(2);
    expect(postRejectState.widthMm).toBe(2000);
    expect(postRejectState.heightMm).toBe(draftState.heightMm);
    expect(postRejectState.finish.toLowerCase()).toBe(draftState.finish.toLowerCase());

    await saveScreenshot(page, "05-rejected-request-design-preserved.png");

    // -------------------------------------------------------------
    // STEP 8: Successful Next Edit after Rejected Request
    // -------------------------------------------------------------
    await convInput.fill("Change height to 2100 mm");
    await sendBtn.click();

    await page.waitForFunction(() => {
      const el = document.getElementById("revRevision");
      const h = document.getElementById("revHeight");
      return el && el.textContent === "3" && h && h.textContent.includes("2100");
    }, null, { timeout: 15000 });

    const nextState = await getSummaryState(page);
    expect(nextState.revision).toBe(3);
    expect(nextState.heightMm).toBe(2100);
    expect(nextState.widthMm).toBe(2000);

    await saveScreenshot(page, "06-subsequent-valid-edit.png");

    // -------------------------------------------------------------
    // STEP 9: 390px Mobile Viewport Verification
    // -------------------------------------------------------------
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);

    // Check 3D canvas is visible
    const canvas = page.locator("#bld3d");
    await expect(canvas).toBeVisible();

    // Check conversational input and send button are accessible and not clipped
    await expect(convInput).toBeVisible();
    await expect(sendBtn).toBeVisible();
    const inputBounds = await convInput.boundingBox();
    expect(inputBounds.width).toBeGreaterThan(150);

    // Check no horizontal overflow on mobile body
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(390);

    await saveScreenshot(page, "07-mobile-390px-layout.png");

    // -------------------------------------------------------------
    // STEP 10: Clearly Distinguish Mock from Anthropic Results
    // -------------------------------------------------------------
    // Verify that mocked responses produce '[✦ Mock]' badge and live Anthropic responses produce '[✦ Anthropic]' badge
    await page.evaluate(() => {
      const msgMock = appendAiStreamMsg("assistant", "Mocked layout response", {
        source: "MODEL",
        provider: "anthropic",
        isMock: true,
      });
      const msgLive = appendAiStreamMsg("assistant", "Live Anthropic response", {
        source: "MODEL",
        provider: "anthropic",
        isMock: false,
      });
      msgMock.id = "test-mock-msg";
      msgLive.id = "test-live-msg";
    });

    const mockBadge = page.locator("#test-mock-msg .ai-source-badge");
    const liveBadge = page.locator("#test-live-msg .ai-source-badge");
    await expect(mockBadge).toHaveText("[✦ Mock]");
    await expect(liveBadge).toHaveText("[✦ Anthropic]");

    await saveScreenshot(page, "08-mock-vs-anthropic-badges.png");
  });
});
