/**
 * The frontend contract, asserted against the actual public entry point.
 *
 * WHY THIS FILE EXISTS
 *
 * The first draft of docs/m3/AI_DESIGNER_FRONTEND_CONTRACT.md described a
 * transport that does not exist on this branch. It told Antigravity to call
 * `createDesignSession()` / `noteChange()` / `switchDesign()` — none of which
 * are present here — and it documented `result.reply` where the transport
 * returns `assistantReply`, and told the UI to re-render `MATERIAL_UPDATED`
 * from a spec and PartGraph it does not return.
 *
 * A contract nobody can execute is worse than no contract: the UI is written
 * against it, and the mismatch surfaces in a browser rather than in CI. So
 * every statement the document now makes about the transport is asserted here,
 * through `proposeDesignChange` itself. If the transport changes, this file
 * fails before the document becomes a lie.
 *
 * Scope note: this asserts the SHAPE of each result, not the furniture. The
 * geometry is covered by the kernel suites.
 *
 * Evidence class: B — real published entry point, provider stubbed at the HTTP
 * boundary. No credentials, no network, no browser.
 */
import { describe, expect, it, vi } from "vitest";
import { RESULT_KIND, RESULT_SOURCE, proposeDesignChange } from "./aiDesignerTransport.js";
import { previewDraftWardrobe } from "../conversation/pipeline.js";

const SPEC_ID = "furnispec-contract-test";

/** Phrasing the deterministic parser does not recognise, so the model path runs. */
const MODEL_ONLY = "Could you open it up a bit more across the front, please?";

function activeDesign() {
  const draft = previewDraftWardrobe({
    description: "A wardrobe 1800 mm wide, 2400 mm high and 600 mm deep",
    specId: SPEC_ID,
    revision: 1,
  });
  expect(draft.spec, "precondition: the draft exists").toBeTruthy();
  return draft;
}

const fetchReturning = (body, { status = 200 } = {}) =>
  vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body }));

/** Every result carries these, whichever path produced it. */
function assertEnvelope(result) {
  expect(typeof result.ok, "ok must be a boolean").toBe("boolean");
  expect(Object.values(RESULT_KIND), `unknown kind ${result.kind}`).toContain(result.kind);
  expect(Object.values(RESULT_SOURCE)).toContain(result.source);
}

describe("the gate: ok === true AND a committing kind", () => {
  const COMMITTING = [RESULT_KIND.DESIGN_UPDATED, RESULT_KIND.MATERIAL_UPDATED];

  it("DESIGN_UPDATED is ok:true and carries a spec", async () => {
    const design = activeDesign();
    const result = await proposeDesignChange({
      message: "Make it 2000 mm wide",
      currentObservations: design.observations,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl: null,
    });
    assertEnvelope(result);
    expect(result.kind).toBe(RESULT_KIND.DESIGN_UPDATED);
    expect(result.ok).toBe(true);
    expect(result.source).toBe(RESULT_SOURCE.DETERMINISTIC);
    expect(result.spec.envelope.widthMm).toBe(2000);
  });

  it("no non-committing kind ever arrives with ok:true", async () => {
    // This is the single assertion the UI's safety rests on: `ok === true`
    // plus a committing kind. Checking `ok` alone, or `kind` alone, is not it.
    const design = activeDesign();
    const results = [
      await proposeDesignChange({ message: "   ", currentObservations: design.observations, specId: SPEC_ID, revision: 1, fetchImpl: null }),
      await proposeDesignChange({ message: MODEL_ONLY, currentObservations: design.observations, specId: SPEC_ID, revision: 1, fetchImpl: null }),
      await proposeDesignChange({
        message: MODEL_ONLY,
        currentObservations: design.observations,
        specId: SPEC_ID,
        revision: 1,
        fetchImpl: fetchReturning({ ok: true, edits: [], unsupported: [], reply: "Which side did you mean?" }),
      }),
    ];
    for (const result of results) {
      assertEnvelope(result);
      if (!COMMITTING.includes(result.kind)) {
        expect(result.ok, `${result.kind} returned ok:true without being a committing kind`).toBe(false);
      }
    }
  });
});

describe("MATERIAL_UPDATED is a materialKey, not a new design", () => {
  it("returns materialKey and assistantReply, and no spec or PartGraph", async () => {
    const design = activeDesign();
    const result = await proposeDesignChange({
      message: "I would like a light oak finish",
      currentObservations: design.observations,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl: null,
    });
    assertEnvelope(result);
    expect(result.kind).toBe(RESULT_KIND.MATERIAL_UPDATED);
    expect(result.ok).toBe(true);
    expect(typeof result.materialKey).toBe("string");
    expect(result.materialKey.length).toBeGreaterThan(0);
    expect(typeof result.assistantReply).toBe("string");
    // The documented point: the UI reskins what it already has. Demanding a
    // spec here would make the panel wait for geometry that never comes.
    expect(result.spec).toBeUndefined();
    expect(result.partGraph).toBeUndefined();
  });
});

