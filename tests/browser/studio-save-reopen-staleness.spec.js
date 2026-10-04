/**
 * Studio durable save / reopen — stale answers, in the real page.
 *
 * /api/designs is answered by page.route (deterministic, no credentials, no
 * database): these tests are about what the PAGE does with answers that
 * arrive late, not about the server. The server side is covered by
 * src/lib/persistence/*.test.js and scripts/verify-persistence-db.mjs.
 *
 * Tests 1–2 need the Studio's persistAcceptedRevision / reopenDesignFromApi
 * (Antigravity's studio-designs-client work) and skip where they are absent.
 */
import { test, expect } from "@playwright/test";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

async function freshDraft(page, text = "Wardrobe 1800mm wide, 2400mm high, 600mm deep, oak finish") {
  await page.goto("/#/build/ai-wardrobe");
  await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.ready);
  const input = page.locator("#aiWardrobeInput");
  await input.fill(text);
  await input.press("Enter");
  await expect(page.locator("#aiWardrobeReviewSection")).toBeVisible({ timeout: 15000 });
  await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.parts?.[0]);
}

/**
 * Routes: create -> A; save on A is held until `release()`; design B has 4
 * stored revisions and reopens as revision 4 (its body is the page's own
 * current spec/graph, relabelled — enough for the page to load it).
 */
async function routeDesigns(page) {
  let releaseSave;
  const saveHeld = new Promise((r) => { releaseSave = r; });
  let saveSeen;
  const saveArrived = new Promise((r) => { saveSeen = r; });
  const current = await page.evaluate(() => ({
    spec: window.aiWardrobeState.spec,
    partGraph: window.aiWardrobeState.partGraph,
  }));
  const json = (route, status, body) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

  await page.route("**/api/designs**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    if (req.method() === "POST" && p === "/api/designs") {
      return json(route, 201, { ok: true, designId: A, name: "A", latestRevision: null });
    }
    if (req.method() === "POST" && p === `/api/designs/${A}/revisions`) {
      const body = req.postDataJSON();
      saveSeen(body);
      await saveHeld;
      return json(route, 201, { ok: true, designId: A, revision: body.revision, fingerprint: body.fingerprint });
    }
    if (req.method() === "GET" && p === `/api/designs/${B}`) {
      return json(route, 200, { ok: true, design: { designId: B, name: "B" }, latestRevision: { revision: 4, fingerprint: "sha256:b4" } });
    }
    if (req.method() === "GET" && p === `/api/designs/${B}/revisions/4`) {
      return json(route, 200, {
        ok: true, designId: B, revision: 4, fingerprint: "sha256:b4",
        furniSpec: { ...current.spec, specId: "furnispec-design-b" }, partGraph: current.partGraph, origins: {},
      });
    }
    return json(route, 404, { ok: false, code: "MISSING_DESIGN", error: "not found" });
  });
  return { saveArrived, release: () => releaseSave() };
}

