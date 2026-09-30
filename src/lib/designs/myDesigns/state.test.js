import { describe, it, expect } from "vitest";
import {
  ACTION,
  ERROR_KIND,
  LIST_STATUS,
  OPEN_STATUS,
  MyDesignsResponseError,
  classifyError,
  createInitialState,
  messageFor,
  parseDesignForOpen,
  parseDesignList,
  parseRevisionForOpen,
  reducer,
} from "./state.js";
import { FakeDesignsApiError, fakeErrors } from "./fakeDesignsApiClient.js";

const ROW = { designId: "d-1", name: "A", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-02T00:00:00.000Z" };

describe("reducer — list lifecycle", () => {
  it("idle → loading → list", () => {
    let s = createInitialState();
    expect(s.list.status).toBe(LIST_STATUS.IDLE);
    s = reducer(s, { type: ACTION.LIST_REQUEST, seq: 1 });
    expect(s.list.status).toBe(LIST_STATUS.LOADING);
    s = reducer(s, { type: ACTION.LIST_SUCCESS, seq: 1, designs: [ROW] });
    expect(s.list.status).toBe(LIST_STATUS.LIST);
    expect(s.list.designs).toEqual([ROW]);
  });

  it("an empty list is EMPTY, not LIST", () => {
    let s = reducer(createInitialState(), { type: ACTION.LIST_REQUEST, seq: 1 });
    s = reducer(s, { type: ACTION.LIST_SUCCESS, seq: 1, designs: [] });
    expect(s.list.status).toBe(LIST_STATUS.EMPTY);
  });

  it("failure records the classified error and clears designs", () => {
    let s = reducer(createInitialState(), { type: ACTION.LIST_REQUEST, seq: 1 });
    s = reducer(s, { type: ACTION.LIST_SUCCESS, seq: 1, designs: [ROW] });
    s = reducer(s, { type: ACTION.LIST_REQUEST, seq: 2 });
    s = reducer(s, { type: ACTION.LIST_FAILURE, seq: 2, error: { kind: ERROR_KIND.NETWORK, status: 0, code: "NETWORK_ERROR" } });
    expect(s.list.status).toBe(LIST_STATUS.ERROR);
    expect(s.list.error.kind).toBe(ERROR_KIND.NETWORK);
    expect(s.list.designs).toEqual([]);
  });

  it("STALE GUARD — an answer for an older request is ignored (same object returned)", () => {
    let s = reducer(createInitialState(), { type: ACTION.LIST_REQUEST, seq: 1 });
    s = reducer(s, { type: ACTION.LIST_REQUEST, seq: 2 });
    const before = s;
    expect(reducer(s, { type: ACTION.LIST_SUCCESS, seq: 1, designs: [ROW] })).toBe(before);
    expect(reducer(s, { type: ACTION.LIST_FAILURE, seq: 1, error: { kind: "server" } })).toBe(before);
    s = reducer(s, { type: ACTION.LIST_SUCCESS, seq: 2, designs: [] });
    expect(s.list.status).toBe(LIST_STATUS.EMPTY);
  });

  it("state is frozen", () => {
    const s = reducer(createInitialState(), { type: ACTION.LIST_REQUEST, seq: 1 });
    expect(Object.isFrozen(s)).toBe(true);
    expect(Object.isFrozen(s.list)).toBe(true);
    expect(Object.isFrozen(s.list.designs)).toBe(true);
  });
});

describe("reducer — open lifecycle", () => {
  it("opening → opened carries server values", () => {
    let s = reducer(createInitialState(), { type: ACTION.OPEN_REQUEST, seq: 1, designId: "d-1", name: "A" });
    expect(s.open).toMatchObject({ status: OPEN_STATUS.OPENING, designId: "d-1", revision: null });
    s = reducer(s, { type: ACTION.OPEN_SUCCESS, seq: 1, designId: "d-1", revision: 4, name: "A" });
    expect(s.open).toMatchObject({ status: OPEN_STATUS.OPENED, designId: "d-1", revision: 4, name: "A" });
  });

  it("opening → error → dismiss", () => {
    let s = reducer(createInitialState(), { type: ACTION.OPEN_REQUEST, seq: 1, designId: "d-1", name: "A" });
    s = reducer(s, { type: ACTION.OPEN_FAILURE, seq: 1, error: { kind: ERROR_KIND.NOT_FOUND, status: 404, code: "MISSING_DESIGN" } });
    expect(s.open.status).toBe(OPEN_STATUS.ERROR);
    expect(s.open.error.kind).toBe(ERROR_KIND.NOT_FOUND);
    s = reducer(s, { type: ACTION.OPEN_DISMISS });
    expect(s.open.status).toBe(OPEN_STATUS.IDLE);
  });

  it("STALE GUARD — a superseded open's success/failure is ignored", () => {
    let s = reducer(createInitialState(), { type: ACTION.OPEN_REQUEST, seq: 1, designId: "d-1" });
    s = reducer(s, { type: ACTION.OPEN_REQUEST, seq: 2, designId: "d-2" });
    expect(reducer(s, { type: ACTION.OPEN_SUCCESS, seq: 1, designId: "d-1", revision: 1 })).toBe(s);
    expect(reducer(s, { type: ACTION.OPEN_FAILURE, seq: 1, error: { kind: "server" } })).toBe(s);
  });

  it("dismiss while opening does nothing", () => {
    const s = reducer(createInitialState(), { type: ACTION.OPEN_REQUEST, seq: 1, designId: "d-1" });
    expect(reducer(s, { type: ACTION.OPEN_DISMISS })).toBe(s);
  });

  it("unknown actions return the same state", () => {
    const s = createInitialState();
    expect(reducer(s, { type: "NOPE" })).toBe(s);
  });
});

describe("classifyError — error mapping", () => {
  const cases = [
    ["401 MISSING_AUTH", fakeErrors.missingAuth(), "list", ERROR_KIND.SIGNED_OUT],
    ["401 without code", new FakeDesignsApiError("x", { status: 401 }), "open", ERROR_KIND.SIGNED_OUT],
    ["network status 0", fakeErrors.network(), "list", ERROR_KIND.NETWORK],
    ["raw fetch TypeError", new TypeError("Failed to fetch"), "list", ERROR_KIND.NETWORK],
    ["NETWORK_ERROR code without status", Object.assign(new Error("x"), { code: "NETWORK_ERROR" }), "open", ERROR_KIND.NETWORK],
    ["503 STORAGE_UNAVAILABLE", fakeErrors.storageUnavailable(), "list", ERROR_KIND.SERVER],
    ["503 PERSISTENCE_NOT_CONFIGURED", fakeErrors.notConfigured(), "list", ERROR_KIND.SERVER],
    ["500 INTERNAL", fakeErrors.internal(), "list", ERROR_KIND.SERVER],
    ["404 on open", fakeErrors.notFound(), "open", ERROR_KIND.NOT_FOUND],
    ["404 on LIST is a server fault, not not-found", fakeErrors.notFound(), "list", ERROR_KIND.SERVER],
    ["409 REVISION_INTEGRITY_FAILED", fakeErrors.integrity(), "open", ERROR_KIND.INTEGRITY],
    ["409 STALE_REVISION (not expected on read) is server", new FakeDesignsApiError("x", { status: 409, code: "STALE_REVISION" }), "open", ERROR_KIND.SERVER],
    ["plain Error", new Error("boom"), "list", ERROR_KIND.SERVER],
    ["null", null, "list", ERROR_KIND.SERVER],
    ["response error", new MyDesignsResponseError(ERROR_KIND.NO_REVISION, "x"), "open", ERROR_KIND.NO_REVISION],
  ];
  for (const [label, err, phase, kind] of cases) {
    it(`${label} → ${kind}`, () => {
      expect(classifyError(err, phase).kind).toBe(kind);
    });
  }

  it("keeps status and code for diagnostics", () => {
    expect(classifyError(fakeErrors.notConfigured(), "list")).toEqual({ kind: "server", status: 503, code: "PERSISTENCE_NOT_CONFIGURED" });
  });
});

describe("messageFor — fixed copy, never the server's text", () => {
  it("each kind has distinct copy and 401 is the only 'sign in' message", () => {
    const kinds = Object.values(ERROR_KIND);
    const msgs = kinds.map((k) => messageFor({ kind: k, status: null, code: null }, "list"));
    expect(new Set(msgs).size).toBe(kinds.length);
    kinds.forEach((k, i) => {
      if (k === ERROR_KIND.SIGNED_OUT) expect(msgs[i]).toMatch(/sign in/i);
      else expect(msgs[i]).not.toMatch(/sign in/i);
    });
  });
  it("503 codes get specific copy", () => {
    expect(messageFor({ kind: "server", code: "PERSISTENCE_NOT_CONFIGURED" }, "list")).toMatch(/not available on this deployment/);
    expect(messageFor({ kind: "server", code: "AUTH_UNAVAILABLE" }, "list")).toMatch(/could not be checked/);
  });
  it("empty for no error", () => expect(messageFor(null, "list")).toBe(""));
});

describe("parsers — never invent ids or revisions", () => {
  it("parseDesignList keeps server rows and drops rows without a designId", () => {
    const rows = parseDesignList({
      ok: true,
      designs: [ROW, { name: "no id" }, { designId: "", name: "blank" }, { designId: 7 }, null, { ...ROW }],
    });
    expect(rows).toEqual([ROW]);
  });
  it("parseDesignList rejects a body with no designs array", () => {
    expect(() => parseDesignList({ ok: true })).toThrow(MyDesignsResponseError);
    expect(() => parseDesignList([ROW])).toThrow(MyDesignsResponseError);
    expect(() => parseDesignList(null)).toThrow(MyDesignsResponseError);
  });
  it("parseDesignForOpen takes latestRevision.revision, and refuses null / missing / wrong design", () => {
    const body = { ok: true, design: { designId: "d-1", name: "A" }, latestRevision: { revision: 3 } };
    expect(parseDesignForOpen(body, "d-1")).toEqual({ designId: "d-1", name: "A", revision: 3 });
    const kind = (b, id = "d-1") => {
      try { parseDesignForOpen(b, id); } catch (e) { return e.kind; }
      return "no-throw";
    };
    expect(kind({ ...body, latestRevision: null })).toBe(ERROR_KIND.NO_REVISION);
    expect(kind({ ...body, latestRevision: {} })).toBe(ERROR_KIND.BAD_RESPONSE);
    expect(kind({ ...body, latestRevision: { revision: 0 } })).toBe(ERROR_KIND.BAD_RESPONSE);
    expect(kind({ ...body, latestRevision: { revision: "3" } })).toBe(ERROR_KIND.BAD_RESPONSE);
    expect(kind({ ...body, latestRevision: undefined })).toBe(ERROR_KIND.BAD_RESPONSE);
    expect(kind(body, "d-2")).toBe(ERROR_KIND.BAD_RESPONSE);
    expect(kind({ ok: true })).toBe(ERROR_KIND.BAD_RESPONSE);
  });
  it("parseRevisionForOpen requires the exact requested design and revision", () => {
    const body = { ok: true, designId: "d-1", revision: 3, fingerprint: "sha256:x", furniSpec: { a: 1 }, partGraph: { p: 1 }, origins: null, validationStatus: "ACCEPTED", createdAt: "t" };
    const rec = parseRevisionForOpen(body, "d-1", 3);
    expect(rec).toEqual({ designId: "d-1", revision: 3, fingerprint: "sha256:x", furniSpec: { a: 1 }, partGraph: { p: 1 }, origins: null, validationStatus: "ACCEPTED", createdAt: "t" });
    expect(() => parseRevisionForOpen({ ...body, revision: 2 }, "d-1", 3)).toThrow(MyDesignsResponseError);
    expect(() => parseRevisionForOpen({ ...body, designId: "d-2" }, "d-1", 3)).toThrow(MyDesignsResponseError);
    expect(() => parseRevisionForOpen({ ...body, designId: undefined }, "d-1", 3)).toThrow(MyDesignsResponseError);
  });
});
