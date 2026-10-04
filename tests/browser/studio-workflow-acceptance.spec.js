/**
 * ACCEPTANCE — the corrected customer workflow in the real page, persisted in
 * a REAL PostgreSQL through the REAL /api/designs handlers:
 *
 *   description → validated draft → edit → finish → edit → Undo → save →
 *   page reload → reopen → same design in state, 3D and exports → edit → save
 *
 * Run through the shared database harness (no new framework):
 *   node scripts/db-verify/with-local-stack.mjs -- \
 *     npx playwright test tests/browser/studio-workflow-acceptance.spec.js
 * It skips without FURNIAI_TEST_URL/TOKEN_A. Evidence tier: local PostgreSQL
 * + PostgREST + RLS, JWT shim — NOT hosted Supabase, NOT a live AI provider
 * (edits use the deterministic path the AI transport's accepted edits reduce to).
 *
 * The page's own UI does the editing, Undo and exports (Antigravity's Studio);
 * save/reopen go through AiDesignerTransport.createDesignSaveCoordinator with
 * Antigravity's designs client, and PartGraphBridge.restoreEditableDesign.
 */
import { test, expect } from "@playwright/test";
import fs from "fs";

const API = process.env.FURNIAI_TEST_URL;
/** Key-order-independent JSON (PostgreSQL jsonb does not keep key order). */
const canon = (v) =>
  Array.isArray(v) ? `[${v.map(canon).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`
  : JSON.stringify(v);
const TOKEN = process.env.TOKEN_A;

async function waitRevision(page, n) {
  await page.waitForFunction((want) => document.getElementById("revRevision")?.textContent === String(want), n, { timeout: 20000 });
}

async function exportText(page, trigger) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), page.evaluate(trigger)]);
  return fs.readFileSync(await dl.path(), "utf8");
}

async function snapshot(page) {
  return page.evaluate(() => {
    const s = window.aiWardrobeState;
    let meshTopWidthMm = null;
    Builder.parts?.[0]?.traverse((c) => {
      if ((c.name === "part_CARC_TOP" || c.userData?.partId === "CARC_TOP") && c.geometry?.parameters?.width) {
        meshTopWidthMm = Math.round(c.geometry.parameters.width * 1000);
      }
    });
    return {
      fingerprint: window.PartGraphBridge.fingerprintFurniSpec(s.spec),
      spec: s.spec,
      partGraph: s.partGraph,
      envelope: s.spec.envelope,
      customerFinishKey: s.spec.customerFinishKey ?? null,
      revision: s.revision,
      shownRevision: document.getElementById("revRevision")?.textContent,
      shownWidth: document.getElementById("revWidth")?.textContent,
      shownFinish: document.getElementById("revFinish")?.textContent?.trim(),
      meshTopWidthMm,
      sessionId: window.getActiveStudioSessionId?.(),
      undoDepth: s.undoStack?.length ?? null,
    };
  });
}

async function reopenInPage(page, designId) {
  return page.evaluate(async ({ token, designId }) => {
      const coord = window.AiDesignerTransport.createDesignSaveCoordinator({
        client: window.createDesignsApiClient(),
        getToken: () => token,
        getSessionId: () => window.getActiveStudioSessionId(),
      });
      coord.reset(window.getActiveStudioSessionId());
      const r = await coord.reopen({ designId });
      const restored = window.PartGraphBridge.restoreEditableDesign({
        furniSpec: r.payload.furniSpec, partGraph: r.payload.partGraph, origins: r.payload.origins,
        storedRevision: r.storedRevision, designId: r.designId,
      });
      const before = window.getActiveStudioSessionId();
      window.reopenAiWardrobeDesign({
        text: "", answers: {}, specId: restored.state.specId, revision: restored.state.revision,
        currentStage: "DRAFT_PREVIEW", proposal: null, approval: null,
        spec: restored.state.spec, partGraph: restored.state.partGraph,
        observations: restored.state.observations, origins: restored.state.origins,
        durableDesignId: r.designId, durableRevision: r.storedRevision, durableFingerprint: r.payload.fingerprint,
        durableName: r.name,
      });
      coord.bind({ sessionId: window.getActiveStudioSessionId(), designId: r.designId, storedRevision: r.storedRevision, specId: r.specId });
      window.__coord = coord;
      return { status: r.status, editable: restored.editable, reason: restored.reason ?? null,
        rotated: before !== window.getActiveStudioSessionId(), coord: coord.snapshot() };
  }, { token: TOKEN, designId });
}

