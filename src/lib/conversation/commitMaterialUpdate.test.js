import { describe, it, expect } from "vitest";
import { previewDraftWardrobe } from "./pipeline.js";
import { commitMaterialUpdate } from "./commitMaterialUpdate.js";
import { fingerprintFurniSpec } from "./approval.js";

describe("commitMaterialUpdate", () => {
  it("rebuilds accepted finish, fingerprint, observations and PartGraph finish intent", () => {
    const draft = previewDraftWardrobe({
      description: "A 4-door wardrobe, 1800mm wide, white finish",
      specId: "test-material-commit",
      revision: 1,
    });
    expect(draft.spec).toBeTruthy();
    const beforeFp = draft.proposal.fingerprint;
    const beforeCodes = (draft.partGraph.parts || []).map((p) => p.materialCode);

    const committed = commitMaterialUpdate({
      materialKey: "walnut",
      spec: draft.spec,
      partGraph: draft.partGraph,
      observations: draft.observations,
      origins: draft.origins || {},
      revision: draft.spec.revision,
    });

    expect(committed.ok).toBe(true);
    expect(committed.spec.finishType).toBe("walnut");
    expect(committed.spec.customerFinishKey).toBe("walnut");
    expect(committed.revision).toBe(2);
    expect(committed.proposal.fingerprint).not.toBe(beforeFp);
    expect(committed.proposal.fingerprint).toBe(fingerprintFurniSpec(committed.spec));
    expect(committed.observations.some((o) => o.key === "finishType" && o.value === "walnut")).toBe(true);
    expect(committed.partGraph.summary.customerFinishKey).toBe("walnut");
    expect(committed.partGraph.parts.every((p) => p.customerFinishKey === "walnut")).toBe(true);
    // Manufacturing SKUs remain catalog-backed (melamine white) until walnut has an approved record.
    expect(committed.partGraph.parts.map((p) => p.materialCode)).toEqual(beforeCodes);
  });

  it("fails closed without an active spec", () => {
    const res = commitMaterialUpdate({ materialKey: "walnut", spec: null });
    expect(res.ok).toBe(false);
  });
});
