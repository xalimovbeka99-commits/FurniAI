/**
 * The corrected customer workflow, end to end, on the real modules:
 *   description → validated draft → edit → finish → Undo → save → reopen →
 *   editable again → drawings and cut list identical to what was accepted.
 * AI-assisted edits reach the same applyConversationalEdit/commitMaterialUpdate
 * path after the transport; the live provider is not called here.
 */
import { describe, it, expect } from "vitest";
import { previewDraftWardrobe, applyConversationalEdit, PIPELINE_STAGE } from "./pipeline.js";
import { commitMaterialUpdate } from "./commitMaterialUpdate.js";
import { fingerprintFurniSpec } from "./approval.js";
import { restoreEditableDesign } from "./reopenDesign.js";
import { serializeCanonicalJson } from "../furnispec/normalize.js";
import golden from "../furnispec/goldenWardrobe.fixture.json";
import { buildStructuralPartGraph } from "../partgraph/buildStructuralPartGraph.js";
import { createMemoryStore } from "../persistence/memoryStore.js";
import { createDesignService } from "../persistence/designService.js";
import { createDesignSaveCoordinator, SAVE_OUTCOME, REOPEN_OUTCOME } from "../persistence/designSaveCoordinator.js";
import { generateCutListCsv } from "../production/nestingCompiler.js";
import { generateShopDrawingsSVG } from "../drawing/projectionEngine.js";

const USER = "u-flow";
const canon = (v) => serializeCanonicalJson(v);
const DRAW = { date: "2026-09-30" };

function clientFor(service) {
  const t = (fn) => async (a) => {
    try { return await fn(a); } catch (e) { throw Object.assign(new Error(e.message), { code: e.code, status: e.status, details: e.details }); }
  };
  return {
    createDesign: t(({ name }) => service.createDesign({ userId: USER, name })),
    saveAcceptedRevision: t(({ designId, token: _t, ...b }) => service.saveRevision({ userId: USER, designId, ...b })),
    getDesign: t(({ designId }) => service.getDesign({ userId: USER, designId })),
    getRevision: t(({ designId, revision }) => service.getRevision({ userId: USER, designId, revision })),
  };
}

describe("a chosen finish is part of the accepted design and can be saved", () => {
  it("FAILED BEFORE — a walnut design was refused on save (INVALID_PARTGRAPH); now saved and reopened with its finish", async () => {
    const service = createDesignService({ store: createMemoryStore() });
    const { designId } = await service.createDesign({ userId: USER, name: "W" });
    const d = previewDraftWardrobe({ description: "A wardrobe 1800 mm wide, 2400 mm high and 600 mm deep", specId: "s-fin", revision: 1 });
    const w = commitMaterialUpdate({ materialKey: "walnut", spec: d.spec, partGraph: d.partGraph, observations: d.observations, origins: d.origins });
    expect(w.ok).toBe(true);
    expect(canon(w.partGraph)).toBe(canon(buildStructuralPartGraph(w.spec))); // compiled, not patched
    const saved = await service.saveRevision({
      userId: USER, designId, revision: 1, furniSpec: w.spec, partGraph: w.partGraph,
      fingerprint: fingerprintFurniSpec(w.spec), origins: w.origins, validationStatus: "ACCEPTED",
    });
    expect(saved.revision).toBe(1);
    const back = await service.getRevision({ userId: USER, designId, revision: 1 });
    expect(back.furniSpec.customerFinishKey).toBe("walnut");
    expect(back.furniSpec.finishType).toBe("melamine"); // manufacturing finish stays catalog-backed
    expect(back.partGraph.summary.customerFinishKey).toBe("walnut");
  });

  it("a design without a customer finish compiles byte-identically to before (golden unchanged)", () => {
    const g = buildStructuralPartGraph(golden);
    expect(g.summary).not.toHaveProperty("customerFinishKey");
    expect(g.parts.some((p) => "customerFinishKey" in p)).toBe(false);
  });
});

describe("restoreEditableDesign", () => {
  it("rebuilds the stored design exactly from its facts before calling it editable", () => {
    const d = previewDraftWardrobe({ description: "A wardrobe 2000 mm wide, 2200 mm high and 600 mm deep", specId: "s-r", revision: 1 });
    const r = restoreEditableDesign({ furniSpec: d.spec, partGraph: d.partGraph, origins: d.origins, storedRevision: 5, designId: "D" });
    expect(r.editable).toBe(true);
    expect(r.state).toMatchObject({ designId: "D", storedRevision: 5, revision: 1, editSequence: 0, undoStack: [] });
    expect(r.state.spec).toBe(d.spec); // stored design kept, not replaced by the rebuild
    const facts = Object.fromEntries(r.state.observations.map((o) => [o.key, o.value]));
    expect(facts).toMatchObject({ "envelope.widthMm": 2000, "envelope.heightMm": 2200, "envelope.depthMm": 600 });
  });

  it("says NOT editable, with the reason, for a stored design the pipeline cannot reproduce", () => {
    const r = restoreEditableDesign({ furniSpec: golden, partGraph: buildStructuralPartGraph(golden), storedRevision: 1 });
    expect(r.editable).toBe(false);
    expect(r.reason).toBe("RESTORED_DESIGN_DIFFERS");
    expect(r.state.observations).toEqual([]);
    expect(r.state.spec).toBe(golden); // still displayable and exportable from stored data
  });
});

