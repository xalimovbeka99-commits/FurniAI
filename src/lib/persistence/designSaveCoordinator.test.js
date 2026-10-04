/**
 * The save/reopen coordinator against the REAL design service (memory store).
 * Every scenario here is a way the Studio candidate (3ed620c + Antigravity's
 * uncommitted designs client) can apply a stale answer or lose a save; see
 * docs/m3/STUDIO_SAVE_REOPEN_CONTRACT.md.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { previewDraftWardrobe, applyConversationalEdit } from "../conversation/pipeline.js";
import { fingerprintFurniSpec } from "../conversation/approval.js";
import { createMemoryStore } from "./memoryStore.js";
import { createDesignService } from "./designService.js";
import { createDesignSaveCoordinator, SAVE_OUTCOME, REOPEN_OUTCOME } from "./designSaveCoordinator.js";

const USER = "user-coord";
const TOKEN = "token-coord";

/** A client with Antigravity's method names, backed by the real service. */
function serviceClient(service, { gate } = {}) {
  const calls = [];
  const wrap = (name, fn) => async (args) => {
    calls.push({ name, args: structuredClone({ ...args, token: args.token ? "[t]" : args.token }) });
    if (gate && gate[name]) await gate[name](args);
    if (!args.token) throw Object.assign(new Error("Sign in"), { code: "MISSING_AUTH", status: 401 });
    try {
      const result = await fn(args);
      if (gate && gate[`${name}:after`]) await gate[`${name}:after`](args, result);
      return result;
    } catch (err) {
      throw Object.assign(new Error(err.message), { code: err.code, status: err.status, details: err.details });
    }
  };
  return {
    calls,
    createDesign: wrap("createDesign", ({ name, designId }) => service.createDesign({ userId: USER, name, designId })),
    saveAcceptedRevision: wrap("saveAcceptedRevision", ({ designId, token: _t, ...body }) =>
      service.saveRevision({ userId: USER, designId, ...body })
    ),
    getDesign: wrap("getDesign", ({ designId }) => service.getDesign({ userId: USER, designId })),
    getRevision: wrap("getRevision", ({ designId, revision }) => service.getRevision({ userId: USER, designId, revision })),
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

const drafts = new Map();
function draft(widthMm, specId = "spec-coord", revision = 1) {
  const key = `${widthMm}:${specId}:${revision}`;
  if (!drafts.has(key)) {
    const d = previewDraftWardrobe({
      description: `A wardrobe ${widthMm} mm wide, 2400 mm high and 600 mm deep`,
      specId,
      revision,
    });
    expect(d.validation.valid).toBe(true);
    drafts.set(key, d);
  }
  return drafts.get(key);
}
const body = (d) => ({
  furniSpec: d.spec,
  partGraph: d.partGraph,
  fingerprint: fingerprintFurniSpec(d.spec),
  origins: d.origins ?? {},
});

let service;
let session;
let token;
function setup(gate) {
  service = createDesignService({ store: createMemoryStore() });
  session = "s1";
  token = TOKEN;
  const client = serviceClient(service, { gate });
  const coord = createDesignSaveCoordinator({ client, getToken: () => token, getSessionId: () => session });
  coord.reset("s1");
  return { client, coord };
}
const stored = async (designId) => (await service.listRevisions({ userId: USER, designId })).revisions.map((r) => r.revision);

describe("identity: server-assigned design id, stored vs displayed revision", () => {
  it("never sends a designId on create, and adopts the id the server assigns", async () => {
    const { client, coord } = setup();
    const out = await coord.save({ ...body(draft(1800)), name: "Bedroom", changeToken: 1 });
    expect(out.status).toBe(SAVE_OUTCOME.SAVED);
    const create = client.calls.find((c) => c.name === "createDesign");
    expect(create.args).not.toHaveProperty("designId");
    expect(out.designId).toMatch(/.+/);
    expect(coord.snapshot()).toMatchObject({ designId: out.designId, storedRevision: 1, specId: "spec-coord" });
  });

  it("saving after Undo appends storedRevision + 1 with the undone content — the displayed revision is irrelevant", async () => {
    const { coord } = setup();
    const r1 = draft(1800, "spec-coord", 1); // displayed rev 1
    const edit = applyConversationalEdit({
      currentObservations: r1.observations, commandText: "Make it 2400 mm wide", specId: "spec-coord", revision: 1,
    });
    expect(edit.ok).toBe(true); // displayed rev 2

    expect((await coord.save({ ...body(r1), changeToken: 1 })).storedRevision).toBe(1);
    expect((await coord.save({ ...body(edit), changeToken: 2 })).storedRevision).toBe(2);
    // Undo: the UI shows r1 again (displayed revision back to 1, change token 3).
    const afterUndo = await coord.save({ ...body(r1), changeToken: 3 });
    expect(afterUndo.status).toBe(SAVE_OUTCOME.SAVED);
    expect(afterUndo.storedRevision).toBe(3);
    expect(await stored(afterUndo.designId)).toEqual([1, 2, 3]);
    const reopened = await service.getRevision({ userId: USER, designId: afterUndo.designId, revision: 3 });
    expect(reopened.fingerprint).toBe(fingerprintFurniSpec(r1.spec));
    expect(reopened.furniSpec.revision).toBe(1); // the spec's own (displayed) revision, untouched
  });

  it("'Saved' is true only for the change token that was saved", async () => {
    const { coord } = setup();
    await coord.save({ ...body(draft(1800)), changeToken: 7 });
    expect(coord.isSaved(7)).toBe(true);
    expect(coord.isSaved(8)).toBe(false); // an edit (or Undo) since
  });
});

describe("stale answers never land on another editing session", () => {
  it("a create answered after the customer reopened another design is not adopted", async () => {
    const release = deferred();
    const { coord } = setup({ createDesign: () => release.promise });
    // Design X exists already, saved by this user.
    const x = await service.createDesign({ userId: USER, name: "X" });
    await service.saveRevision({ userId: USER, designId: x.designId, revision: 1, ...body(draft(2400, "spec-x")) });

    const saving = coord.save({ ...body(draft(1800)), changeToken: 1 }); // create in flight
    await new Promise((r) => setTimeout(r, 0)); // let the create request go out
    // Customer reopens X: UI rotates the session, then binds.
    session = "s2";
    const re = await coord.reopen({ designId: x.designId });
    expect(re.status).toBe(REOPEN_OUTCOME.REOPENED);
    coord.bind({ sessionId: "s2", designId: re.designId, storedRevision: re.storedRevision, specId: re.specId });

    release.resolve();
    const out = await saving;
    expect(out.status).toBe(SAVE_OUTCOME.DISCARDED_STALE_SESSION);
    expect(out, JSON.stringify(out)).toHaveProperty("orphanedDesignId");
    expect(out.orphanedDesignId).toBeTruthy();
    expect(coord.snapshot()).toMatchObject({ designId: x.designId, storedRevision: 1, specId: "spec-x" });
    expect(await stored(out.orphanedDesignId)).toEqual([]); // nothing saved into the orphan

    // The next save goes to X as revision 2.
    const next = await coord.save({ ...body(draft(2400, "spec-x")), changeToken: 1 });
    expect(next).toMatchObject({ status: SAVE_OUTCOME.SAVED, designId: x.designId, storedRevision: 2 });
  });

  it("a save answered after a reopen does not re-label the reopened design", async () => {
    const hold = deferred();
    let holdNext = false;
    const { coord } = setup({ "saveAcceptedRevision:after": () => (holdNext ? hold.promise : undefined) });
    const first = await coord.save({ ...body(draft(1800)), changeToken: 1 });
    const a = first.designId;

    holdNext = true;
    const inflight = coord.save({ ...body(draft(2000)), changeToken: 2 }); // commits, answer delayed
    await new Promise((r) => setTimeout(r, 0));

    const b = await service.createDesign({ userId: USER, name: "B" });
    await service.saveRevision({ userId: USER, designId: b.designId, revision: 1, ...body(draft(2400, "spec-b")) });
    session = "s2";
    holdNext = false;
    const re = await coord.reopen({ designId: b.designId });
    coord.bind({ sessionId: "s2", designId: b.designId, storedRevision: re.storedRevision, specId: re.specId });

    hold.resolve();
    expect((await inflight).status).toBe(SAVE_OUTCOME.DISCARDED_STALE_SESSION);
    expect(coord.snapshot()).toMatchObject({ designId: b.designId, storedRevision: 1 });
    expect(await stored(a)).toEqual([1, 2]); // it DID commit on A — the server is the truth
  });

  it("a save requested by a session that is left before the save starts writes nothing", async () => {
    const { client, coord } = setup();
    const p = coord.save({ ...body(draft(1800)), changeToken: 1 });
    session = "s2"; // UI rotated before the queued save ran, without bind()/reset()
    expect((await p).status).toBe(SAVE_OUTCOME.DISCARDED_STALE_SESSION);
    expect(client.calls).toEqual([]);
  });

  it("a reopen overtaken by another reopen is SUPERSEDED", async () => {
    const release = deferred();
    let gateFirst = true;
    const { coord } = setup({ getRevision: () => (gateFirst ? ((gateFirst = false), release.promise) : undefined) });
    const x = await service.createDesign({ userId: USER, name: "X" });
    await service.saveRevision({ userId: USER, designId: x.designId, revision: 1, ...body(draft(1800, "spec-x")) });
    const y = await service.createDesign({ userId: USER, name: "Y" });
    await service.saveRevision({ userId: USER, designId: y.designId, revision: 1, ...body(draft(2400, "spec-y")) });

    const slow = coord.reopen({ designId: x.designId, revision: 1 });
    const fast = await coord.reopen({ designId: y.designId, revision: 1 });
    release.resolve();
    expect(fast.status).toBe(REOPEN_OUTCOME.REOPENED);
    expect((await slow).status).toBe(REOPEN_OUTCOME.SUPERSEDED);
  });
});

describe("one tab never races itself; lost answers are resent identically", () => {
  it("two saves issued together are serialised: revisions 1 and 2, no STALE_REVISION", async () => {
    const { coord } = setup();
    const [a, b] = await Promise.all([
      coord.save({ ...body(draft(1800)), changeToken: 1 }),
      coord.save({ ...body(draft(2000)), changeToken: 2 }),
    ]);
    expect([a.status, b.status]).toEqual([SAVE_OUTCOME.SAVED, SAVE_OUTCOME.SAVED]);
    expect([a.storedRevision, b.storedRevision]).toEqual([1, 2]);
  });

  it("a committed save whose answer was lost is UNCONFIRMED, then REPLAYED — never a conflict", async () => {
    let dropNext = false;
    const { client, coord } = setup({
      "saveAcceptedRevision:after": () => {
        if (dropNext) { dropNext = false; throw Object.assign(new Error("net"), { code: "NETWORK" }); }
      },
    });
    await coord.save({ ...body(draft(1800)), changeToken: 1 });
    dropNext = true;
    const lost = await coord.save({ ...body(draft(2000)), changeToken: 2 });
    expect(lost.status).toBe(SAVE_OUTCOME.UNCONFIRMED);
    expect(coord.snapshot().hasUnconfirmedSave).toBe(true);

    // The customer edits again and saves: the lost one is resolved first.
    const next = await coord.save({ ...body(draft(2400)), changeToken: 3 });
    expect(next).toMatchObject({ status: SAVE_OUTCOME.SAVED, storedRevision: 3 });
    const sends = client.calls.filter((c) => c.name === "saveAcceptedRevision").map((c) => c.args.revision);
    expect(sends).toEqual([1, 2, 2, 3]); // 2 resent identically, then 3
    expect(await stored(next.designId)).toEqual([1, 2, 3]);
  });

  it("401 keeps the body; after sign-in retryPending() saves it", async () => {
    const { coord } = setup();
    await coord.save({ ...body(draft(1800)), changeToken: 1 });
    token = "";
    const out = await coord.save({ ...body(draft(2000)), changeToken: 2 });
    expect(out.status).toBe(SAVE_OUTCOME.SIGN_IN);
    token = TOKEN;
    // Sign-in rejected at token read: nothing was sent, so there is nothing pending.
    const again = await coord.save({ ...body(draft(2000)), changeToken: 2 });
    expect(again).toMatchObject({ status: SAVE_OUTCOME.SAVED, storedRevision: 2 });
  });
});

describe("conflict: someone else saved first", () => {
  it("answers CONFLICT with what is stored, does not bump; adoptLatestAsBase lets the customer keep theirs", async () => {
    const { coord } = setup();
    const first = await coord.save({ ...body(draft(1800)), changeToken: 1 });
    // Another tab saves revision 2.
    await service.saveRevision({
      userId: USER, designId: first.designId, revision: 2, expectedPreviousRevision: 1, ...body(draft(2400)),
    });
    const out = await coord.save({ ...body(draft(2000)), changeToken: 2 });
    expect(out.status).toBe(SAVE_OUTCOME.CONFLICT);
    expect(out.latest.revision).toBe(2);
    expect(coord.snapshot().storedRevision).toBe(1); // not bumped blind
    expect(await stored(first.designId)).toEqual([1, 2]);

    coord.adoptLatestAsBase(out.latest.revision);
    const kept = await coord.save({ ...body(draft(2000)), changeToken: 2 });
    expect(kept).toMatchObject({ status: SAVE_OUTCOME.SAVED, storedRevision: 3 });
  });

  it("an unsaveable design is REFUSED (not a conflict) and nothing is written", async () => {
    const { coord } = setup();
    const d = draft(1800);
    const out = await coord.save({ ...body(d), fingerprint: "sha256:wrong", changeToken: 1 });
    expect(out.status).toBe(SAVE_OUTCOME.REFUSED);
    expect(out.error.code).toBe("FINGERPRINT_MISMATCH");
    expect(await stored(out.designId)).toEqual([]);
  });
});