test.describe("Studio durable save — a late answer must not land on a reopened design", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
    await freshDraft(page);
  });

  test("1. REPRODUCTION (candidate as-is): a save answered after reopening B re-labels B", async ({ page }) => {
    // Expected to FAIL against the Studio candidate: it documents the defect.
    // When the Studio routes saves through the coordinator (test 2) this test
    // will start passing and Playwright will flag it — then delete test.fail.
    test.fail(true, "known defect: persistAcceptedRevision writes a late answer into the reopened design's state");
    const present = await page.evaluate(() => typeof window.persistAcceptedRevision === "function" && typeof window.reopenDesignFromApi === "function");
    test.skip(!present, "Studio durable-save functions are not in this build");
    await page.evaluate(() => { window.getStudioAccessToken = async () => "test-token"; });
    const r = await routeDesigns(page);

    await page.evaluate(() => { window.__save = window.persistAcceptedRevision({ token: "test-token", quiet: true }); });
    await r.saveArrived; // create answered (A adopted), save of A in flight
    await page.evaluate((b) => window.reopenDesignFromApi(b, 4), B);
    const afterReopen = await page.evaluate(() => ({ id: aiWardrobeState.durableDesignId, rev: aiWardrobeState.durableRevision }));
    expect(afterReopen).toEqual({ id: B, rev: 4 });

    r.release();
    await page.evaluate(() => window.__save);
    const after = await page.evaluate(() => ({
      id: aiWardrobeState.durableDesignId,
      rev: aiWardrobeState.durableRevision,
      fp: aiWardrobeState.durableFingerprint,
    }));
    // Documented defect: B's stored base is overwritten by A's answer, so B's
    // next save would claim to build on revision 1 and be refused as stale.
    test.info().annotations.push({ type: "observed", description: JSON.stringify(after) });
    expect.soft(after, "Studio candidate applies A's late answer to B").toEqual({ id: B, rev: 4, fp: "sha256:b4" });
  });

  test("2. With AiDesignerTransport.createDesignSaveCoordinator the late answer is discarded", async ({ page }) => {
    const present = await page.evaluate(
      () => typeof window.AiDesignerTransport?.createDesignSaveCoordinator === "function" && typeof window.createDesignsApiClient === "function"
    );
    test.skip(!present, "coordinator or designs client not in this build");
    const r = await routeDesigns(page);

    await page.evaluate(() => {
      const T = window.AiDesignerTransport;
      window.__coord = T.createDesignSaveCoordinator({
        client: window.createDesignsApiClient(),
        getToken: () => "test-token",
        getSessionId: () => window.getActiveStudioSessionId(),
      });
      window.__coord.reset(window.getActiveStudioSessionId());
      const s = window.aiWardrobeState;
      window.__save = window.__coord.save({
        furniSpec: s.spec,
        partGraph: s.partGraph,
        fingerprint: window.PartGraphBridge.fingerprintFurniSpec(s.spec),
        origins: s.origins || {},
        name: "A",
        changeToken: s.editSequence,
      });
    });
    await r.saveArrived;
    const reopened = await page.evaluate(async (b) => {
      const out = await window.__coord.reopen({ designId: b });
      const sid = window.rotateStudioSession();
      window.__coord.bind({ sessionId: sid, designId: out.designId, storedRevision: out.storedRevision, specId: out.specId });
      return out.status;
    }, B);
    expect(reopened).toBe("REOPENED");

    r.release();
    const outcome = await page.evaluate(() => window.__save);
    expect(outcome.status).toBe("DISCARDED_STALE_SESSION");
    const snap = await page.evaluate(() => window.__coord.snapshot());
    expect(snap).toMatchObject({ designId: B, storedRevision: 4, specId: "furnispec-design-b" });
  });
});

test.describe("Hanging drop the carcass cannot deliver — refused atomically in the page", () => {
  test("3. 'Make it 1900 mm high' is refused; viewer and export PartGraph stay on the 2400 mm design", async ({ page }) => {
    test.setTimeout(90000);
    await freshDraft(page);
    const before = await page.evaluate(() => ({
      h: aiWardrobeState.spec.envelope.heightMm,
      fp: JSON.stringify(aiWardrobeState.partGraph.summary),
      parts: aiWardrobeState.partGraph.parts.length,
      rev: aiWardrobeState.revision,
    }));
    expect(before.h).toBe(2400);

    await page.locator("#aiConversationalInput").fill("Make it 1900 mm high.");
    await page.locator("#aiConversationalSendBtn").click();
    await page.waitForTimeout(4000);

    const after = await page.evaluate(() => ({
      h: aiWardrobeState.spec.envelope.heightMm,
      fp: JSON.stringify(aiWardrobeState.partGraph.summary),
      parts: aiWardrobeState.partGraph.parts.length,
      rev: aiWardrobeState.revision,
    }));
    expect(after).toEqual(before);
    // The refusal is the kernel's, not an AI/transport failure.
    const text = await page.locator("body").innerText();
    expect(text).toMatch(/clear drop of 1400mm, but only|outside the bay clear height/i);
  });
});
