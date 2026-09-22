/**
 * Live-state guard READERS — the failure mode the contract suite did not reach.
 *
 * WHY THIS FILE EXISTS
 *
 * `frontendContract.test.js` already pins what happens when the live-state
 * guards are passed the WRONG KIND of argument: a plain value instead of a
 * getter fails closed as STALE_REVISION. What nothing asserted is what
 * happens when the argument is the right kind and the CALL ITSELF FAILS —
 * a getter that throws because the UI store was torn down, the component
 * unmounted, or a revoked proxy sat behind it.
 *
 * That case was not safe-but-untested; it was wrong. The throw escaped the
 * stale check into the surrounding network try/catch, so a broken browser
 * guard was reported to the customer and to the operator as
 * `DESIGNER_UNAVAILABLE` / `NETWORK_ERROR`. The design was preserved — the
 * result was non-committing either way — but the evidence was false: nothing
 * was unreachable and no provider had failed. An operator reading that as a
 * provider outage would investigate the wrong system entirely.
 *
 * Both properties are asserted here: it fails CLOSED, and it says WHY
 * truthfully.
 *
 * Evidence class: B — real published entry point, provider stubbed at the HTTP
 * boundary. No credentials, no network, no browser.
 */
import { describe, expect, it, vi } from "vitest";
import {
  RESULT_KIND,
  RESULT_SOURCE,
  proposeDesignChange,
  readLiveStateGuards,
} from "./aiDesignerTransport.js";
import { previewDraftWardrobe } from "../conversation/pipeline.js";

const SPEC_ID = "furnispec-guard-reader-test";

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

/** A server answer that WOULD widen the design to 2000 mm if it were applied. */
const widen = () =>
  vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      ok: true,
      edits: [{ key: "envelope.widthMm", value: 2000 }],
      unsupported: [],
      rejected: [],
      reply: "Widened to 2.0 m.",
    }),
  }));

describe("readLiveStateGuards — one read, and a throw is caught", () => {
  it("reads each supplied getter exactly once", () => {
    const id = vi.fn(() => "design-a");
    const token = vi.fn(() => 7);
    const rev = vi.fn(() => 3);

    const read = readLiveStateGuards({
      currentDesignId: id,
      currentChangeToken: token,
      currentRevision: rev,
    });

    expect(read.failure).toBeUndefined();
    expect(read.liveDesignId).toBe("design-a");
    expect(read.liveChangeToken).toBe(7);
    expect(read.liveRevision).toBe(3);
    expect(id).toHaveBeenCalledTimes(1);
    expect(token).toHaveBeenCalledTimes(1);
    expect(rev).toHaveBeenCalledTimes(1);
  });

  it("leaves an unsupplied getter undefined rather than inventing a value", () => {
    const read = readLiveStateGuards({ currentChangeToken: () => 4 });
    expect(read.failure).toBeUndefined();
    expect(read.liveChangeToken).toBe(4);
    expect(read.liveDesignId).toBeUndefined();
    expect(read.liveRevision).toBeUndefined();
  });

  it.each([
    ["currentDesignId"],
    ["currentChangeToken"],
    ["currentRevision"],
  ])("turns a throwing %s into a non-committing refusal that names it", (name) => {
    const read = readLiveStateGuards({
      [name]: () => {
        throw new TypeError("store torn down");
      },
    });

    expect(read.failure, "a throwing getter must not escape").toBeTruthy();
    expect(read.failure.ok).toBe(false);
    expect(read.failure.kind).toBe(RESULT_KIND.STALE_REVISION);
    expect(read.failure.guardParameter).toBe(name);
    expect(read.failure.guardThrew).toBe(true);
    expect(read.failure.guardErrorName).toBe("TypeError");
  });

  it("does not let the thrown error's message reach the result", () => {
    const read = readLiveStateGuards({
      currentDesignId: () => {
        throw new Error("secret-bearing internal detail sk-ant-EXAMPLE");
      },
    });
    expect(JSON.stringify(read.failure)).not.toMatch(/secret-bearing|sk-ant/);
  });
});

