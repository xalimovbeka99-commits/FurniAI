/**
 * Session identity — an answer from a session the customer has left must not apply.
 *
 * WHAT THIS REPLACES
 *
 * `sessionIdentityCharacterization.test.js` recorded this as a defect, with a
 * passing assertion that the pre-reopen answer WAS applied. That file is gone;
 * these are the requirement tests.
 *
 * WHY THE EXISTING SIGNALS COULD NOT COVER IT
 *
 * `designId` and `changeToken` are both scoped to one browsing session.
 * Reopening a saved design restarts the client's token counter and leaves the
 * design id identical — that is the point of reopening. So an in-flight answer
 * from the PREVIOUS session matches both signals once the new session's counter
 * climbs back through the same value, and applies to the revision the customer
 * has just restored. The deterministic kernel still validates the result, so
 * this produces a valid wardrobe; it is simply not the one they asked for, and
 * nothing reports that anything went wrong.
 *
 * Durable reopen is what made this reachable: before it, a session ended when
 * the page did and there was no second session to be confused with.
 *
 * SCOPE NOTE: these tests prove the TRANSPORT refuses such an answer. They do
 * not prove the browser caller supplies the arguments — until index.html passes
 * `sessionId` and `currentSessionId`, the guard is inert in the product. That
 * wiring is Antigravity's, per docs/m3/SESSION_ID_CALLING_CONTRACT.md, and the
 * feature is not complete until their same-page journey test passes.
 *
 * Evidence class: B — real published entry point, provider stubbed at the HTTP
 * boundary. No credentials, no network, no browser.
 */
import { describe, expect, it, vi } from "vitest";
import { RESULT_KIND, RESULT_SOURCE, isStaleAnswer, proposeDesignChange } from "./aiDesignerTransport.js";
import { previewDraftWardrobe } from "../conversation/pipeline.js";

const SPEC_ID = "furnispec-session-guard";
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

/** The exact shape of the bug: same design, same token value, earlier session. */
const AFTER_REOPEN = {
  message: MODEL_ONLY,
  specId: SPEC_ID,
  revision: 1,
  changeToken: 7,
  sessionId: "session-1",
  currentDesignId: () => SPEC_ID,
  currentChangeToken: () => 7,
  currentSessionId: () => "session-2",
};

describe("THE REGRESSION: a pre-reopen answer is rejected", () => {
  it("refuses an answer from the previous session, same design, same token", async () => {
    const before = activeDesign();
    const widthBefore = before.spec.envelope.widthMm;

    const result = await proposeDesignChange({
      ...AFTER_REOPEN,
      currentObservations: before.observations,
      fetchImpl: widen(),
    });

    expect(result.ok, "an answer from a session the customer has left must not apply").toBe(false);
    expect(result.kind).toBe(RESULT_KIND.STALE_REVISION);
    expect(result.source).toBe(RESULT_SOURCE.DETERMINISTIC);
    expect(result.error).toMatch(/unchanged/i);
  });

  it("applies NO geometry when it refuses", async () => {
    const before = activeDesign();
    const snapshot = JSON.stringify(before.observations);

    const result = await proposeDesignChange({
      ...AFTER_REOPEN,
      currentObservations: before.observations,
      fetchImpl: widen(),
    });

    expect(result.spec, "no FurniSpec may come back with a refusal").toBeUndefined();
    expect(result.partGraph, "no PartGraph may come back with a refusal").toBeUndefined();
    expect(result.materialKey ?? null).toBeNull();
    expect(JSON.stringify(before.observations), "the caller's design is untouched").toBe(snapshot);
  });

  it("reports the session evidence the refusal was decided on", async () => {
    const before = activeDesign();
    const result = await proposeDesignChange({
      ...AFTER_REOPEN,
      currentObservations: before.observations,
      fetchImpl: widen(),
    });

    expect(result.sessionIdAtRequest).toBe("session-1");
    expect(result.currentSessionId).toBe("session-2");
  });
});