test.describe("ACCEPTANCE — customer workflow against a real database", () => {
  test.skip(!API || !TOKEN, "run through scripts/db-verify/with-local-stack.mjs");

  test("saved data, reopened state, 3D geometry and exports describe the same design", async ({ page }) => {
    test.setTimeout(240000);
    await page.route("**/api/designs**", async (route) => {
      const u = new URL(route.request().url());
      const response = await route.fetch({ url: `${API}${u.pathname}${u.search}` });
      await route.fulfill({ response });
    });

    // 1. Description → validated draft.
    await page.goto("/#/build/ai-wardrobe");
    await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.ready);
    await page.locator("#aiWardrobeInput").fill("Wardrobe 1800mm wide, 2400mm high, 600mm deep");
    await page.locator("#aiWardrobeInput").press("Enter");
    await expect(page.locator("#aiWardrobeReviewSection")).toBeVisible({ timeout: 15000 });
    await waitRevision(page, 1);

    // 2. Edit, 3. finish, 4. another edit, 5. Undo it.
    await page.locator("#chipWidth2000").click();
    await waitRevision(page, 2);
    await page.locator("#chipFinishWalnut").click();
    await waitRevision(page, 3);
    await page.locator("#aiConversationalInput").fill("Make it 2200 mm high.");
    await page.locator("#aiConversationalSendBtn").click();
    await waitRevision(page, 4);
    await page.locator("#btnUndoEdit").click();
    await waitRevision(page, 3);

    const accepted = await snapshot(page);
    expect(accepted.envelope).toMatchObject({ widthMm: 2000, heightMm: 2400, depthMm: 600 });
    expect(accepted.customerFinishKey).toBe("walnut");
    expect(accepted.meshTopWidthMm).toBe(2000);
    const csvBefore = await exportText(page, () => window.handleExportCutListCsv());
    const svgBefore = await exportText(page, () => window.handleExportShopDrawings("SVG"));

    // 6. Save.
    const saved = await page.evaluate(async (token) => {
      const T = window.AiDesignerTransport;
      window.__coord = T.createDesignSaveCoordinator({
        client: window.createDesignsApiClient(),
        getToken: () => token,
        getSessionId: () => window.getActiveStudioSessionId(),
      });
      window.__coord.reset(window.getActiveStudioSessionId());
      const s = window.aiWardrobeState;
      return window.__coord.save({
        furniSpec: s.spec, partGraph: s.partGraph,
        fingerprint: window.PartGraphBridge.fingerprintFurniSpec(s.spec),
        origins: s.origins || {}, name: "Acceptance wardrobe", changeToken: s.editSequence,
      });
    }, TOKEN);
    expect(saved).toMatchObject({ status: "SAVED", storedRevision: 1 });

    // Saved data, read back from the database by a different client.
    const dbRow = await (await fetch(`${API}/api/designs/${saved.designId}/revisions/1`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    })).json();
    expect(dbRow.fingerprint).toBe(accepted.fingerprint);
    expect(canon(dbRow.partGraph)).toBe(canon(accepted.partGraph));
    expect(canon(dbRow.furniSpec)).toBe(canon(accepted.spec));

    // 7. Reload the page (new browsing session) and reopen.
    await page.reload();
    await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.ready);
    await page.goto("/#/build/ai-wardrobe");
    const reopened = await reopenInPage(page, saved.designId);
    expect(reopened).toMatchObject({ status: "REOPENED", editable: true, rotated: true });
    expect(reopened.coord).toMatchObject({ designId: saved.designId, storedRevision: 1 });
    await page.waitForFunction(() => Builder.parts?.[0]);

    const back = await snapshot(page);
    // reopened state = saved data = accepted design
    expect(back.fingerprint).toBe(accepted.fingerprint);
    expect(canon(back.partGraph)).toBe(canon(accepted.partGraph));
    expect(canon(back.spec)).toBe(canon(accepted.spec));
    expect(back.envelope).toEqual(accepted.envelope);
    expect(back.customerFinishKey).toBe("walnut");
    expect(back.revision).toBe(accepted.revision);
    expect(back.undoDepth).toBe(0); // Undo does not cross a reopen (defined)
    // displayed 3D geometry
    expect(back.meshTopWidthMm).toBe(2000);
    // exports
    expect(await exportText(page, () => window.handleExportCutListCsv())).toBe(csvBefore);
    expect(await exportText(page, () => window.handleExportShopDrawings("SVG"))).toBe(svgBefore);
    test.info().annotations.push({
      type: "display-after-reopen",
      description: JSON.stringify({ shownRevision: back.shownRevision, shownWidth: back.shownWidth, shownFinish: back.shownFinish }),
    });

    // 8. Editing continues from the reopened design; save appends revision 2.
    // Known Studio gap (D9): reopenAiWardrobeDesign() leaves the intake panel on
    // screen, so the refine input is not visible after a reopen. Recorded, and
    // the edit is driven through the Studio's own edit function instead.
    const refineVisible = await page.locator("#aiConversationalInput").isVisible();
    test.info().annotations.push({ type: "D9-refine-input-visible-after-reopen", description: String(refineVisible) });
    await page.evaluate(() => window.runAiWardrobeConversationalEdit("Make it 2100 mm wide."));
    await page.waitForFunction(() => window.aiWardrobeState?.spec?.envelope?.widthMm === 2100, null, { timeout: 20000 });
    const after = await snapshot(page);
    expect(after.envelope).toMatchObject({ widthMm: 2100, heightMm: 2400, depthMm: 600 });
    expect(after.customerFinishKey).toBe("walnut");
    const second = await page.evaluate(() => {
      const s = window.aiWardrobeState;
      return window.__coord.save({
        furniSpec: s.spec, partGraph: s.partGraph, fingerprint: window.PartGraphBridge.fingerprintFurniSpec(s.spec),
        origins: s.origins || {}, changeToken: s.editSequence,
      });
    });
    expect(second).toMatchObject({ status: "SAVED", designId: saved.designId, storedRevision: 2 });
  });

  test("KNOWN STUDIO GAP (D10): the summary panel after reopen shows the reopened design", async ({ page }) => {
    // Expected to FAIL on the current Studio: state, 3D and exports are the
    // reopened design (test above) but #revRevision/#revWidth/#revFinish keep
    // the page's initial values. Owner: Antigravity. Remove test.fail when fixed.
    test.fail(true, "D10: reopenAiWardrobeDesign does not refresh the revision/width/finish summary");
    test.setTimeout(180000);
    await page.route("**/api/designs**", async (route) => {
      const u = new URL(route.request().url());
      await route.fulfill({ response: await route.fetch({ url: `${API}${u.pathname}${u.search}` }) });
    });
    await page.goto("/#/build/ai-wardrobe");
    await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.ready);
    await page.locator("#aiWardrobeInput").fill("Wardrobe 2000mm wide, 2400mm high, 600mm deep");
    await page.locator("#aiWardrobeInput").press("Enter");
    await waitRevision(page, 1);
    await page.locator("#chipFinishWalnut").click();
    await waitRevision(page, 2);
    const saved = await page.evaluate(async (token) => {
      const c = window.AiDesignerTransport.createDesignSaveCoordinator({
        client: window.createDesignsApiClient(), getToken: () => token, getSessionId: () => window.getActiveStudioSessionId(),
      });
      c.reset(window.getActiveStudioSessionId());
      const s = window.aiWardrobeState;
      return c.save({ furniSpec: s.spec, partGraph: s.partGraph, fingerprint: window.PartGraphBridge.fingerprintFurniSpec(s.spec), origins: s.origins, changeToken: s.editSequence });
    }, TOKEN);
    await page.reload();
    await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.ready);
    await page.goto("/#/build/ai-wardrobe");
    await reopenInPage(page, saved.designId);
    const shown = await snapshot(page);
    expect({ rev: shown.shownRevision, width: shown.shownWidth, finish: (shown.shownFinish || "").toLowerCase() })
      .toEqual({ rev: "2", width: "2000 mm", finish: "walnut" });
  });
});
