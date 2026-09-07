/**
 * The six verification scenarios for connecting the existing designer to a
 * live model. The provider is mocked at the HTTP boundary throughout, so
 * these run with no credentials and no network.
 */
import { describe, expect, it, vi } from "vitest";
import { RESULT_KIND, RESULT_SOURCE, proposeDesignChange } from "./aiDesignerTransport.js";
import { previewDraftWardrobe } from "../conversation/pipeline.js";
import { BEKZOD_APPROVED_DEFAULTS, OBSERVATION_ORIGIN, observation } from "../conversation/intakeModel.js";

const SPEC_ID = "furnispec-live-designer-test";

/** The active design a customer already has on screen. */
function activeDesign(overrides = {}) {
  const facts = { ...BEKZOD_APPROVED_DEFAULTS, ...overrides };
  return Object.entries(facts).map(([k, v]) =>
    observation(k, Array.isArray(v) ? [...v] : v, OBSERVATION_ORIGIN.CUSTOMER_CONFIRMED, { sourceText: "active design" })
  );
}

function fetchReturning(body, { status = 200 } = {}) {
  return vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body }));
}
const neverCalled = () => vi.fn(async () => { throw new Error("the network must not be used here"); });

describe("1. a vague request produces a defaulted wardrobe draft", () => {
  it("fills every required fact from the recorded approved defaults and builds geometry", () => {
    const draft = previewDraftWardrobe({ description: "I need a wardrobe for my bedroom", specId: SPEC_ID, revision: 1 });
    expect(draft.spec).toBeTruthy();
    expect(draft.validation.valid).toBe(true);
    expect(draft.partGraph.summary.totalStructuralParts).toBe(19);
    expect(draft.spec.envelope.widthMm).toBe(BEKZOD_APPROVED_DEFAULTS["envelope.widthMm"]);
    expect(draft.spec.envelope.heightMm).toBe(BEKZOD_APPROVED_DEFAULTS["envelope.heightMm"]);
    expect(draft.spec.status).not.toBe("APPROVED");
  });
});