describe("THE CONTROL: a valid current-session answer still applies", () => {
  it("applies normally when the session matches", async () => {
    const before = activeDesign();

    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: before.observations,
      specId: SPEC_ID,
      revision: 1,
      changeToken: 7,
      sessionId: "session-2",
      fetchImpl: widen(),
      currentDesignId: () => SPEC_ID,
      currentChangeToken: () => 7,
      currentSessionId: () => "session-2", // same session
    });

    expect(result.ok, "the guard must not be a blanket refusal").toBe(true);
    expect(result.kind).toBe(RESULT_KIND.DESIGN_UPDATED);
    expect(result.spec.envelope.widthMm).toBe(2000);
  });

  it("leaves a caller that supplies no session arguments exactly as before", async () => {
    // Additive: this must keep working until Antigravity adopts the new pair.
    const before = activeDesign();
    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: before.observations,
      specId: SPEC_ID,
      revision: 1,
      changeToken: 7,
      fetchImpl: widen(),
      currentDesignId: () => SPEC_ID,
      currentChangeToken: () => 7,
    });

    expect(result.ok).toBe(true);
    expect(result.kind).toBe(RESULT_KIND.DESIGN_UPDATED);
  });
});

describe("the session guard fails closed on every misuse", () => {
  it("refuses a plain value where a getter is required, and names it", async () => {
    const before = activeDesign();
    const result = await proposeDesignChange({
      ...AFTER_REOPEN,
      currentObservations: before.observations,
      fetchImpl: widen(),
      currentSessionId: "session-2", // a snapshot, not a getter
    });

    expect(result.ok).toBe(false);
    expect(result.kind).toBe(RESULT_KIND.STALE_REVISION);
    expect(result.guardParameter).toBe("currentSessionId");
    expect(result.guardParameterType).toBe("string");
  });

  it("refuses a live session getter supplied without sessionId, and names the missing half", async () => {
    const before = activeDesign();
    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: before.observations,
      specId: SPEC_ID,
      revision: 1,
      changeToken: 7,
      fetchImpl: widen(),
      currentChangeToken: () => 7,
      currentSessionId: () => "session-2", // no sessionId at request time
    });

    expect(result.ok).toBe(false);
    expect(result.guardMisconfigured).toBe(true);
    expect(result.guardParameter).toBe("sessionId");
    expect(result.error).toMatch(/sessionId/);
  });

  it("refuses when the session getter THROWS, and names it without leaking the message", async () => {
    const before = activeDesign();
    const result = await proposeDesignChange({
      ...AFTER_REOPEN,
      currentObservations: before.observations,
      fetchImpl: widen(),
      currentSessionId: () => {
        throw new TypeError("store torn down carrying sk-ant-EXAMPLE");
      },
    });

    expect(result.ok).toBe(false);
    expect(result.kind).toBe(RESULT_KIND.STALE_REVISION);
    expect(result.guardParameter).toBe("currentSessionId");
    expect(result.guardThrew).toBe(true);
    expect(result.guardErrorName).toBe("TypeError");
    expect(JSON.stringify(result)).not.toMatch(/torn down|sk-ant/);
  });

  it("refuses an unreadable live session id rather than guessing", async () => {
    const before = activeDesign();
    for (const bad of [null, undefined, ""]) {
      const result = await proposeDesignChange({
        ...AFTER_REOPEN,
        currentObservations: before.observations,
        fetchImpl: widen(),
        currentSessionId: () => bad,
      });
      expect(result.ok, `live session id ${JSON.stringify(bad)} must fail closed`).toBe(false);
      expect(result.kind).toBe(RESULT_KIND.STALE_REVISION);
    }
  });

  it("reads the session getter exactly once", async () => {
    const before = activeDesign();
    const getter = vi.fn(() => "session-2");

    await proposeDesignChange({
      ...AFTER_REOPEN,
      currentObservations: before.observations,
      fetchImpl: widen(),
      currentSessionId: getter,
    });

    expect(getter).toHaveBeenCalledTimes(1);
  });
});

describe("isStaleAnswer — the session signal in isolation", () => {
  it("is stale when the session changed, whatever the other signals say", () => {
    expect(
      isStaleAnswer({
        sessionIdAtRequest: "s1",
        currentSessionId: () => "s2",
        designIdAtRequest: "d1",
        currentDesignId: () => "d1",
        changeTokenAtRequest: 7,
        currentChangeToken: () => 7,
      })
    ).toBe(true);
  });

  it("is not stale when session, design and token all match", () => {
    expect(
      isStaleAnswer({
        sessionIdAtRequest: "s1",
        currentSessionId: () => "s1",
        designIdAtRequest: "d1",
        currentDesignId: () => "d1",
        changeTokenAtRequest: 7,
        currentChangeToken: () => 7,
      })
    ).toBe(false);
  });

  it("still does not guess when no reader is supplied at all", () => {
    expect(isStaleAnswer({ sessionIdAtRequest: "s1" })).toBe(false);
  });

  it("is stale when the session reader is present but the request carried no session", () => {
    expect(isStaleAnswer({ currentSessionId: () => "s2" })).toBe(true);
  });
});
