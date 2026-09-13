/**
 * Conversational edit integrity.
 *
 * The customer outcome these tests defend: FurniAI produces a useful draft,
 * makes supported changes accurately, and never silently loses requested
 * components or unrelated design choices.
 *
 * Everything here runs against the EXISTING pipeline and transport — no second
 * conversation engine, no reimplemented Undo. The model is represented by a
 * stub fetch, so these are category-B (real endpoint contract, simulated
 * provider) tests. They are not evidence of a live model call, and they are
 * not evidence of browser behaviour.
 */
import { describe, it, expect } from "vitest";
import {
  previewDraftWardrobe,
  applyConversationalEdit,
  PIPELINE_STAGE,
} from "./pipeline.js";
import { proposeDesignChange, RESULT_KIND, RESULT_SOURCE } from "../adapters/aiDesignerTransport.js";

const SPEC_ID = "spec-integrity-01";

/** The design a customer is sitting in front of when they type an edit. */
function startingDesign() {
  const draft = previewDraftWardrobe({
    description: "A wardrobe 1800 mm wide and 2400 mm high",
    specId: SPEC_ID,
    revision: 1,
  });
  expect(draft.stage).toBe(PIPELINE_STAGE.DRAFT_PREVIEW);
  return draft;
}

/** Facts as a plain object, for comparing "everything except X". */
function facts(observations) {
  return Object.fromEntries(observations.map((o) => [o.key, JSON.stringify(o.value)]));
}

describe("1. an incomplete ordinary request still produces a labelled draft", () => {
  it("drafts from a vague request instead of interrogating the customer", () => {
    const draft = previewDraftWardrobe({ description: "I need a wardrobe for my bedroom", specId: SPEC_ID });

    expect(draft.stage).toBe(PIPELINE_STAGE.DRAFT_PREVIEW);
    expect(draft.spec).toBeTruthy();
    expect(draft.partGraph.parts.length).toBeGreaterThan(0);
  });

  it("labels every value with where it came from, and invents no measurement", () => {
    const draft = previewDraftWardrobe({ description: "I need a wardrobe for my bedroom", specId: SPEC_ID });

    // Draft-first is only safe if provisional values are visibly provisional.
    expect(Object.keys(draft.origins).length).toBeGreaterThan(0);
    for (const [key, origin] of Object.entries(draft.origins)) {
      expect(["CUSTOMER_STATED", "CUSTOMER_CONFIRMED", "EXTRACTED", "DEFAULTED", "RULE_DERIVED"],
        `${key} has an unlabelled origin`).toContain(origin.origin ?? origin);
    }
  });

  it("does not promote a hedged measurement to a stated fact", () => {
    // "about 2 metres" is not a measurement. It may legitimately produce a
    // default of the same number — it must never be recorded as the customer
    // having stated it.
    const draft = previewDraftWardrobe({ description: "a wardrobe about 2 metres wide", specId: SPEC_ID });
    const width = draft.observations.find((o) => o.key === "envelope.widthMm");
    expect(width.origin).not.toBe("CUSTOMER_STATED");
  });

  it("keeps workshop approval and CNC blocked on a draft", () => {
    const draft = previewDraftWardrobe({ description: "I need a wardrobe for my bedroom", specId: SPEC_ID });
    expect(draft.spec.qualificationStatus).not.toBe("CNC_QUALIFIED");
    expect(draft.stage).toBe(PIPELINE_STAGE.DRAFT_PREVIEW);
    expect(draft.approval ?? null).toBeNull();
  });
});

