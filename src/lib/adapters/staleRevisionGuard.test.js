/**
 * A stale answer must never be applied.
 *
 * Two edits can overlap: the customer types a second change, presses Undo, or
 * switches designs while the first is still in flight. Applying the older
 * answer afterwards silently reverts or cross-contaminates the active design.
 *
 * BEK requirements (revision alone is NOT sufficient):
 *   1. Identify the design (specId / design id).
 *   2. Use a changeToken that does NOT rewind on Undo (monotonic; bumps on
 *      every committed edit AND every Undo).
 *   3. Reject outdated and out-of-order responses.
 * Required cases:
 *   - edit → Undo → delayed response must be rejected
 *   - switching designs with equal revisions must not apply the other design's answer
 *
 * Evidence class: B (real published entry point, simulated provider). No live
 * provider, no browser. `fetchImpl` is a stub.
 */
import { describe, it, expect } from "vitest";
import {
  proposeDesignChange,
  isStaleAnswer,
  isStaleForRevision,
  RESULT_KIND,
  RESULT_SOURCE,
} from "./aiDesignerTransport.js";
import { previewDraftWardrobe, PIPELINE_STAGE } from "../conversation/pipeline.js";

const SPEC_A = "spec-stale-guard-a";
const SPEC_B = "spec-stale-guard-b";
/** Phrasing the deterministic parser does not recognise, so the network is reached. */
const MODEL_ONLY = "Could you open it up a bit more across the front, please?";

function activeDesign(specId = SPEC_A) {
  const draft = previewDraftWardrobe({
    description: "A wardrobe 1800 mm wide and 2400 mm high",
    specId,
    revision: 1,
  });
  expect(draft.stage).toBe(PIPELINE_STAGE.DRAFT_PREVIEW);
  return draft;
}

const widenTo2000 = async () => ({
  ok: true,
  status: 200,
  json: async () => ({
    ok: true,
    edits: [{ key: "envelope.widthMm", value: 2000 }],
    unsupported: [],
    reply: "Widened.",
  }),
});

describe("isStaleAnswer (changeToken + design id)", () => {
  it("is stale when changeToken advanced (another edit)", () => {
    expect(
      isStaleAnswer({
        designIdAtRequest: SPEC_A,
        changeTokenAtRequest: 1,
        currentDesignId: () => SPEC_A,
        currentChangeToken: () => 2,
      })
    ).toBe(true);
  });

  it("is stale when changeToken advanced on Undo (token does not rewind)", () => {
    // Undo restores revision 1, but changeToken still bumps 1 → 2.
    // A revision-only check would see 1 === 1 and wrongly accept.
    expect(
      isStaleAnswer({
        designIdAtRequest: SPEC_A,
        changeTokenAtRequest: 1,
        currentDesignId: () => SPEC_A,
        currentChangeToken: () => 2,
      })
    ).toBe(true);
  });

  it("is stale when the active design id changed at equal revision/token", () => {
    expect(
      isStaleAnswer({
        designIdAtRequest: SPEC_A,
        changeTokenAtRequest: 5,
        currentDesignId: () => SPEC_B,
        currentChangeToken: () => 5,
      })
    ).toBe(true);
  });

  it("is not stale when design id and changeToken both match", () => {
    expect(
      isStaleAnswer({
        designIdAtRequest: SPEC_A,
        changeTokenAtRequest: 3,
        currentDesignId: () => SPEC_A,
        currentChangeToken: () => 3,
      })
    ).toBe(false);
  });

  it("does not guess when the caller supplies no readers", () => {
    expect(isStaleAnswer({ designIdAtRequest: SPEC_A, changeTokenAtRequest: 1 })).toBe(false);
  });
});

describe("isStaleForRevision (legacy wrapper)", () => {
  it("is stale when the caller has moved on", () => {
    expect(isStaleForRevision({ revisionAtRequest: 1, currentRevision: () => 2 })).toBe(true);
  });

  it("is stale when the caller went BACKWARDS — but this is insufficient for Undo that restores the prior revision", () => {
    expect(isStaleForRevision({ revisionAtRequest: 3, currentRevision: () => 2 })).toBe(true);
  });

  it("is not stale when nothing moved", () => {
    expect(isStaleForRevision({ revisionAtRequest: 2, currentRevision: () => 2 })).toBe(false);
  });

  it("does not guess when the caller supplies no reader", () => {
    expect(isStaleForRevision({ revisionAtRequest: 1 })).toBe(false);
    expect(isStaleForRevision({ revisionAtRequest: 1, currentRevision: 2 })).toBe(false);
  });
});

