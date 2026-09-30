/**
 * The reopen journey, driven through a LIVE store that changes while the
 * answer is in flight — not through constant getters.
 *
 * sessionIdentityGuard.test.js proves the comparison with getters that return
 * fixed values. That shows the decision is right; it cannot show the guard
 * captures the right thing at the right moment. Here the store is mutated
 * from inside the provider call, exactly as a customer reopening the design
 * mid-request would mutate it.
 *
 * FIVE IDENTITIES, KEPT APART
 *
 *   design identity        specId / currentDesignId       survives reopen
 *   stored revision        persistence `revision` (1,2,…) not a transport input
 *   displayed revision     `revision` shown to the user   rewinds on Undo
 *   change token           changeToken / currentChangeToken  monotonic in a session,
 *                                                         restarts on reopen
 *   editing session        sessionId / currentSessionId   new on reopen
 *
 * Only the last one changes on a reopen of the same design at the same token,
 * which is why it is the only one that can detect it.
 *
 * FAILED BEFORE marks tests that failed against 71e72b6.
 *
 * Evidence class: B — the published transport entry point; provider stubbed
 * at the HTTP boundary. No network, no credentials.
 */
import { describe, expect, it, vi } from "vitest";
import { RESULT_KIND, proposeDesignChange } from "./aiDesignerTransport.js";
import { previewDraftWardrobe } from "../conversation/pipeline.js";

const SPEC_ID = "furnispec-reopen-journey";
const MODEL_ONLY = "Could you open it up a bit more across the front, please?";

function draft() {
  return previewDraftWardrobe({
    description: "A wardrobe 1800 mm wide, 2400 mm high and 600 mm deep",
    specId: SPEC_ID,
    revision: 1,
  });
}

/** The browser's live state, as index.html keeps it. */
function liveStore() {
  const store = { sessionId: "session-A", designId: SPEC_ID, changeToken: 7, displayedRevision: 3, storedRevision: 3 };
  return {
    store,
    beginSession(id) { store.sessionId = id; store.changeToken = 0; },
    edit() { store.changeToken += 1; store.displayedRevision += 1; },
    undo() { store.changeToken += 1; store.displayedRevision -= 1; },
  };
}

/** A provider whose answer is released by the test, after whatever it wants to do first. */
function deferredProvider() {
  const pending = [];
  const fetchImpl = vi.fn(
    () =>
      new Promise((resolve) => {
        pending.push(() =>
          resolve({
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              edits: [{ key: "envelope.widthMm", value: 2000 }],
              unsupported: [],
              rejected: [],
              reply: "Widened to 2.0 m.",
            }),
          })
        );
      })
  );
  return { fetchImpl, releaseAll: () => pending.splice(0).forEach((r) => r()), pending };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function ask(live, provider, observations, style) {
  const { store } = live;
  return proposeDesignChange({
    message: MODEL_ONLY,
    currentObservations: observations,
    specId: store.designId,
    revision: store.displayedRevision,
    changeToken: store.changeToken,
    ...(style === "caller-captures" ? { sessionId: store.sessionId } : {}),
    currentSessionId: () => store.sessionId,
    currentDesignId: () => store.designId,
    currentChangeToken: () => store.changeToken,
    fetchImpl: provider.fetchImpl,
  });
}

describe.each([
  ["caller-captures", "index.html style (de5ebec): sessionId passed by value + getter"],
  ["transport-captures", "getter only: the transport captures the session at request start"],
])("reopen during flight — %s", (style, label) => {
  it(`${label}: the pre-reopen answer is refused even after the token climbs back to the same value`, async () => {
    const d = draft();
    const live = liveStore();
    const provider = deferredProvider();

    const inFlight = ask(live, provider, d.observations, style); // session-A, token 7
    await flush();
    live.beginSession("session-B"); // customer reopens the SAME design
    for (let i = 0; i < 7; i++) live.edit(); // token back to 7, same design id
    expect(live.store).toMatchObject({ designId: SPEC_ID, changeToken: 7 });
    provider.releaseAll();

    const result = await inFlight;
    expect(result.ok).toBe(false);
    expect(result.kind).toBe(RESULT_KIND.STALE_REVISION);
    expect(result.spec).toBeUndefined();
    expect(result.partGraph).toBeUndefined();
    expect(result.sessionIdAtRequest).toBe("session-A");
    expect(result.currentSessionId).toBe("session-B");
  });

  it(`${label}: EVERY pending answer from the left session is refused; a new request applies`, async () => {
    const d = draft();
    const live = liveStore();
    const provider = deferredProvider();

    const pending = [ask(live, provider, d.observations, style)];
    live.edit();
    pending.push(ask(live, provider, d.observations, style));
    live.edit();
    pending.push(ask(live, provider, d.observations, style));
    await flush();

    live.beginSession("session-B");
    const fresh = ask(live, provider, d.observations, style); // issued in the new session
    await flush();
    provider.releaseAll();

    const old = await Promise.all(pending);
    for (const r of old) {
      expect(r.kind).toBe(RESULT_KIND.STALE_REVISION);
      expect(r.spec).toBeUndefined();
    }
    const now = await fresh;
    expect(now.ok).toBe(true);
    expect(now.kind).toBe(RESULT_KIND.DESIGN_UPDATED);
    expect(now.spec.envelope.widthMm).toBe(2000);
  });
});

