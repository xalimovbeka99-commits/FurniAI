import { describe, it, expect } from "vitest";
import { previewDraftWardrobe, applyConversationalEdit } from "./pipeline.js";
import { commitMaterialUpdate } from "./commitMaterialUpdate.js";
import { fingerprintFurniSpec } from "./approval.js";
import { proposeDesignChange } from "../adapters/aiDesignerTransport.js";

describe("commitMaterialUpdate", () => {
  it("annotates customerFinishKey without breaking catalog finishType", () => {
    const draft = previewDraftWardrobe({
      description: "A 4-door wardrobe, 1800mm wide, white finish",
      specId: "test-material-commit",
      revision: 1,
    });
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
    expect(committed.spec.customerFinishKey).toBe("walnut");
    expect(committed.spec.finishType).toBe("melamine");
    expect(committed.revision).toBe(2);
    expect(committed.proposal.fingerprint).not.toBe(beforeFp);
    expect(committed.proposal.fingerprint).toBe(fingerprintFurniSpec(committed.spec));
    expect(committed.observations.some((o) => o.key === "customerFinishKey" && o.value === "walnut")).toBe(true);
    expect(committed.observations.find((o) => o.key === "finishType")?.value).toBe("melamine");
    expect(committed.partGraph.summary.customerFinishKey).toBe("walnut");
    expect(committed.partGraph.parts.map((p) => p.materialCode)).toEqual(beforeCodes);
  });

  it("fails closed without an active spec", () => {
    const res = commitMaterialUpdate({ materialKey: "walnut", spec: null });
    expect(res.ok).toBe(false);
  });
});

describe("structural edit preserves Walnut (Verifier C)", () => {
  it("width edit after walnut keeps customerFinishKey and advances fingerprint", async () => {
    const draft = previewDraftWardrobe({
      description: "A 4-door wardrobe, 1800mm wide, white finish",
      specId: "verifier-c",
      revision: 1,
    });
    const walnut = commitMaterialUpdate({
      materialKey: "walnut",
      spec: draft.spec,
      partGraph: draft.partGraph,
      observations: draft.observations,
      origins: draft.origins || {},
      revision: draft.spec.revision,
    });
    expect(walnut.ok).toBe(true);
    const fpWalnut = walnut.proposal.fingerprint;

    const res = await proposeDesignChange({
      message: "Make it 2000 mm wide",
      currentObservations: walnut.observations,
      specId: "verifier-c",
      revision: walnut.revision,
      fetchImpl: null,
    });

    expect(res.ok).toBe(true);
    expect(res.kind).toBe("DESIGN_UPDATED");
    expect(res.spec.envelope.widthMm).toBe(2000);
    expect(res.spec.customerFinishKey).toBe("walnut");
    expect(res.spec.finishType).toBe("melamine");
    expect(res.proposal.fingerprint).not.toBe(fpWalnut);
    expect(res.partGraph.summary.customerFinishKey).toBe("walnut");
  });
});