describe("the customer workflow: saved data = reopened state = geometry = exports", () => {
  it("draft → edit → finish → edit → Undo → save → reopen → edit, with identical drawings and cut list", async () => {
    const service = createDesignService({ store: createMemoryStore() });
    let session = "S1";
    const coord = createDesignSaveCoordinator({ client: clientFor(service), getToken: () => "t", getSessionId: () => session });
    coord.reset("S1");

    // 1. Description → validated draft.
    const r1 = previewDraftWardrobe({ description: "A wardrobe 1800 mm wide, 2400 mm high and 600 mm deep", specId: "s-flow", revision: 1 });
    expect(r1.stage).toBe(PIPELINE_STAGE.DRAFT_PREVIEW);
    expect(r1.validation.valid).toBe(true);
    // 2. Edit (what an accepted AI edit reduces to after the transport).
    const r2 = applyConversationalEdit({ currentObservations: r1.observations, commandText: "Make it 2000 mm wide", specId: "s-flow", revision: 1 });
    expect(r2.ok).toBe(true);
    // 3. Finish.
    const r3 = commitMaterialUpdate({ materialKey: "walnut", spec: r2.spec, partGraph: r2.partGraph, observations: r2.observations, origins: r2.origins });
    // 4. Another edit, then Undo it (UI pops its snapshot: r3 again).
    const r4 = applyConversationalEdit({ currentObservations: r3.observations, commandText: "Make it 2200 mm high", specId: "s-flow", revision: r3.spec.revision });
    expect(r4.ok).toBe(true);
    const accepted = r3; // after Undo
    const acceptedExports = {
      csv: generateCutListCsv(accepted.partGraph),
      svg: generateShopDrawingsSVG(accepted.partGraph, DRAW),
    };

    // 5. Save.
    const out = await coord.save({
      furniSpec: accepted.spec, partGraph: accepted.partGraph, fingerprint: fingerprintFurniSpec(accepted.spec),
      origins: accepted.origins, name: "Bedroom", changeToken: 4,
    });
    expect(out.status).toBe(SAVE_OUTCOME.SAVED);

    // 6. Reload / reopen in a fresh session.
    session = "S2";
    const re = await coord.reopen({ designId: out.designId });
    expect(re.status).toBe(REOPEN_OUTCOME.REOPENED);
    coord.bind({ sessionId: "S2", designId: re.designId, storedRevision: re.storedRevision, specId: re.specId });
    const restored = restoreEditableDesign({
      furniSpec: re.payload.furniSpec, partGraph: re.payload.partGraph, origins: re.payload.origins,
      storedRevision: re.storedRevision, designId: re.designId,
    });
    expect(restored.editable).toBe(true);

    // saved data = reopened state = accepted design
    expect(re.payload.fingerprint).toBe(fingerprintFurniSpec(accepted.spec));
    expect(canon(restored.state.spec)).toBe(canon(accepted.spec));
    expect(canon(restored.state.partGraph)).toBe(canon(accepted.partGraph));
    expect(restored.state).toMatchObject({
      storedRevision: 1,
      revision: accepted.spec.revision,
      customerFinishKey: "walnut",
      envelope: { widthMm: 2000, heightMm: 2400, depthMm: 600 },
      undoStack: [],
    });
    // displayed geometry = what the kernel makes of the reopened spec
    expect(canon(buildStructuralPartGraph(restored.state.spec))).toBe(canon(restored.state.partGraph));
    // exports from the reopened design = exports of the accepted design
    expect(generateCutListCsv(restored.state.partGraph)).toBe(acceptedExports.csv);
    expect(generateShopDrawingsSVG(restored.state.partGraph, DRAW)).toBe(acceptedExports.svg);
    expect(acceptedExports.csv).toContain("2000"); // the edited width reached the cut list

    // 7. Editing continues from the reopened design, finish and height kept.
    const r5 = applyConversationalEdit({
      currentObservations: restored.state.observations, commandText: "Make it 2100 mm wide",
      specId: restored.state.specId, revision: restored.state.revision,
    });
    expect(r5.ok).toBe(true);
    expect(r5.spec.envelope).toMatchObject({ widthMm: 2100, heightMm: 2400, depthMm: 600 });
    expect(r5.spec.customerFinishKey).toBe("walnut");
    const next = await coord.save({
      furniSpec: r5.spec, partGraph: r5.partGraph, fingerprint: fingerprintFurniSpec(r5.spec), origins: r5.origins, changeToken: 1,
    });
    expect(next).toMatchObject({ status: SAVE_OUTCOME.SAVED, designId: out.designId, storedRevision: 2 });
  });
});