describe("2. differently worded width requests all update correctly", () => {
  const phrasings = [
    ["Make it 2000 mm wide", 2000],
    ["width 2000", 2000],
    ["2.1m wide", 2100],
    ["make it 2000mm wide please", 2000],
  ];

  for (const [text, expected] of phrasings) {
    it(`"${text}" -> ${expected} mm, with no model call`, async () => {
      const fetchImpl = neverCalled();
      const result = await proposeDesignChange({
        message: text,
        currentObservations: activeDesign(),
        specId: SPEC_ID,
        revision: 1,
        fetchImpl,
      });
      expect(result.ok).toBe(true);
      expect(result.source).toBe(RESULT_SOURCE.DETERMINISTIC);
      expect(result.spec.envelope.widthMm).toBe(expected);
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  }

  it("keeps the same design identity and every unrelated choice", async () => {
    const before = activeDesign({ "envelope.depthMm": 600.0, finishType: "melamine" });
    const result = await proposeDesignChange({
      message: "Make it 2000 mm wide",
      currentObservations: before,
      specId: SPEC_ID,
      revision: 3,
      fetchImpl: neverCalled(),
    });
    expect(result.spec.specId).toBe(SPEC_ID);
    expect(result.spec.revision).toBe(4);
    expect(result.spec.envelope.heightMm).toBe(BEKZOD_APPROVED_DEFAULTS["envelope.heightMm"]);
    expect(result.spec.envelope.depthMm).toBe(600.0);
    expect(result.spec.finishType).toBe("melamine");
    expect(result.spec.bays).toHaveLength(BEKZOD_APPROVED_DEFAULTS.bayCount);
  });
});

describe("3. an unsupported request gets an honest alternative, not a substitution", () => {
  it("surfaces the reason and the alternative and changes nothing", async () => {
    const before = activeDesign();
    const fetchImpl = fetchReturning({
      ok: true,
      edits: [],
      unsupported: [
        {
          request: "one shelf spanning the full 1800 mm",
          reason: "An 18 mm shelf sags past 800 mm of clear span, so a 1746 mm shelf would bow under load.",
          alternative: "Keep the centre divider so each shelf spans 873 mm, or move to a 25 mm board.",
        },
      ],
      reply: "A shelf that wide would sag — shall I keep the divider so each side spans 873 mm?",
    });

    const result = await proposeDesignChange({
      message: "can you run one long shelf right across the whole thing",
      currentObservations: before,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl,
    });

    expect(result.ok).toBe(false);
    expect(result.kind).toBe(RESULT_KIND.UNSUPPORTED);
    expect(result.unsupported[0].alternative).toContain("873");
    expect(result.assistantReply).toContain("sag");
    expect(result.spec).toBeUndefined();
    expect(result.partGraph).toBeUndefined();
    expect(before).toEqual(activeDesign());
  });
});

describe("4. an invalid edit leaves the previous design untouched", () => {
  it("rejects a negative dimension deterministically", async () => {
    const before = activeDesign();
    const snapshot = JSON.stringify(before);
    const fetchImpl = neverCalled();

    const result = await proposeDesignChange({
      message: "Make it -2000 mm wide",
      currentObservations: before,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl,
    });

    expect(result.ok).toBe(false);
    expect(result.kind).toBe(RESULT_KIND.REJECTED);
    expect(result.error).toBeTruthy();
    expect(result.partGraph).toBeUndefined();
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a model proposal the kernel cannot close, without touching the design", async () => {
    const before = activeDesign();
    const snapshot = JSON.stringify(before);
    // 1800.1 mm leaves 1746.1 mm of clear width, which cannot be split into
    // two bays at exact 0.1 mm precision. No approved rule distributes the
    // remainder, so the kernel refuses rather than rounding.
    const fetchImpl = fetchReturning({ ok: true, edits: [{ key: "envelope.widthMm", value: 1800.1 }], unsupported: [], reply: "Nudged it." });

    const result = await proposeDesignChange({
      message: "nudge it a hair wider",
      currentObservations: before,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl,
    });

    expect(result.ok).toBe(false);
    expect(result.kind).toBe(RESULT_KIND.REJECTED);
    expect(result.partGraph).toBeFalsy();
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("KNOWN GAP — no minimum-plausibility rule exists yet, so a 300 mm wardrobe still validates", async () => {
    // Characterisation test, not an endorsement. 300 mm closes arithmetically
    // (2 bays of 123 mm, 4 doors of 72.5 mm) and the validator has no rule
    // about minimum usable sizes, so it passes. Reported to Bekzod: a hanging
    // bay needs real internal width and a 72.5 mm door is not a door. When a
    // minimum-plausibility rule is added to the Rulebook, this test should
    // flip to expecting a rejection.
    const fetchImpl = fetchReturning({ ok: true, edits: [{ key: "envelope.widthMm", value: 300 }], unsupported: [], reply: "Narrowed." });
    const result = await proposeDesignChange({
      message: "shrink it right down to something tiny",
      currentObservations: activeDesign(),
      specId: SPEC_ID,
      revision: 1,
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    expect(result.spec.doors.finishedWidthMm).toBe(72.5);
  });

  it("never lets the model write a kernel-owned field even if the server leaked one", async () => {
    const before = activeDesign();
    const fetchImpl = fetchReturning({
      ok: true,
      edits: [{ key: "partGraph", value: { parts: [] } }, { key: "envelope.widthMm", value: 2000 }],
      unsupported: [],
      reply: "Done.",
    });
    const result = await proposeDesignChange({
      message: "just build whatever you think",
      currentObservations: before,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl,
    });
    // The width still applies; the forbidden key is simply not a thing the
    // adapter can express, so it cannot reach the kernel.
    expect(result.ok).toBe(true);
    expect(result.spec.envelope.widthMm).toBe(2000);
    expect(JSON.stringify(result.partGraph)).not.toContain('"parts":[]');
  });
});

describe("5. a provider failure produces a clear, honest user-facing result", () => {
  it("reports the outage and leaves the design alone", async () => {
    const before = activeDesign();
    const fetchImpl = fetchReturning(
      { ok: false, code: "AI_PROVIDER_UNAVAILABLE", error: "The FurniAI designer is not available right now. Your design is unchanged — you can keep editing it directly." },
      { status: 503 }
    );

    const result = await proposeDesignChange({
      message: "could you make this feel a bit more open",
      currentObservations: before,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl,
    });

    expect(result.ok).toBe(false);
    expect(result.kind).toBe(RESULT_KIND.DESIGNER_UNAVAILABLE);
    expect(result.code).toBe("AI_PROVIDER_UNAVAILABLE");
    expect(result.error).toContain("unchanged");
    expect(result.partGraph).toBeUndefined();
  });

  it("survives a thrown network error and an unparseable body", async () => {
    const before = activeDesign();
    const thrown = await proposeDesignChange({
      message: "make this feel more open",
      currentObservations: before,
      specId: SPEC_ID,
      fetchImpl: vi.fn(async () => { throw new TypeError("Failed to fetch"); }),
    });
    expect(thrown.ok).toBe(false);
    expect(thrown.code).toBe("NETWORK_ERROR");
    expect(thrown.error).toContain("unchanged");

    const garbage = await proposeDesignChange({
      message: "make this feel more open",
      currentObservations: before,
      specId: SPEC_ID,
      fetchImpl: vi.fn(async () => ({ ok: true, status: 200, json: async () => { throw new Error("not json"); } })),
    });
    expect(garbage.ok).toBe(false);
    expect(garbage.kind).toBe(RESULT_KIND.DESIGNER_UNAVAILABLE);
  });

  it("says so plainly when the browser has no fetch at all", async () => {
    const result = await proposeDesignChange({
      message: "make this feel more open",
      currentObservations: activeDesign(),
      specId: SPEC_ID,
      fetchImpl: null,
    });
    expect(result.kind).toBe(RESULT_KIND.DESIGNER_UNAVAILABLE);
  });
});

describe("6. a live model response becomes a validated FurniSpec and a PartGraph", () => {
  it("routes model-proposed edits through the deterministic kernel to 19 parts", async () => {
    const before = activeDesign();
    const fetchImpl = fetchReturning({
      ok: true,
      edits: [
        { key: "envelope.widthMm", value: "2.0 m", sourceText: "two metres across" },
        { key: "envelope.heightMm", value: 2400, sourceText: "same height" },
      ],
      unsupported: [],
      reply: "Taken it out to 2 m across.",
    });

    const result = await proposeDesignChange({
      message: "could you take it out to two metres across please",
      currentObservations: before,
      specId: SPEC_ID,
      revision: 2,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0];
    expect(JSON.parse(init.body).currentFacts["envelope.widthMm"]).toBe(1800);

    expect(result.ok).toBe(true);
    expect(result.source).toBe(RESULT_SOURCE.MODEL);
    expect(result.kind).toBe(RESULT_KIND.DESIGN_UPDATED);
    expect(result.validation.valid).toBe(true);
    expect(result.spec.envelope.widthMm).toBe(2000);
    expect(result.spec.specId).toBe(SPEC_ID);
    expect(result.spec.revision).toBe(3);
    expect(result.partGraph.summary.totalStructuralParts).toBe(19);
    expect(result.assistantReply).toContain("2 m");
  });

  it("keeps the draft unapproved and CNC and drilling blocked", async () => {
    const fetchImpl = fetchReturning({ ok: true, edits: [{ key: "envelope.widthMm", value: 2000 }], unsupported: [], reply: "Done." });
    const result = await proposeDesignChange({
      message: "could you take it out to two metres across please",
      currentObservations: activeDesign(),
      specId: SPEC_ID,
      revision: 1,
      fetchImpl,
    });
    expect(result.spec.status).not.toBe("APPROVED");
    expect(result.spec.qualificationStatus).toBe("WORKSHOP_REVIEW_NOT_CNC_QUALIFIED");
    expect(result.spec.machiningPolicy.drilling).toBe("BLOCKED_PENDING_HARDWARE_APPROVAL");
    expect(result.safety.approvalState).not.toBe("APPROVED");
    expect(JSON.stringify(result.partGraph)).not.toMatch(/DRILL|HINGE_CUP|PIN_HOLE|GCODE/i);
  });

  it("applies a finish-only change without regenerating geometry", async () => {
    const fetchImpl = fetchReturning({ ok: true, edits: [{ key: "materialKey", value: "Oak" }], unsupported: [], reply: "Oak it is." });
    const result = await proposeDesignChange({
      message: "warm it up a bit",
      currentObservations: activeDesign(),
      specId: SPEC_ID,
      revision: 1,
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    expect(result.kind).toBe(RESULT_KIND.MATERIAL_UPDATED);
    expect(result.materialKey).toBe("oak");
    expect(result.partGraph).toBeUndefined();
  });
});