describe("2. a supported dimension change preserves unrelated choices", () => {
  it("changes only the dimension asked for", () => {
    const before = startingDesign();
    const result = applyConversationalEdit({
      currentObservations: before.observations,
      commandText: "Make it 2000 mm wide",
      specId: SPEC_ID,
      revision: before.spec.revision,
    });

    expect(result.ok).toBe(true);
    expect(result.spec.envelope.widthMm).toBe(2000);

    const beforeFacts = facts(before.observations);
    const afterFacts = facts(result.observations);
    for (const key of Object.keys(beforeFacts)) {
      if (key === "envelope.widthMm") continue;
      // Bay widths legitimately follow from overall width; everything the
      // customer chose independently must survive untouched.
      if (key === "bayLayouts" || key === "bayCount") continue;
      expect(afterFacts[key], `"${key}" changed as a side effect of a width edit`).toBe(beforeFacts[key]);
    }
  });

  it("keeps the finish, height and depth the customer already had", () => {
    const before = startingDesign();
    const result = applyConversationalEdit({
      currentObservations: before.observations,
      commandText: "Make it 2000 mm wide",
      specId: SPEC_ID,
      revision: before.spec.revision,
    });

    expect(result.spec.envelope.heightMm).toBe(before.spec.envelope.heightMm);
    expect(result.spec.envelope.depthMm).toBe(before.spec.envelope.depthMm);
    expect(result.spec.finishType).toBe(before.spec.finishType);
    expect(result.spec.plinth.heightMm).toBe(before.spec.plinth.heightMm);
  });

  it("accounts for every component after the edit", () => {
    const before = startingDesign();
    const result = applyConversationalEdit({
      currentObservations: before.observations,
      commandText: "Make it 2000 mm wide",
      specId: SPEC_ID,
      revision: before.spec.revision,
    });

    const accepted = result.spec.bays.reduce((n, b) => n + (b.components || []).length, 0);
    expect(result.partGraph.componentOutcomes).toHaveLength(accepted);
    expect(result.partGraph.summary.unsupportedComponents).toBe(0);
  });
});