describe("through the published transport — changeToken + design id", () => {
  it("BEK: edit → Undo → delayed response is rejected (changeToken bumped; revision restored)", async () => {
    const design = activeDesign();
    // After edit: revision 2, changeToken 1. After Undo: revision 1, changeToken 2.
    let liveRevision = 1;
    let liveChangeToken = 1;
    const liveDesignId = SPEC_A;

    const res = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: design.observations,
      specId: SPEC_A,
      revision: 1,
      changeToken: 1,
      fetchImpl: async (...args) => {
        // Simulate: committed edit then Undo while in flight.
        liveRevision = 2;
        liveChangeToken = 2; // edit bump
        liveRevision = 1; // Undo restores revision
        liveChangeToken = 3; // Undo ALSO bumps changeToken
        return widenTo2000(...args);
      },
      currentDesignId: () => liveDesignId,
      currentChangeToken: () => liveChangeToken,
      currentRevision: () => liveRevision,
    });

    expect(res.kind).toBe(RESULT_KIND.STALE_REVISION);
    expect(res.ok).toBe(false);
    expect(res.changeTokenAtRequest).toBe(1);
    expect(res.currentChangeToken).toBe(3);
    // Revision alone would have matched (1 === 1) — prove we did not rely on it.
    expect(res.currentRevision).toBe(1);
    expect(res.revisionAtRequest).toBe(1);
  });

  it("BEK: switching designs with equal revisions must not apply the other design's answer", async () => {
    const designA = activeDesign(SPEC_A);
    let liveDesignId = SPEC_A;
    const equalRevision = 5;
    const equalToken = 5;

    const res = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: designA.observations,
      specId: SPEC_A,
      revision: equalRevision,
      changeToken: equalToken,
      fetchImpl: async (...args) => {
        // Customer switched to design B; revision/token happen to match.
        liveDesignId = SPEC_B;
        return widenTo2000(...args);
      },
      currentDesignId: () => liveDesignId,
      currentChangeToken: () => equalToken,
      currentRevision: () => equalRevision,
    });

    expect(res.kind).toBe(RESULT_KIND.STALE_REVISION);
    expect(res.ok).toBe(false);
    expect(res.designIdAtRequest).toBe(SPEC_A);
    expect(res.currentDesignId).toBe(SPEC_B);
    expect(res.spec ?? null).toBeNull();
  });

  it("refuses an answer that landed after another edit (changeToken advanced)", async () => {
    const design = activeDesign();
    let liveToken = 1;

    const res = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: design.observations,
      specId: SPEC_A,
      revision: design.spec.revision,
      changeToken: 1,
      fetchImpl: async (...args) => {
        liveToken = 2;
        return widenTo2000(...args);
      },
      currentDesignId: () => SPEC_A,
      currentChangeToken: () => liveToken,
    });

    expect(res.kind).toBe(RESULT_KIND.STALE_REVISION);
    expect(res.ok).toBe(false);
    expect(res.source).toBe(RESULT_SOURCE.DETERMINISTIC);
  });

  it("returns no geometry and no spec on a stale answer", async () => {
    const design = activeDesign();
    let liveToken = 1;
    const res = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: design.observations,
      specId: SPEC_A,
      revision: 1,
      changeToken: 1,
      fetchImpl: async (...a) => {
        liveToken = 2;
        return widenTo2000(...a);
      },
      currentDesignId: () => SPEC_A,
      currentChangeToken: () => liveToken,
    });

    expect(res.spec ?? null).toBeNull();
    expect(res.partGraph ?? null).toBeNull();
    expect(res.materialKey ?? null).toBeNull();
  });

  it("tells the customer plainly, in ordinary language", async () => {
    const design = activeDesign();
    let liveToken = 1;
    const res = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: design.observations,
      specId: SPEC_A,
      revision: 1,
      changeToken: 1,
      fetchImpl: async (...a) => {
        liveToken = 2;
        return widenTo2000(...a);
      },
      currentDesignId: () => SPEC_A,
      currentChangeToken: () => liveToken,
    });

    expect(res.error).toMatch(/not applied/i);
    expect(res.error).toMatch(/unchanged/i);
    expect(res.error).not.toMatch(/[A-Z]{3,}_[A-Z]/);
    expect(res.error).not.toMatch(/revision \d|stale|changeToken/i);
  });

  it("leaves the caller's design untouched", async () => {
    const design = activeDesign();
    const before = JSON.stringify({ spec: design.spec, observations: design.observations });
    let liveToken = 1;

    await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: design.observations,
      specId: SPEC_A,
      revision: 1,
      changeToken: 1,
      fetchImpl: async (...a) => {
        liveToken = 2;
        return widenTo2000(...a);
      },
      currentDesignId: () => SPEC_A,
      currentChangeToken: () => liveToken,
    });

    expect(JSON.stringify({ spec: design.spec, observations: design.observations })).toBe(before);
  });

  it("applies the answer normally when nothing moved", async () => {
    const design = activeDesign();
    const res = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: design.observations,
      specId: SPEC_A,
      revision: design.spec.revision,
      changeToken: 7,
      fetchImpl: widenTo2000,
      currentDesignId: () => SPEC_A,
      currentChangeToken: () => 7,
    });

    expect(res.kind).toBe(RESULT_KIND.DESIGN_UPDATED);
    expect(res.spec.envelope.widthMm).toBe(2000);
  });

  it("does not change behaviour for a caller that passes no readers", async () => {
    const design = activeDesign();
    const res = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: design.observations,
      specId: SPEC_A,
      revision: 1,
      fetchImpl: widenTo2000,
    });

    expect(res.kind).toBe(RESULT_KIND.DESIGN_UPDATED);
    expect(res.spec.envelope.widthMm).toBe(2000);
  });

  it("does not interfere with a deterministic edit, which cannot be stale", async () => {
    const design = activeDesign();
    const res = await proposeDesignChange({
      message: "Make it 2000 mm wide",
      currentObservations: design.observations,
      specId: SPEC_A,
      revision: 1,
      changeToken: 1,
      fetchImpl: null,
      currentDesignId: () => SPEC_B,
      currentChangeToken: () => 99,
    });

    expect(res.kind).toBe(RESULT_KIND.DESIGN_UPDATED);
    expect(res.source).toBe(RESULT_SOURCE.DETERMINISTIC);
  });

  it("adds STALE_REVISION without disturbing the published kinds", async () => {
    expect(Object.keys(RESULT_KIND).sort()).toEqual(
      [
        "DESIGNER_UNAVAILABLE",
        "DESIGN_UPDATED",
        "MATERIAL_UPDATED",
        "NEEDS_MORE_DETAIL",
        "REJECTED",
        "STALE_REVISION",
        "UNSUPPORTED",
      ].sort()
    );
  });
});