describe("the session is captured when the request STARTS", () => {
  it("FAILED BEFORE — a getter-only caller is guarded (it was refused as misconfigured, applying nothing ever)", async () => {
    const d = draft();
    const live = liveStore();
    const provider = deferredProvider();
    const p = ask(live, provider, d.observations, "transport-captures");
    await flush();
    provider.releaseAll();
    const r = await p;
    expect(r.ok).toBe(true);
    expect(r.kind).toBe(RESULT_KIND.DESIGN_UPDATED);
  });

  it("FAILED BEFORE — a request issued FROM a session that is no longer live is refused before the provider is called", async () => {
    const d = draft();
    const live = liveStore();
    const provider = deferredProvider();
    const stale = live.store.sessionId; // a caller holding an old copy
    live.beginSession("session-B");
    const r = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: d.observations,
      specId: SPEC_ID,
      revision: 1,
      changeToken: live.store.changeToken,
      sessionId: stale,
      currentSessionId: () => live.store.sessionId,
      currentChangeToken: () => live.store.changeToken,
      fetchImpl: provider.fetchImpl,
    });
    expect(r.kind).toBe(RESULT_KIND.STALE_REVISION);
    expect(r.sessionNotLiveAtRequest).toBe(true);
    expect(r.guardPhase).toBe("request-start");
    expect(provider.fetchImpl).not.toHaveBeenCalled();
  });

  it("FAILED BEFORE — a half-configured guard is refused BEFORE the paid call, not after it", async () => {
    const d = draft();
    const provider = deferredProvider();
    const r = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: d.observations,
      specId: SPEC_ID,
      revision: 1,
      // changeToken missing
      currentChangeToken: () => 7,
      fetchImpl: provider.fetchImpl,
    });
    expect(r.guardMisconfigured).toBe(true);
    expect(r.guardParameter).toBe("changeToken");
    expect(provider.fetchImpl).not.toHaveBeenCalled();
  });

  it("a session getter that throws at start is refused, named, without its message, and without a provider call", async () => {
    const d = draft();
    const provider = deferredProvider();
    const r = await proposeDesignChange({
      message: MODEL_ONLY,
      currentObservations: d.observations,
      specId: SPEC_ID,
      revision: 1,
      changeToken: 1,
      currentChangeToken: () => 1,
      currentSessionId: () => { throw new RangeError("secret store state"); },
      fetchImpl: provider.fetchImpl,
    });
    expect(r.kind).toBe(RESULT_KIND.STALE_REVISION);
    expect(r).toMatchObject({ guardParameter: "currentSessionId", guardPhase: "request-start", guardThrew: true, guardErrorName: "RangeError" });
    expect(JSON.stringify(r)).not.toMatch(/secret store state/);
    expect(provider.fetchImpl).not.toHaveBeenCalled();
  });
});

describe("five identities, kept apart", () => {
  async function landWith(mutate) {
    const d = draft();
    const live = liveStore();
    const provider = deferredProvider();
    const p = ask(live, provider, d.observations, "caller-captures");
    await flush();
    mutate(live);
    provider.releaseAll();
    return p;
  }

  it("session changes alone -> refused", async () => {
    const r = await landWith((l) => { l.store.sessionId = "session-B"; });
    expect(r.kind).toBe(RESULT_KIND.STALE_REVISION);
  });

  it("design identity changes alone -> refused", async () => {
    const r = await landWith((l) => { l.store.designId = "another-design"; });
    expect(r.kind).toBe(RESULT_KIND.STALE_REVISION);
  });

  it("change token changes alone (an edit) -> refused", async () => {
    const r = await landWith((l) => { l.store.changeToken += 1; });
    expect(r.kind).toBe(RESULT_KIND.STALE_REVISION);
  });

  it("edit then Undo: displayed revision back where it was, token moved on -> refused", async () => {
    const r = await landWith((l) => { l.edit(); l.undo(); });
    expect(r.kind).toBe(RESULT_KIND.STALE_REVISION);
  });

  it("the STORED revision advancing (a save) is not a staleness signal — the transport never sees it", async () => {
    const r = await landWith((l) => { l.store.storedRevision += 1; });
    expect(r.ok).toBe(true);
    expect(r.kind).toBe(RESULT_KIND.DESIGN_UPDATED);
  });
});

describe("what the customer reads", () => {
  it("FAILED BEFORE — the refusal text is clean UTF-8, not mojibake", async () => {
    const r = await landWith0();
    expect(r.error).toContain("—");
    expect(r.error).not.toMatch(/â€|Ã/);
  });
});

async function landWith0() {
  const d = draft();
  const live = liveStore();
  const provider = deferredProvider();
  const p = ask(live, provider, d.observations, "caller-captures");
  await flush();
  live.beginSession("session-B");
  provider.releaseAll();
  return p;
}