describe("assistantReply versus error, per kind", () => {
  it("REJECTED on an empty message carries error and no assistantReply", async () => {
    const result = await proposeDesignChange({ message: "   ", specId: SPEC_ID, revision: 1, fetchImpl: null });
    assertEnvelope(result);
    expect(result.kind).toBe(RESULT_KIND.REJECTED);
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe("string");
    expect(result.error.length).toBeGreaterThan(0);
  });

  it("DESIGNER_UNAVAILABLE carries error and a code, never an operator note", async () => {
    const design = activeDesign();
    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: design.observations,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl: null, // no transport available in this browser
    });
    assertEnvelope(result);
    expect(result.kind).toBe(RESULT_KIND.DESIGNER_UNAVAILABLE);
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe("string");
    expect(result.error).toMatch(/unchanged/i);
    // Nothing that names a credential or an environment variable.
    expect(JSON.stringify(result)).not.toMatch(/API_KEY|sk-ant|operatorNote/i);
  });

  it("NEEDS_MORE_DETAIL carries assistantReply, and error as a fallback string", async () => {
    const design = activeDesign();
    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: design.observations,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl: fetchReturning({ ok: true, edits: [], unsupported: [], reply: "Which side did you mean?" }),
    });
    assertEnvelope(result);
    expect(result.kind).toBe(RESULT_KIND.NEEDS_MORE_DETAIL);
    expect(result.ok).toBe(false);
    expect(result.assistantReply).toBe("Which side did you mean?");
  });

  it("UNSUPPORTED carries unsupported[] with a customer-readable reason", async () => {
    const design = activeDesign();
    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: design.observations,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl: fetchReturning({
        ok: true,
        edits: [],
        unsupported: [{ request: "a mirrored sliding door", reason: "Sliding doors are not supported yet." }],
        reply: "I can't do that one.",
      }),
    });
    assertEnvelope(result);
    expect(result.kind).toBe(RESULT_KIND.UNSUPPORTED);
    expect(result.ok).toBe(false);
    expect(Array.isArray(result.unsupported)).toBe(true);
    expect(result.unsupported.length).toBeGreaterThan(0);
    expect(typeof result.unsupported[0].reason).toBe("string");
  });
});

