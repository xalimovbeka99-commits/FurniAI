/**
 * Unsupported-component path through the real customer edit entry
 * (`proposeDesignChange` / AiDesignerTransport).
 *
 * Category: parser / deterministic transport (NOT live-provider).
 * A PartGraph that merely contains UNSUPPORTED ledger rows is not fulfillment.
 * The customer must receive an explanation, keep their design, and see no
 * automatic alternative applied.
 */
import { describe, it, expect, vi } from "vitest";
import { previewDraftWardrobe, applyConversationalEdit, PIPELINE_STAGE } from "../conversation/pipeline.js";
import { proposeDesignChange, RESULT_KIND, RESULT_SOURCE } from "./aiDesignerTransport.js";
import { COMPONENT_REPRESENTATION_POLICY } from "../partgraph/componentOutcomes.js";

const SPEC_ID = "spec-unsupported-entry-01";

describe("unsupported request through proposeDesignChange (customer entry)", () => {
  it("returns UNSUPPORTED with ledger diagnostic; does not mutate design or call the model", async () => {
    const before = previewDraftWardrobe({
      description: "Make me a wardrobe",
      specId: SPEC_ID,
      revision: 1,
    });
    expect(before.stage).toBe(PIPELINE_STAGE.DRAFT_PREVIEW);
    const beforeFacts = Object.fromEntries(before.observations.map((o) => [o.key, JSON.stringify(o.value)]));
    const beforeRev = before.spec.revision;
    const beforeParts = before.partGraph.parts.length;
    const beforeFingerprint = before.proposal?.fingerprint;

    const fetchImpl = vi.fn(async () => {
      throw new Error("model must not be consulted for a known unsupported hardware request");
    });

    const res = await proposeDesignChange({
      message: "Add black handles",
      currentObservations: before.observations,
      specId: SPEC_ID,
      revision: beforeRev,
      fetchImpl,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(res.ok).toBe(false);
    expect(res.source).toBe(RESULT_SOURCE.DETERMINISTIC);
    expect(res.kind).toBe(RESULT_KIND.UNSUPPORTED);
    expect(res.error).toBeTruthy();
    expect(res.error).toMatch(/handle/i);
    expect(Array.isArray(res.unsupported)).toBe(true);
    expect(res.unsupported.length).toBeGreaterThan(0);
    expect(res.unsupported[0].componentType).toBeNull();
    expect(res.unsupported[0].reason).toMatch(/handle/i);
    expect(res.unsupported[0].alternativeApplied).toBe(false);

    // Not successful fulfillment: no replacement geometry / revision
    expect(res.spec).toBeUndefined();
    expect(res.partGraph).toBeUndefined();
    expect(res.revision ?? beforeRev).toBe(beforeRev);

    // Active design the caller holds is unchanged
    expect(Object.fromEntries(before.observations.map((o) => [o.key, JSON.stringify(o.value)]))).toEqual(beforeFacts);
    expect(before.spec.revision).toBe(beforeRev);
    expect(before.partGraph.parts.length).toBe(beforeParts);
    expect(before.proposal?.fingerprint).toBe(beforeFingerprint);
  });

  it("applyConversationalEdit refuses lock request the same way", () => {
    const before = previewDraftWardrobe({
      description: "A wardrobe 1800 mm wide and 2400 mm high",
      specId: SPEC_ID,
      revision: 1,
    });
    const result = applyConversationalEdit({
      currentObservations: before.observations,
      commandText: "Add a lock to the doors",
      specId: SPEC_ID,
      revision: before.spec.revision,
    });
    expect(result.ok).toBe(false);
    expect(result.kind).toBe("UNSUPPORTED");
    expect(result.unsupported?.[0]?.alternativeApplied).toBe(false);
    expect(result.unsupported?.[0]?.reason).toMatch(/lock/i);
    expect(result.spec).toBeUndefined();
    expect(result.partGraph).toBeUndefined();
  });
});
