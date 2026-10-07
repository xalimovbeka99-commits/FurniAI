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

async function getSummaryAndGeometryState(page) {
  return page.evaluate(() => {
    const num = (txt) => {
      const m = String(txt || "").match(/(\d+(?:\.\d+)?)/);
      return m ? Number(m[1]) : null;
    };

    const state = window.aiWardrobeState || {};
    const partGraph = state.partGraph;
    const carcTop = partGraph?.parts?.find((p) => (p.id || p.partId) === "CARC_TOP");
    const carcTopLengthMm = carcTop
      ? (carcTop.finished?.lengthDmm ?? carcTop.lengthDmm) / 10
      : null;
    const envelopeWidthMm = partGraph?.summary?.envelope?.widthDmm
      ? partGraph.summary.envelope.widthDmm / 10
      : null;

    let threeMeshTopWidthMm = null;
    if (typeof Builder !== "undefined" && Builder.parts && Builder.parts[0]) {
      Builder.parts[0].traverse((child) => {
        if (
          (child.name === "part_CARC_TOP" || child.userData?.partId === "CARC_TOP") &&
          child.geometry?.parameters?.width
        ) {
          threeMeshTopWidthMm = Math.round(child.geometry.parameters.width * 1000);
        }
      });
    }

    return {
      specId: state.specId,
      revision: num(document.getElementById("revRevision")?.textContent),
      editSequence: state.editSequence,
      widthMm: num(document.getElementById("revWidth")?.textContent),
      heightMm: num(document.getElementById("revHeight")?.textContent),
      depthMm: num(document.getElementById("revDepth")?.textContent),
      finish: document.getElementById("revFinish")?.textContent?.trim(),
      finishType: state.spec?.finishType,
      bays: num(document.getElementById("revBays")?.textContent),
      doors: num(document.getElementById("revDoors")?.textContent),
      partGraphPartsCount: partGraph?.parts?.length || 0,
      carcTopLengthMm,
      envelopeWidthMm,
      threeMeshTopWidthMm,
      has3dMesh: typeof Builder !== "undefined" && Boolean(Builder.parts?.[0]),
    };
  });
}