describe("a half-configured guard fails closed AND names the missing half", () => {
  // These refusals were already happening on this branch — isStaleAnswer
  // refuses whenever it cannot evaluate a guard. What was missing is the
  // NAME. A UI that adopts currentChangeToken but forgets to send
  // changeToken has every single model answer refused, with nothing saying
  // why; that reads as "the AI designer is broken", not "one argument is
  // missing". These assert the refusal is still closed and now diagnosable.

  it("names changeToken when the live token getter has no counterpart", async () => {
    const before = activeDesign();

    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: before.observations,
      specId: SPEC_ID,
      revision: 1,
      // changeToken deliberately omitted
      fetchImpl: widen(),
      currentChangeToken: () => 5,
    });

    expect(result.ok, "must still fail closed").toBe(false);
    expect(result.kind).toBe(RESULT_KIND.STALE_REVISION);
    expect(result.spec).toBeUndefined();
    expect(result.guardMisconfigured).toBe(true);
    expect(result.guardParameter).toBe("changeToken");
    expect(result.error).toMatch(/changeToken/);
  });

  it("names specId when the live design-id getter has no counterpart", async () => {
    const before = activeDesign();

    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: before.observations,
      specId: "",
      revision: 1,
      fetchImpl: widen(),
      currentDesignId: () => "design-a",
    });

    expect(result.ok).toBe(false);
    expect(result.guardMisconfigured).toBe(true);
    expect(result.guardParameter).toBe("specId");
  });

  it("does not fire when the legacy revision guard is superseded by a token guard", async () => {
    const before = activeDesign();

    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: before.observations,
      specId: SPEC_ID,
      revision: 1,
      changeToken: 5,
      fetchImpl: widen(),
      currentChangeToken: () => 5,
      currentRevision: () => 1,
    });

    expect(result.ok, "a fully-configured caller must not be refused").toBe(true);
    expect(result.kind).toBe(RESULT_KIND.DESIGN_UPDATED);
  });

  it("leaves a caller that supplies no guards at all completely alone", async () => {
    const before = activeDesign();

    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: before.observations,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl: widen(),
    });

    expect(result.ok).toBe(true);
    expect(result.kind).toBe(RESULT_KIND.DESIGN_UPDATED);
  });
});

describe("through the published transport — a broken guard is not an outage", () => {
  it("fails CLOSED: the answer is discarded and no design comes back with it", async () => {
    const before = activeDesign();

    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: before.observations,
      specId: SPEC_ID,
      revision: 1,
      changeToken: 5,
      fetchImpl: widen(),
      currentDesignId: () => {
        throw new Error("UI store torn down mid-request");
      },
      currentChangeToken: () => 5,
    });

    expect(result.ok).toBe(false);
    expect(result.spec, "a refused answer must carry no spec").toBeUndefined();
    expect(result.partGraph, "a refused answer must carry no PartGraph").toBeUndefined();
    expect(result.source).toBe(RESULT_SOURCE.DETERMINISTIC);
  });

  it("says WHY truthfully: STALE_REVISION, not a provider or network failure", async () => {
    const before = activeDesign();

    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: before.observations,
      specId: SPEC_ID,
      revision: 1,
      changeToken: 5,
      fetchImpl: widen(),
      currentChangeToken: () => {
        throw new Error("unmounted");
      },
    });

    expect(result.kind).toBe(RESULT_KIND.STALE_REVISION);
    // The regression this file exists for: it used to be reported as a
    // network failure against a provider that had in fact answered fine.
    expect(result.kind).not.toBe(RESULT_KIND.DESIGNER_UNAVAILABLE);
    expect(result.code).not.toBe("NETWORK_ERROR");
    expect(result.guardParameter).toBe("currentChangeToken");
    expect(result.guardThrew).toBe(true);
  });

  it("tells the customer their design is unchanged, in ordinary language", async () => {
    const before = activeDesign();

    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: before.observations,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl: widen(),
      currentRevision: () => {
        throw new Error("boom");
      },
    });

    expect(result.error).toMatch(/unchanged/i);
    // No provider names, codes, credentials or environment variables.
    expect(JSON.stringify(result)).not.toMatch(/anthropic|openai|API_KEY|sk-ant|operatorNote/i);
  });

  it("leaves the caller's own observations untouched", async () => {
    const before = activeDesign();
    const snapshot = JSON.stringify(before.observations);

    await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: before.observations,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl: widen(),
      currentDesignId: () => {
        throw new Error("boom");
      },
    });

    expect(JSON.stringify(before.observations)).toBe(snapshot);
  });

  it("a healthy set of getters is unaffected — the fix is not a blanket refusal", async () => {
    const before = activeDesign();

    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: before.observations,
      specId: SPEC_ID,
      revision: 1,
      changeToken: 5,
      fetchImpl: widen(),
      currentDesignId: () => SPEC_ID,
      currentChangeToken: () => 5,
    });

    expect(result.ok).toBe(true);
    expect(result.kind).toBe(RESULT_KIND.DESIGN_UPDATED);
    expect(result.spec.envelope.widthMm).toBe(2000);
  });

  it("reports the value the decision was actually taken on, not a later re-read", async () => {
    const before = activeDesign();
    // A getter whose value moves between reads. With the getters invoked
    // twice, the decision and the reported evidence could come from
    // different reads; one read backs both.
    let calls = 0;
    const drifting = () => {
      calls += 1;
      return calls === 1 ? 9 : 5;
    };

    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: before.observations,
      specId: SPEC_ID,
      revision: 1,
      changeToken: 5,
      fetchImpl: widen(),
      currentChangeToken: drifting,
    });

    expect(result.ok).toBe(false);
    expect(result.kind).toBe(RESULT_KIND.STALE_REVISION);
    expect(calls, "the guard must be read exactly once").toBe(1);
    expect(
      result.currentChangeToken,
      "the reported token must be the one the refusal was decided on"
    ).toBe(9);
  });
});