describe("STALE_REVISION — the three signals, not a revision number", () => {
  const widen = () =>
    fetchReturning({ ok: true, edits: [{ key: "envelope.widthMm", value: 2000 }], unsupported: [], reply: "Widened." });

  it("refuses an answer after the change token moved, with the revision unchanged", async () => {
    // Undo is the case revision equality gets wrong: revision goes 1 -> 2 -> 1
    // and compares equal, while the change token has moved on twice.
    const design = activeDesign();
    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: design.observations,
      specId: SPEC_ID,
      revision: 1,
      changeToken: 7,
      // GETTERS, not values. See the hazard test below: a plain value silently
      // disables the guard entirely.
      currentDesignId: () => SPEC_ID,
      currentChangeToken: () => 9,
      currentRevision: () => 1,
      fetchImpl: widen(),
    });
    assertEnvelope(result);
    expect(result.kind).toBe(RESULT_KIND.STALE_REVISION);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unchanged/i);
    expect(result.changeTokenAtRequest).toBe(7);
    expect(result.currentChangeToken).toBe(9);
  });

  it("refuses an answer belonging to a design the customer has left", async () => {
    const design = activeDesign();
    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: design.observations,
      specId: SPEC_ID,
      revision: 1,
      currentDesignId: () => "a-different-wardrobe",
      currentRevision: () => 1,
      fetchImpl: widen(),
    });
    assertEnvelope(result);
    expect(result.kind).toBe(RESULT_KIND.STALE_REVISION);
    expect(result.designIdAtRequest).toBe(SPEC_ID);
    expect(result.currentDesignId).toBe("a-different-wardrobe");
  });

  it("fail-closes when live-state args are plain values instead of getters", async () => {
    // isStaleAnswer() activates each signal only when the parameter is a
    // FUNCTION — `typeof currentChangeToken === "function"`. With none of the
    // three passed as a getter it returns false immediately, and a stale
    // answer is applied with no error and no warning.
    //
    // The design reason is sound: a getter is read AFTER the await, so it
    // reflects the live value, where a plain value captured at call time
    // cannot. The hazard is that the wrong type fails open and says nothing.
    //
    // Contract (fail-closed): aiDesignerTransport.js is shared with
    // Antigravity. The proposed correction — throw on a non-function, or
    // accept values and compare them — is in the contract document for
    // agreement first. Until then the getter form is mandatory, not stylistic.
    const design = activeDesign();
    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: design.observations,
      specId: SPEC_ID,
      revision: 1,
      changeToken: 7,
      currentDesignId: "a-different-wardrobe", // plain value: guard OFF
      currentChangeToken: 9999,
      currentRevision: 1,
      fetchImpl: widen(),
    });

    expect(result.ok).toBe(false);
    expect(result.kind).toBe(RESULT_KIND.STALE_REVISION);
    expect(result.spec).toBeUndefined();
    expect(result.error).toMatch(/getter function/i);
  });

  it("applies the answer when nothing moved — the guard is not a blanket refusal", async () => {
    const design = activeDesign();
    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: design.observations,
      specId: SPEC_ID,
      revision: 1,
      changeToken: 4,
      currentDesignId: () => SPEC_ID,
      currentChangeToken: () => 4,
      currentRevision: () => 1,
      fetchImpl: widen(),
    });
    assertEnvelope(result);
    expect(result.kind).toBe(RESULT_KIND.DESIGN_UPDATED);
    expect(result.ok).toBe(true);
    expect(result.spec.envelope.widthMm).toBe(2000);
  });
});


  it("fail-closes when a live-state getter throws", async () => {
    const design = activeDesign();
    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: design.observations,
      specId: SPEC_ID,
      revision: 1,
      changeToken: 1,
      currentDesignId: () => SPEC_ID,
      currentChangeToken: () => {
        throw new Error("token reader boom");
      },
      fetchImpl: fetchReturning({
        ok: true,
        provider: "anthropic",
        edits: [{ key: "envelope.widthMm", value: 2000 }],
        reply: "Opened to 2000 mm.",
        unsupported: [],
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.kind).toBe(RESULT_KIND.STALE_REVISION);
    expect(result.spec == null).toBe(true);
    expect(result.partGraph == null).toBe(true);
  });

describe("provider identity", () => {
  it("labels the deterministic path 'rules', which is not a model at all", async () => {
    const design = activeDesign();
    const result = await proposeDesignChange({
      message: "Make it 2000 mm wide",
      currentObservations: design.observations,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl: null,
    });
    expect(result.provider).toBe("rules");
    expect(result.isMock).toBe(false);
  });

  it("passes the server's provider through when the server states one", async () => {
    const design = activeDesign();
    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: design.observations,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl: fetchReturning({
        ok: true,
        provider: "openai",
        edits: [{ key: "envelope.widthMm", value: 2000 }],
        unsupported: [],
        reply: "Widened.",
      }),
    });
    expect(result.provider).toBe("openai");
  });

  it("defaults provider to ai when the server states none", async () => {
    // `modelProvider = payload?.provider || (payload?.mock ? "mock" : "anthropic")`.
    // A server that does not echo `provider` — which is the default, since the
    // endpoint only includes it behind shouldExposeProviderDebugInfo() — makes
    // the browser label an OpenAI failover response "anthropic".
    //
    // Contract (neutral ai): aiDesignerTransport.js is
    // shared with Antigravity, and the correction ("ai" or "unknown") is
    // proposed in the contract document for agreement first. The test is the
    // reason the UI must NOT display result.provider to a customer.
    const design = activeDesign();
    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: design.observations,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl: fetchReturning({
        ok: true,
        edits: [{ key: "envelope.widthMm", value: 2000 }],
        unsupported: [],
        reply: "Widened.",
      }),
    });
    expect(result.provider).toBe("ai");
    expect(result.isMock).toBe(false);
  });
});

describe("failure never carries a design with it", () => {
  it("a thrown fetch becomes DESIGNER_UNAVAILABLE rather than a rejected promise", async () => {
    const design = activeDesign();
    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: design.observations,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl: vi.fn(async () => {
        throw new Error("socket hang up");
      }),
    });
    assertEnvelope(result);
    expect(result.kind).toBe(RESULT_KIND.DESIGNER_UNAVAILABLE);
    expect(result.code).toBe("NETWORK_ERROR");
  });

  it("an HTTP 500 becomes DESIGNER_UNAVAILABLE with a code", async () => {
    const design = activeDesign();
    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: design.observations,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl: fetchReturning({ ok: false, error: "upstream failed" }, { status: 500 }),
    });
    assertEnvelope(result);
    expect(result.kind).toBe(RESULT_KIND.DESIGNER_UNAVAILABLE);
    expect(typeof result.code).toBe("string");
  });

  it("carries no spec on any non-committing result", async () => {
    const design = activeDesign();
    const failures = [
      await proposeDesignChange({ message: "   ", specId: SPEC_ID, revision: 1, fetchImpl: null }),
      await proposeDesignChange({ message: MODEL_ONLY, currentObservations: design.observations, specId: SPEC_ID, revision: 1, fetchImpl: null }),
      await proposeDesignChange({
        message: MODEL_ONLY,
        currentObservations: design.observations,
        specId: SPEC_ID,
        revision: 1,
        currentDesignId: () => "elsewhere",
        currentRevision: () => 1,
        fetchImpl: fetchReturning({ ok: true, edits: [{ key: "envelope.widthMm", value: 2000 }], unsupported: [], reply: "x" }),
      }),
    ];
    for (const result of failures) {
      expect(result.ok).toBe(false);
      // NOTE: absent, not explicitly null. The contract must not promise a
      // null field the transport does not set.
      expect(result.spec ?? null, `${result.kind} carried a spec`).toBeNull();
    }
  });
});