test.describe("Design with AI — Real State Protection & Geometry Invariants", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/#/build/ai-wardrobe");
    await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.ready);

    // Enter initial description to produce baseline draft
    const inputArea = page.locator("#aiWardrobeInput");
    await inputArea.fill("Wardrobe 1800mm wide, 2400mm high, 600mm deep, oak finish");
    await inputArea.press("Enter");

    await expect(page.locator("#aiWardrobeReviewSection")).toBeVisible({ timeout: 15000 });
    await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.parts?.[0]);
  });

  test("1. Two requests completing in reverse order: earlier slow request is rejected as stale; actual 3D geometry preserves newer request", async ({
    page,
  }) => {
    const initialState = await getSummaryAndGeometryState(page);
    expect(initialState.widthMm).toBe(1800);
    expect(initialState.carcTopLengthMm).toBe(1800);
    expect(initialState.threeMeshTopWidthMm).toBe(1800);

    // We simulate two concurrent proposal requests arriving from network:
    // Request A was dispatched first at token 1 with 2200mm width, but takes 400ms.
    // Request B was dispatched second at token 2 with 2000mm width, and resolves in 50ms.
    const result = await page.evaluate(async () => {
      const state = window.aiWardrobeState;
      const initialSeq = state.editSequence;
      const specId = state.specId;

      // Dispatch Request B: quick edit
      await runAiWardrobeConversationalEdit("Make it 2000 mm wide.");

      // Now Request A (slow network reply sent at token 1 for 2200mm) finally arrives:
      const slowRequestToken = initialSeq;
      const delayedProposalResult = await globalThis.AiDesignerTransport.proposeDesignChange({
        message: "Could you stretch it to 2200 mm horizontally across the wall, please?",
        currentObservations: state.observations,
        specId,
        revision: 1,
        changeToken: slowRequestToken,
        currentDesignId: () => state.specId,
        currentChangeToken: () => state.editSequence,
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            edits: [{ key: "envelope.widthMm", value: 2200 }],
            reply: "Delayed reply for 2200 mm",
            provider: "anthropic",
          }),
        }),
      });

      return {
        requestAKind: delayedProposalResult.kind,
        requestAOk: delayedProposalResult.ok,
      };
    });

    expect(result.requestAKind).toBe("STALE_REVISION");
    expect(result.requestAOk).toBe(false);

    // VERIFY ACTUAL 3D GEOMETRY AND STATE:
    // Must strictly be 2000mm from Request B, NOT overwritten by 2200mm!
    const finalState = await getSummaryAndGeometryState(page);
    expect(finalState.revision).toBe(2);
    expect(finalState.widthMm).toBe(2000);
    expect(finalState.envelopeWidthMm).toBe(2000);
    expect(finalState.carcTopLengthMm).toBe(2000);
    expect(finalState.threeMeshTopWidthMm).toBe(2000);

    await saveScreenshot(page, "state-prot-01-reverse-order-resolved.png");
  });

  test("2. Editing during an in-flight request: intervening edit advances token; delayed response discarded; actual 3D geometry and finish preserved", async ({
    page,
  }) => {
    // First edit to 2000mm
    const convInput = page.locator("#aiConversationalInput");
    const sendBtn = page.locator("#aiConversationalSendBtn");
    await convInput.fill("Make it 2000 mm wide.");
    await sendBtn.click();
    await page.waitForFunction(() => {
      const el = document.getElementById("revRevision");
      return el && el.textContent === "2";
    });

    const stateBeforeInFlight = await getSummaryAndGeometryState(page);
    expect(stateBeforeInFlight.widthMm).toBe(2000);
    expect(stateBeforeInFlight.threeMeshTopWidthMm).toBe(2000);

    // Simulate in-flight request while customer simultaneously changes finish to walnut:
    const result = await page.evaluate(async () => {
      const state = window.aiWardrobeState;
      const requestToken = state.editSequence;
      const specId = state.specId;

      // Start in-flight promise for 2400mm
      const inFlightPromise = globalThis.AiDesignerTransport.proposeDesignChange({
        message: "Could you stretch it to 2400 mm please?",
        currentObservations: state.observations,
        specId,
        revision: state.revision,
        changeToken: requestToken,
        currentDesignId: () => state.specId,
        currentChangeToken: () => state.editSequence,
        fetchImpl: async () => {
          // Simulate latency
          await new Promise((r) => setTimeout(r, 50));
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              edits: [{ key: "envelope.widthMm", value: 2400 }],
              reply: "Stretched to 2400mm",
            }),
          };
        },
      });

      // Customer makes an immediate finish change while request is in flight
      const chip = document.getElementById("chipFinishWalnut");
      if (chip) chip.click();
      else {
        await runAiWardrobeConversationalEdit("Change finish to walnut.");
      }

      const delayedRes = await inFlightPromise;
      return {
        delayedResKind: delayedRes.kind,
        delayedResOk: delayedRes.ok,
      };
    });

    expect(result.delayedResKind).toBe("STALE_REVISION");
    expect(result.delayedResOk).toBe(false);

    // VERIFY ACTUAL 3D GEOMETRY AND STATE:
    // Finish must be Walnut, width must remain 2000mm (NOT 2400mm)
    const finalState = await getSummaryAndGeometryState(page);
    expect(finalState.revision).toBe(3);
    expect(finalState.finish.toLowerCase()).toContain("walnut");
    expect(finalState.widthMm).toBe(2000);
    expect(finalState.carcTopLengthMm).toBe(2000);
    expect(finalState.threeMeshTopWidthMm).toBe(2000);

    await saveScreenshot(page, "state-prot-02-edit-during-in-flight.png");
  });

  test("3. Undo during an in-flight request: token advances while revision rewinds; delayed response discarded; actual 3D geometry restored", async ({
    page,
  }) => {
    // Edit to 2000mm (Revision 2)
    const convInput = page.locator("#aiConversationalInput");
    const sendBtn = page.locator("#aiConversationalSendBtn");
    await convInput.fill("Make it 2000 mm wide.");
    await sendBtn.click();
    await page.waitForFunction(() => {
      const el = document.getElementById("revRevision");
      return el && el.textContent === "2";
    });

    const stateAtRev2 = await getSummaryAndGeometryState(page);
    expect(stateAtRev2.revision).toBe(2);
    expect(stateAtRev2.widthMm).toBe(2000);
    expect(stateAtRev2.threeMeshTopWidthMm).toBe(2000);

    // While at Revision 2, customer triggers a network request for height 2100mm,
    // and simultaneously clicks Undo!
    const result = await page.evaluate(async () => {
      const state = window.aiWardrobeState;
      const requestToken = state.editSequence;
      const specId = state.specId;

      const inFlightPromise = globalThis.AiDesignerTransport.proposeDesignChange({
        message: "Could you trim down the overall proportions for our ceiling clearance, please?",
        currentObservations: state.observations,
        specId,
        revision: state.revision,
        changeToken: requestToken,
        currentDesignId: () => state.specId,
        currentChangeToken: () => state.editSequence,
        fetchImpl: async () => {
          await new Promise((r) => setTimeout(r, 60));
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              edits: [{ key: "envelope.heightMm", value: 2100 }],
              reply: "Height lowered to 2100 mm",
            }),
          };
        },
      });

      // Customer presses Undo while network call is in flight
      undoLastAiWardrobeEdit();

      const delayedRes = await inFlightPromise;
      return {
        delayedResKind: delayedRes.kind,
        delayedResOk: delayedRes.ok,
      };
    });

    expect(result.delayedResKind).toBe("STALE_REVISION");
    expect(result.delayedResOk).toBe(false);

    // VERIFY ACTUAL 3D GEOMETRY AND STATE:
    // Must be restored to Revision 1: 1800mm width, 2400mm height
    const finalState = await getSummaryAndGeometryState(page);
    expect(finalState.revision).toBe(1);
    expect(finalState.widthMm).toBe(1800);
    expect(finalState.heightMm).toBe(2400);
    expect(finalState.carcTopLengthMm).toBe(1800);
    expect(finalState.threeMeshTopWidthMm).toBe(1800);

    await saveScreenshot(page, "state-prot-03-undo-during-in-flight.png");
  });

  test("4. Switching / resetting designs during an in-flight request: specId changes; delayed response rejected; clean reset preserved", async ({
    page,
  }) => {
    const initialState = await getSummaryAndGeometryState(page);
    const initialSpecId = initialState.specId;

    const result = await page.evaluate(async (oldSpecId) => {
      const state = window.aiWardrobeState;
      const requestToken = state.editSequence;

      const inFlightPromise = globalThis.AiDesignerTransport.proposeDesignChange({
        message: "Could you widen this unit to 2200 mm please?",
        currentObservations: state.observations,
        specId: oldSpecId,
        revision: state.revision,
        changeToken: requestToken,
        currentDesignId: () => window.aiWardrobeState.specId,
        currentChangeToken: () => window.aiWardrobeState.editSequence,
        fetchImpl: async () => {
          await new Promise((r) => setTimeout(r, 60));
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              edits: [{ key: "envelope.widthMm", value: 2200 }],
              reply: "Widen to 2200mm",
            }),
          };
        },
      });

      // Customer clicks Start Over / New Wardrobe
      initAiWardrobePanel(true);

      const delayedRes = await inFlightPromise;
      return {
        delayedResKind: delayedRes.kind,
        delayedResOk: delayedRes.ok,
        newSpecId: window.aiWardrobeState.specId,
      };
    }, initialSpecId);

    expect(result.delayedResKind).toBe("STALE_REVISION");
    expect(result.delayedResOk).toBe(false);
    expect(result.newSpecId).not.toBe(initialSpecId);

    // Verify UI is cleanly reset to input stage and review section is hidden
    await expect(page.locator("#aiWardrobeInputSection")).toBeVisible();
    await expect(page.locator("#aiWardrobeReviewSection")).toBeHidden();

    // Verify 3D scene was cleared — zero ghost geometry
    const finalHasMesh = await page.evaluate(
      () => typeof Builder !== "undefined" && Boolean(Builder.parts?.[0])
    );
    expect(finalHasMesh).toBe(false);

    await saveScreenshot(page, "state-prot-04-design-reset-preserved.png");
  });

  test("5. Reopening the same design on the same page during an in-flight request: session ID rotates; matching token from new session does not cross over; delayed response rejected with STALE_REVISION; canvas state unchanged", async ({
    page,
  }) => {
    // 1. Establish initial design state (1800mm wide)
    const initialState = await getSummaryAndGeometryState(page);
    expect(initialState.widthMm).toBe(1800);
    expect(initialState.threeMeshTopWidthMm).toBe(1800);

    const result = await page.evaluate(async () => {
      const state = window.aiWardrobeState;
      const initialSessionId = window.getActiveStudioSessionId();
      const initialToken = state.editSequence;
      const specId = state.specId;
      const revision = state.revision;

      // Save a snapshot of the design to simulate reopening the exact same design
      const savedDesignClone = {
        text: state.text,
        answers: { ...state.answers },
        specId: state.specId,
        spec: JSON.parse(JSON.stringify(state.spec)),
        revision: state.revision,
        currentStage: state.currentStage,
        proposal: { ...state.proposal },
        approval: state.approval,
        partGraph: state.partGraph,
        observations: [...state.observations],
        origins: { ...state.origins },
      };

      // 2. Start a slow in-flight AI request in Session A (asking for 2400 mm)
      const inFlightPromise = globalThis.AiDesignerTransport.proposeDesignChange({
        message: "Could you stretch this wardrobe to 2400 mm please?",
        currentObservations: state.observations,
        specId,
        revision,
        changeToken: initialToken,
        currentDesignId: () => window.aiWardrobeState.specId,
        currentChangeToken: () => window.aiWardrobeState.editSequence,
        sessionId: initialSessionId,
        currentSessionId: () => window.getActiveStudioSessionId(),
        fetchImpl: async () => {
          // Simulate network latency
          await new Promise((r) => setTimeout(r, 60));
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              edits: [{ key: "envelope.widthMm", value: 2400 }],
              reply: "Stretched to 2400 mm",
            }),
          };
        },
      });

      // 3. Without reloading, customer reopens the same saved design on the same page
      // Reopening rotates the session to Session B and restarts token to 0
      window.reopenAiWardrobeDesign(savedDesignClone);
      const sessionBId = window.getActiveStudioSessionId();

      // 4. In Session B, customer makes a valid conversational edit to 2000 mm
      // Token advances, matching the numeric range of the previous session
      await window.runAiWardrobeConversationalEdit("Make it 2000 mm wide.");

      // 5. Delayed AI answer from Session A now arrives
      const delayedRes = await inFlightPromise;

      return {
        initialSessionId,
        sessionBId,
        sessionsDiffer: initialSessionId !== sessionBId,
        delayedResKind: delayedRes.kind,
        delayedResOk: delayedRes.ok,
        guardParameter: delayedRes.guardParameter,
        error: delayedRes.error,
        sessionIdAtRequest: delayedRes.sessionIdAtRequest,
        currentSessionIdDecided: delayedRes.currentSessionId,
      };
    });

    // Verify session rotated
    expect(result.sessionsDiffer).toBe(true);

    // Verify delayed response from Session A was strictly refused with STALE_REVISION
    expect(result.delayedResKind).toBe("STALE_REVISION");
    expect(result.delayedResOk).toBe(false);
    expect(result.sessionIdAtRequest).toBe(result.initialSessionId);
    expect(result.currentSessionIdDecided).toBe(result.sessionBId);

    // 6. Verify canvas state and 3D geometry in Session B are UNCHANGED:
    // Width must be 2000mm from Session B's edit, NOT overwritten by Session A's delayed 2400mm
    const finalState = await getSummaryAndGeometryState(page);
    expect(finalState.widthMm).toBe(2000);
    expect(finalState.carcTopLengthMm).toBe(2000);
    expect(finalState.threeMeshTopWidthMm).toBe(2000);

    // 7. Control in the same journey: A subsequent request issued in Session B applies normally
    const convInput = page.locator("#aiConversationalInput");
    const sendBtn = page.locator("#aiConversationalSendBtn");
    await convInput.fill("Make it 2100 mm wide.");
    await sendBtn.click();
    await page.waitForFunction(() => {
      const el = document.getElementById("revRevision");
      const w = document.getElementById("revWidth");
      return el && el.textContent === "3" && w && w.textContent.includes("2100");
    });

    const controlState = await getSummaryAndGeometryState(page);
    expect(controlState.widthMm).toBe(2100);
    expect(controlState.threeMeshTopWidthMm).toBe(2100);

    await saveScreenshot(page, "state-prot-05-same-page-reopen-session-guard.png");
  });
});