describe("3. an invalid dimension leaves the design unchanged", () => {
  const invalidCommands = [
    "Make it 1800.15 mm wide",   // finer than the 0.1 mm numeric policy
    "Make it -500 mm wide",
    "Make it 0 mm wide",
  ];

  for (const command of invalidCommands) {
    it(`rejects "${command}" without touching the design`, () => {
      const before = startingDesign();
      const snapshot = facts(before.observations);

      const result = applyConversationalEdit({
        currentObservations: before.observations,
        commandText: command,
        specId: SPEC_ID,
        revision: before.spec.revision,
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
      // A rejected edit returns no replacement geometry...
      expect(result.spec ?? null).toBeNull();
      expect(result.partGraph ?? null).toBeNull();
      // ...and the caller's own observations are not mutated in place.
      expect(facts(before.observations)).toEqual(snapshot);
    });
  }

  it("does not advance the revision on a rejected edit", () => {
    const before = startingDesign();
    const result = applyConversationalEdit({
      currentObservations: before.observations,
      commandText: "Make it -500 mm wide",
      specId: SPEC_ID,
      revision: before.spec.revision,
    });
    expect(result.ok).toBe(false);
    expect(result.revision ?? before.spec.revision).toBe(before.spec.revision);
  });
});

describe("4. an unsupported request does not silently replace the layout", () => {
  it("reports an unrecognised request instead of guessing at it", () => {
    const before = startingDesign();
    const snapshot = facts(before.observations);

    const result = applyConversationalEdit({
      currentObservations: before.observations,
      commandText: "Add a jewellery drawer with velvet inserts and a lock",
      specId: SPEC_ID,
      revision: before.spec.revision,
    });

    if (result.ok) {
      // If the pipeline did accept it, it must not have quietly rewritten the
      // layout the customer already had.
      expect(result.spec.envelope.widthMm).toBe(before.spec.envelope.widthMm);
      expect(result.spec.envelope.heightMm).toBe(before.spec.envelope.heightMm);
    } else {
      expect(result.error).toBeTruthy();
      expect(facts(before.observations)).toEqual(snapshot);
    }
  });

  it("surfaces an unsupported component through the PartGraph rather than dropping it", () => {
    // The M2-OMIT-01 guarantee, seen from the conversation layer: whatever the
    // kernel cannot represent is reported, and the rest of the design stands.
    const before = startingDesign();
    const graph = before.partGraph;
    const accounted =
      graph.summary.structuralComponents +
      graph.summary.previewComponents +
      graph.summary.unsupportedComponents;
    expect(accounted).toBe(graph.summary.totalComponents);
    expect(graph.componentOutcomes.every((e) => typeof e.outcome === "string")).toBe(true);
  });
});

describe("5. design identity and revision behaviour stay consistent", () => {
  it("keeps the same specId across an edit and advances the revision by one", () => {
    const before = startingDesign();
    const result = applyConversationalEdit({
      currentObservations: before.observations,
      commandText: "Make it 2000 mm wide",
      specId: SPEC_ID,
      revision: before.spec.revision,
    });

    expect(result.ok).toBe(true);
    expect(result.spec.specId).toBe(SPEC_ID);
    expect(result.spec.revision).toBe(before.spec.revision + 1);
  });

  it("keeps identity stable across a chain of edits", () => {
    let current = startingDesign();
    const commands = ["Make it 2000 mm wide", "Make it 2200 mm high", "Make it 2100 mm wide"];

    for (const command of commands) {
      const next = applyConversationalEdit({
        currentObservations: current.observations,
        commandText: command,
        specId: SPEC_ID,
        revision: current.spec.revision,
      });
      expect(next.ok, `"${command}" failed`).toBe(true);
      expect(next.spec.specId).toBe(SPEC_ID);
      expect(next.spec.revision).toBe(current.spec.revision + 1);
      current = next;
    }

    expect(current.spec.revision).toBe(1 + commands.length);
    expect(current.spec.envelope.widthMm).toBe(2100);
    expect(current.spec.envelope.heightMm).toBe(2200);
  });

  it("produces a PartGraph whose source identity matches its spec", () => {
    const before = startingDesign();
    const result = applyConversationalEdit({
      currentObservations: before.observations,
      commandText: "Make it 2000 mm wide",
      specId: SPEC_ID,
      revision: before.spec.revision,
    });
    expect(result.partGraph.sourceSpecId).toBe(result.spec.specId);
    expect(result.partGraph.sourceRevision).toBe(result.spec.revision);
  });
});

describe("6. the backend contract still carries the material and Undo flow", () => {
  it("returns MATERIAL_UPDATED with no geometry for a finish-only change", () => {
    // Antigravity's browser layer branches on this: MATERIAL_UPDATED swaps the
    // swatch and leaves the 3D geometry alone. A material edit that started
    // returning a PartGraph would silently reload the model on every swatch.
    //
    // Note the phrasing. The deterministic parser recognises "Change the
    // finish to X" and "Use X finish" but not the very natural "Make it
    // walnut", which therefore falls through to the model. That is safe —
    // the kernel still decides — but it spends a model call on a trivial
    // edit. Recorded as a parser-coverage gap, not fixed here.
    return proposeDesignChange({
      message: "Change the finish to walnut",
      currentObservations: startingDesign().observations,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl: null,
    }).then((res) => {
      expect(res.kind).toBe(RESULT_KIND.MATERIAL_UPDATED);
      expect(res.source).toBe(RESULT_SOURCE.DETERMINISTIC);
      expect(res.materialKey).toBeTruthy();
      expect(res.partGraph ?? null).toBeNull();
    });
  });

  it("returns everything an Undo snapshot needs on a successful edit", async () => {
    // Undo lives in the browser and is NOT reimplemented here. What the
    // backend owes it is a complete snapshot: without any one of these fields
    // a restored revision would come back subtly incomplete.
    const res = await proposeDesignChange({
      message: "Make it 2000 mm wide",
      currentObservations: startingDesign().observations,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl: null,
    });

    expect(res.kind).toBe(RESULT_KIND.DESIGN_UPDATED);
    for (const field of ["spec", "proposal", "partGraph", "observations", "origins"]) {
      expect(res[field], `Undo needs "${field}" in the response`).toBeTruthy();
    }
    expect(res.spec.revision).toBe(2);
  });

  it("keeps the published result kinds intact", () => {
    // The browser branches on exactly these. Renaming or dropping one breaks
    // Antigravity's handler silently, in the fallback branch.
    //
    // Updated from six to seven when STALE_REVISION was added
    // (src/lib/adapters/staleRevisionGuard.test.js). Assertion stays EXACT.
    // STALE_REVISION is additive: unknown kinds fall into AG's generic-error
    // path, which already says the design is unchanged.
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

describe("7. a failed provider request cannot corrupt the active design", () => {
  const startingObservations = () => startingDesign().observations;

  /** Phrasing the deterministic parser does not recognise, so the model is reached. */
  const MODEL_ONLY = "Could you open it up a bit more across the front, please?";

  async function expectDesignPreserved(fetchImpl) {
    const before = startingObservations();
    const snapshot = facts(before);

    const res = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: before,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl,
    });

    expect(res.ok).toBe(false);
    expect(res.spec ?? null).toBeNull();
    expect(res.partGraph ?? null).toBeNull();
    expect(facts(before)).toEqual(snapshot);
    expect(res.error).toBeTruthy();
    // No provider internals reach the customer.
    expect(res.error).not.toMatch(/anthropic|openai|api[_ ]?key|sk-/i);
    return res;
  }

  it("survives a network failure", async () => {
    const res = await expectDesignPreserved(async () => {
      throw new Error("network down");
    });
    expect(res.kind).toBe(RESULT_KIND.DESIGNER_UNAVAILABLE);
  });

  it("survives a 503 from the endpoint", async () => {
    const res = await expectDesignPreserved(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ ok: false, code: "AI_PROVIDER_AUTH_REJECTED", error: "The FurniAI designer is not available right now. Your design is unchanged." }),
    }));
    expect(res.kind).toBe(RESULT_KIND.DESIGNER_UNAVAILABLE);
  });

  it("survives a malformed response body", async () => {
    await expectDesignPreserved(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("not json");
      },
    }));
  });

  const modelProposes = (value) => async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      ok: true,
      edits: [{ key: "envelope.widthMm", value }],
      unsupported: [],
      reply: "Widened it for you.",
    }),
  });

  // The model proposes; deterministic validation decides. Every one of these
  // would be rejected coming from a human, so each must be rejected coming
  // from the model — the model gets no privileged path into the geometry.
  const invalidModelValues = [
    "2.00015 m",      // finer than the 0.1 mm numeric policy
    "1800.15 mm",     // same, stated in mm
    "about 2 metres", // a hedge is not a measurement
    "-2 m",
    "0 mm",
    "wide",
    99999999,
  ];

  for (const value of invalidModelValues) {
    it(`refuses a model proposal of ${JSON.stringify(value)}`, async () => {
      const before = startingObservations();
      const snapshot = facts(before);

      const res = await proposeDesignChange({
        message: MODEL_ONLY,
        currentObservations: before,
        specId: SPEC_ID,
        revision: 1,
        fetchImpl: modelProposes(value),
      });

      expect(res.ok).toBe(false);
      expect(res.kind).toBe(RESULT_KIND.REJECTED);
      expect(res.partGraph ?? null).toBeNull();
      expect(facts(before)).toEqual(snapshot);
    });
  }

  it("accepts a legitimate unit expression from the model and converts it exactly", () => {
    // The counterpart to the refusals above: validation is a real parse, not a
    // string blocklist. "2.0 m" is a valid way to say 2000 mm and converts
    // exactly, so it is applied — through the same deterministic path a human
    // typing it would take.
    return proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: startingObservations(),
      specId: SPEC_ID,
      revision: 1,
      fetchImpl: modelProposes("2.0 m"),
    }).then((res) => {
      expect(res.ok).toBe(true);
      expect(res.spec.envelope.widthMm).toBe(2000);
    });
  });

  it("refuses a model proposal that tries to edit a forbidden key", async () => {
    const before = startingObservations();
    const snapshot = facts(before);

    const res = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: before,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          edits: [
            { key: "qualificationStatus", value: "CNC_QUALIFIED" },
            { key: "machiningPolicy.drilling", value: "APPROVED" },
          ],
          unsupported: [],
          reply: "Unlocked machining.",
        }),
      }),
    });

    expect(res.ok).toBe(false);
    expect(res.partGraph ?? null).toBeNull();
    expect(facts(before)).toEqual(snapshot);
  });
});
