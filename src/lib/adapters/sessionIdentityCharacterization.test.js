/**
 * CHARACTERIZATION — cross-session staleness is NOT currently detected.
 *
 * READ THIS BEFORE "FIXING" THE ASSERTIONS
 *
 * These tests assert what the transport does TODAY, not what it should do.
 * They pass, and they are meant to pass, so that the gap is visible in CI
 * rather than living in a document nobody runs. When the proposed fix in
 * `docs/m3/proposals/SESSION_IDENTITY_GUARD.md` is applied, these assertions
 * will start failing — that is the signal to replace them with the
 * requirement tests in that proposal, not to weaken the fix.
 *
 * THE GAP
 *
 * The stale guard has two live signals: the design id and a monotonic change
 * token. Both are scoped to ONE browsing session. Reopening a saved design
 * starts a new session whose counter begins again from zero, and reopening
 * the SAME design leaves the design id identical. So an in-flight answer
 * belonging to the previous session can match on both signals once the new
 * session's counter climbs back through the same value, and it applies.
 *
 * WHY IT MATTERS FOR PERSISTENCE SPECIFICALLY
 *
 * Save/reopen is what makes this reachable. Before durable reopen, a session
 * ended when the page did and there was no second session to be confused
 * with. Now a customer can save, reopen, and receive an answer computed
 * against the design as it was BEFORE they reopened — silently applied to
 * the revision they just restored. The deterministic kernel still validates
 * the result, so this produces a valid wardrobe; it is simply not the one the
 * customer asked for, and nothing reports that anything went wrong.
 *
 * OWNERSHIP NOTE: `aiDesignerTransport.js` is a shared transport file owned by
 * the integration lead for this cycle. This file only observes it. No shared
 * transport file was edited to add these tests.
 *
 * Evidence class: B — real published entry point, provider stubbed at the HTTP
 * boundary. No credentials, no network, no browser.
 */
import { describe, expect, it, vi } from "vitest";
import { RESULT_KIND, proposeDesignChange } from "./aiDesignerTransport.js";
import { previewDraftWardrobe } from "../conversation/pipeline.js";

const SPEC_ID = "furnispec-session-characterization";
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

describe("CHARACTERIZATION: an answer from an earlier session still applies", () => {
  it("applies a pre-reopen answer once the new session's counter reaches the same value", async () => {
    const before = activeDesign();

    // Session 1 sends a request at changeToken 7. The customer then saves and
    // REOPENS the design: session 2 starts, its counter restarts at 0 and
    // climbs back to 7 through ordinary editing. Session 1's answer finally
    // lands. Design id matches (same saved design) and token matches (7 === 7),
    // so both guard signals agree — wrongly.
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

    // TODAY: accepted. This is the defect, recorded.
    expect(result.ok).toBe(true);
    expect(result.kind).toBe(RESULT_KIND.DESIGN_UPDATED);
    expect(result.spec.envelope.widthMm).toBe(2000);

    // The requirement, stated so it is not lost: after the proposal in
    // docs/m3/proposals/SESSION_IDENTITY_GUARD.md is applied this must become
    // ok:false / STALE_REVISION, because the answer belongs to a session the
    // customer has left.
  });

  it("has no session signal in the published call surface at all", async () => {
    const before = activeDesign();
    // Nothing in the argument list identifies WHICH session a request came
    // from, so no amount of care by the UI can currently close this.
    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: before.observations,
      specId: SPEC_ID,
      revision: 1,
      changeToken: 1,
      fetchImpl: widen(),
      currentDesignId: () => SPEC_ID,
      currentChangeToken: () => 1,
      // A caller trying to be careful might pass these. They are ignored.
      sessionId: "session-2",
      sessionIdAtRequest: "session-1",
    });

    expect(result.ok, "unknown session arguments are silently ignored").toBe(true);
  });

  it("DOES still catch the easy case: a different design after reopen", async () => {
    // Worth pinning: the design-id signal works. The hole is specifically
    // reopening the SAME design, which is the common case for save/reopen.
    const before = activeDesign();
    const result = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: before.observations,
      specId: SPEC_ID,
      revision: 1,
      changeToken: 7,
      fetchImpl: widen(),
      currentDesignId: () => "a-different-saved-design",
      currentChangeToken: () => 7,
    });

    expect(result.ok).toBe(false);
    expect(result.kind).toBe(RESULT_KIND.STALE_REVISION);
    expect(result.spec).toBeUndefined();
  });
});
