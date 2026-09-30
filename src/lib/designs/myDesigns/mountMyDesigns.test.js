/**
 * My Designs module — DOM + controller behaviour against a fake client that
 * implements exactly listDesigns / getDesign / getRevision. Evidence: MOCKED
 * (no HTTP, no store). Response key sets are cross-checked against the real
 * handlers in tests/contract/designs-api/.
 */
import { describe, it, expect, vi } from "vitest";
import { mountMyDesigns } from "./mountMyDesigns.js";
import { ERROR_KIND, LIST_STATUS, OPEN_STATUS, OPEN_DISABLED_NOTICE } from "./state.js";
import { createFakeDesignsApiClient, demoSeed, fakeErrors } from "./fakeDesignsApiClient.js";
import { createFakeDocument, byClass, byTag, byAttr, deferred, flush } from "./__tests__/fakeDom.js";
import {
  DESIGN_LIST_ITEM_KEYS,
  GET_DESIGN_BODY_KEYS,
  DESIGN_SUMMARY_KEYS,
  LATEST_REVISION_KEYS,
  REVISION_BODY_KEYS,
  LIST_BODY_KEYS,
} from "../../../../tests/contract/designs-api/shapes.js";

const SEED = demoSeed();
const [BEDROOM, HALLWAY, XSS, SHELL] = SEED.designs;

function setup({ seed = SEED, token = "tok-1", ...rest } = {}) {
  const doc = createFakeDocument();
  const root = doc.createElement("div");
  doc.body.appendChild(root);
  const client = rest.client || createFakeDesignsApiClient(seed);
  const onOpenDesign = rest.onOpenDesign || vi.fn();
  const onSignIn = rest.onSignIn === undefined ? vi.fn() : rest.onSignIn;
  const getAccessToken = "getAccessToken" in rest ? rest.getAccessToken : vi.fn(async () => token);
  const handle = mountMyDesigns(root, {
    client,
    getAccessToken,
    onOpenDesign,
    onSignIn,
    document: doc,
    formatDate: (iso) => (iso ? iso.slice(0, 10) : ""),
    autoLoad: rest.autoLoad ?? true,
    ...("openEnabled" in rest ? { openEnabled: rest.openEnabled } : {}),
  });
  const section = () => byClass(root, "fmd")[0];
  const openButton = (id) => byAttr(root, "data-design-id", id)[0];
  const status = () => byClass(root, "fmd-status")[0];
  const alert = () => byClass(root, "fmd-alert")[0];
  return { doc, root, client, onOpenDesign, onSignIn, getAccessToken, handle, section, openButton, status, alert };
}

async function mountedList(opts) {
  const t = setup(opts);
  await flush();
  expect(t.handle.getState().list.status).toBe(LIST_STATUS.LIST);
  return t;
}

describe("mount contract", () => {
  it("requires an injected client with listDesigns/getDesign/getRevision and an onOpenDesign", () => {
    const doc = createFakeDocument();
    const root = doc.createElement("div");
    const client = createFakeDesignsApiClient();
    expect(() => mountMyDesigns(root, { client: {}, onOpenDesign() {}, document: doc })).toThrow(/client\.listDesigns/);
    expect(() => mountMyDesigns(root, { client: { listDesigns() {}, getDesign() {} }, onOpenDesign() {}, document: doc })).toThrow(/client\.getRevision/);
    expect(() => mountMyDesigns(root, { client, document: doc })).toThrow(/onOpenDesign/);
    expect(() => mountMyDesigns(null, { client, onOpenDesign() {}, document: doc })).toThrow(/rootEl/);
    expect(() => mountMyDesigns(root, { client, onOpenDesign() {}, getAccessToken: "x", document: doc })).toThrow(/getAccessToken/);
  });

  it("returns { refresh, destroy, getState } (and openDesign)", () => {
    const t = setup({ autoLoad: false });
    expect(typeof t.handle.refresh).toBe("function");
    expect(typeof t.handle.destroy).toBe("function");
    expect(typeof t.handle.getState).toBe("function");
    expect(typeof t.handle.openDesign).toBe("function");
  });

  it("injects its stylesheet once per document", () => {
    const doc = createFakeDocument();
    const client = createFakeDesignsApiClient();
    for (let i = 0; i < 2; i++) {
      const root = doc.createElement("div");
      doc.body.appendChild(root);
      mountMyDesigns(root, { client, onOpenDesign() {}, document: doc, autoLoad: false });
    }
    expect(byTag(doc.head, "style").length).toBe(1);
  });
});

describe("states", () => {
  it("LOADING: aria-busy, skeleton, live status; no list", async () => {
    const gate = deferred();
    const client = createFakeDesignsApiClient({ ...SEED, gate: () => gate.promise });
    const t = setup({ client });
    await flush();
    expect(t.handle.getState().list.status).toBe(LIST_STATUS.LOADING);
    expect(t.section().getAttribute("aria-busy")).toBe("true");
    expect(t.section().getAttribute("data-list-state")).toBe("loading");
    expect(byClass(t.root, "fmd-skeleton").length).toBeGreaterThan(0);
    expect(t.status().getAttribute("role")).toBe("status");
    expect(t.status().getAttribute("aria-live")).toBe("polite");
    expect(t.status().textContent).toMatch(/Loading/);
    gate.resolve();
    await flush();
    expect(t.section().getAttribute("aria-busy")).toBe("false");
  });

  it("EMPTY", async () => {
    const t = setup({ seed: { designs: [] } });
    await flush();
    expect(t.handle.getState().list.status).toBe(LIST_STATUS.EMPTY);
    expect(byClass(t.root, "fmd-empty")[0].textContent).toMatch(/no saved designs yet/i);
    expect(byTag(t.root, "ul").length).toBe(0);
  });

  it("LIST: one real <button> per server design, ordered as the server sent, text escaped", async () => {
    const t = await mountedList();
    const buttons = byClass(t.root, "fmd-open");
    expect(buttons.map((b) => b.getAttribute("data-design-id"))).toEqual([BEDROOM.designId, HALLWAY.designId, XSS.designId, SHELL.designId]);
    for (const b of buttons) {
      expect(b.tagName).toBe("BUTTON");
      expect(b.getAttribute("type")).toBe("button");
      const meta = byClass(b, "fmd-meta")[0];
      expect(b.getAttribute("aria-describedby")).toBe(meta.id);
    }
    expect(byClass(buttons[0], "fmd-meta")[0].textContent).toBe("Updated 2026-09-28");
    // The hostile name is TEXT: no <img> element exists, and the string is verbatim.
    const xssName = byClass(buttons[2], "fmd-name")[0];
    expect(xssName.textContent).toBe(XSS.name);
    expect(byTag(t.root, "img").length).toBe(0);
    expect(t.status().textContent).toBe("4 saved designs.");
  });

  const listErrors = [
    ["signed out (401 MISSING_AUTH)", fakeErrors.missingAuth(), ERROR_KIND.SIGNED_OUT, /sign in to see/i],
    ["network failure", fakeErrors.network(), ERROR_KIND.NETWORK, /could not reach/i],
    ["raw fetch TypeError", new TypeError("Failed to fetch"), ERROR_KIND.NETWORK, /could not reach/i],
    ["5xx storage", fakeErrors.storageUnavailable(), ERROR_KIND.SERVER, /could not be loaded/i],
    ["503 not configured", fakeErrors.notConfigured(), ERROR_KIND.SERVER, /not available on this deployment/i],
    ["500 internal", fakeErrors.internal(), ERROR_KIND.SERVER, /could not be loaded/i],
  ];
  for (const [label, err, kind, copy] of listErrors) {
    it(`ERROR — ${label}`, async () => {
      const t = setup({ seed: { ...SEED, fail: { listDesigns: err } } });
      await flush();
      const s = t.handle.getState().list;
      expect(s.status).toBe(LIST_STATUS.ERROR);
      expect(s.error.kind).toBe(kind);
      const panel = byClass(t.root, "fmd-error")[0];
      expect(panel.getAttribute("data-kind")).toBe(kind);
      expect(panel.getAttribute("role")).toBe("alert");
      expect(panel.textContent).toMatch(copy);
      // server text is never echoed
      if (err.message) expect(panel.textContent).not.toContain(err.message);
      expect(byClass(t.root, "fmd-retry").length).toBe(1);
      expect(byClass(t.root, "fmd-signin").length).toBe(kind === ERROR_KIND.SIGNED_OUT ? 1 : 0);
    });
  }

  it("SIGNED OUT without a request when getAccessToken yields nothing", async () => {
    for (const tokenValue of [null, undefined, "", "   "]) {
      const t = setup({ getAccessToken: async () => tokenValue });
      await flush();
      expect(t.handle.getState().list.error.kind).toBe(ERROR_KIND.SIGNED_OUT);
      expect(t.client.calls).toEqual([]);
    }
    const throwing = setup({ getAccessToken: async () => { throw new Error("session lookup failed"); } });
    await flush();
    expect(throwing.handle.getState().list.error.kind).toBe(ERROR_KIND.SIGNED_OUT);
    expect(throwing.client.calls).toEqual([]);
  });

  it("Sign in button calls onSignIn; Try again refetches", async () => {
    let fail = true;
    const client = createFakeDesignsApiClient({ ...SEED, fail: { listDesigns: () => (fail ? fakeErrors.missingAuth() : null) } });
    const t = setup({ client });
    await flush();
    byClass(t.root, "fmd-signin")[0].click();
    expect(t.onSignIn).toHaveBeenCalledTimes(1);
    fail = false;
    byClass(t.root, "fmd-retry")[0].click();
    await flush();
    expect(t.handle.getState().list.status).toBe(LIST_STATUS.LIST);
  });

  it("without getAccessToken the client is called with no accessToken (client handles auth)", async () => {
    const t = setup({ getAccessToken: undefined });
    await flush();
    expect(t.client.calls[0].method).toBe("listDesigns");
    expect(t.client.calls[0].args[0]).not.toHaveProperty("accessToken");
    expect(t.handle.getState().list.status).toBe(LIST_STATUS.LIST);
  });

  it("passes the access token and an AbortSignal to the client", async () => {
    const t = setup();
    await flush();
    const opts = t.client.calls[0].args[0];
    expect(opts.accessToken).toBe("tok-1");
    expect(opts.signal).toBeDefined();
  });
});

describe("open", () => {
  it("fetches GET design then GET its latest revision, and calls onOpenDesign with server values only", async () => {
    const t = await mountedList();
    t.openButton(BEDROOM.designId).click();
    await flush();
    const calls = t.client.calls.map((c) => [c.method, ...c.args.filter((a) => typeof a !== "object")]);
    expect(calls).toEqual([["listDesigns"], ["getDesign", BEDROOM.designId], ["getRevision", BEDROOM.designId, 2]]);
    expect(t.onOpenDesign).toHaveBeenCalledTimes(1);
    const [selection, record] = t.onOpenDesign.mock.calls[0];
    expect(selection).toEqual({ designId: BEDROOM.designId, revision: 2, name: "Bedroom wardrobe" });
    expect(Object.isFrozen(selection)).toBe(true);
    expect(record).toMatchObject({ designId: BEDROOM.designId, revision: 2, fingerprint: "fs256:aaa2", validationStatus: "ACCEPTED" });
    expect(record.furniSpec).toBeTruthy();
    expect(record.partGraph).toBeTruthy();
    expect(t.handle.getState().open).toMatchObject({ status: OPEN_STATUS.OPENED, designId: BEDROOM.designId, revision: 2 });
    expect(t.status().textContent).toBe("Opened “Bedroom wardrobe” (revision 2).");
    expect(t.openButton(BEDROOM.designId).getAttribute("aria-current")).toBe("true");
  });

  it("uses the revision the SERVER reports as latest, even when it is not 1 (no counting, no guessing)", async () => {
    const t = await mountedList();
    t.openButton(XSS.designId).click();
    await flush();
    expect(t.onOpenDesign.mock.calls[0][0]).toEqual({ designId: XSS.designId, revision: 3, name: XSS.name });
  });

  it("OPENING: buttons disabled, aria-busy on the one opening, status announced", async () => {
    const gate = deferred();
    const client = createFakeDesignsApiClient({ ...SEED, gate: (m) => (m === "getRevision" ? gate.promise : undefined) });
    const t = await mountedList({ client });
    t.openButton(HALLWAY.designId).click();
    await flush();
    expect(t.handle.getState().open.status).toBe(OPEN_STATUS.OPENING);
    expect(t.section().getAttribute("aria-busy")).toBe("true");
    expect(t.openButton(HALLWAY.designId).getAttribute("aria-busy")).toBe("true");
    expect(byClass(t.root, "fmd-open").every((b) => b.disabled)).toBe(true);
    expect(byClass(t.root, "fmd-refresh")[0].disabled).toBe(true);
    expect(t.status().textContent).toBe("Opening “Hallway closet”…");
    // a disabled button's click is swallowed: no second open
    t.openButton(BEDROOM.designId).click();
    gate.resolve();
    await flush();
    expect(t.onOpenDesign).toHaveBeenCalledTimes(1);
    expect(t.onOpenDesign.mock.calls[0][0].designId).toBe(HALLWAY.designId);
    expect(byClass(t.root, "fmd-open").some((b) => b.disabled)).toBe(false);
  });

  const openErrors = [
    ["404 on getDesign (not yours / gone)", { getDesign: fakeErrors.notFound() }, ERROR_KIND.NOT_FOUND],
    ["404 on getRevision", { getRevision: fakeErrors.revisionNotFound() }, ERROR_KIND.NOT_FOUND],
    ["401 on open", { getDesign: fakeErrors.missingAuth() }, ERROR_KIND.SIGNED_OUT],
    ["network on open", { getRevision: fakeErrors.network() }, ERROR_KIND.NETWORK],
    ["5xx on open", { getDesign: fakeErrors.storageUnavailable() }, ERROR_KIND.SERVER],
    ["409 REVISION_INTEGRITY_FAILED", { getRevision: fakeErrors.integrity(2) }, ERROR_KIND.INTEGRITY],
  ];
  for (const [label, fail, kind] of openErrors) {
    it(`OPEN ERROR — ${label}: alert shown, onOpenDesign NOT called, list kept`, async () => {
      const t = await mountedList({ seed: { ...SEED, fail } });
      t.openButton(BEDROOM.designId).click();
      await flush();
      expect(t.onOpenDesign).not.toHaveBeenCalled();
      expect(t.handle.getState().open).toMatchObject({ status: OPEN_STATUS.ERROR });
      expect(t.handle.getState().open.error.kind).toBe(kind);
      expect(t.handle.getState().list.status).toBe(LIST_STATUS.LIST);
      expect(t.alert().getAttribute("role")).toBe("alert");
      expect(t.alert().getAttribute("data-kind")).toBe(kind);
      expect(t.alert().textContent.length).toBeGreaterThan(0);
      expect(byClass(t.alert(), "fmd-signin").length).toBe(kind === ERROR_KIND.SIGNED_OUT ? 1 : 0);
      byClass(t.alert(), "fmd-dismiss")[0].click();
      expect(t.handle.getState().open.status).toBe(OPEN_STATUS.IDLE);
      expect(t.alert().textContent).toBe("");
    });
  }

  it("a design with no saved revision (latestRevision: null) is NO_REVISION; getRevision is never called", async () => {
    const t = await mountedList();
    t.openButton(SHELL.designId).click();
    await flush();
    expect(t.handle.getState().open.error.kind).toBe(ERROR_KIND.NO_REVISION);
    expect(t.client.calls.some((c) => c.method === "getRevision")).toBe(false);
    expect(t.onOpenDesign).not.toHaveBeenCalled();
  });

  it("a revision body naming a different design/revision is refused (BAD_RESPONSE)", async () => {
    const real = createFakeDesignsApiClient(SEED);
    const client = {
      ...real,
      listDesigns: real.listDesigns,
      getDesign: real.getDesign,
      async getRevision(designId, revision, o) {
        const b = await real.getRevision(designId, revision, o);
        return { ...b, revision: b.revision + 1 };
      },
    };
    const t = await mountedList({ client });
    t.openButton(BEDROOM.designId).click();
    await flush();
    expect(t.handle.getState().open.error.kind).toBe(ERROR_KIND.BAD_RESPONSE);
    expect(t.onOpenDesign).not.toHaveBeenCalled();
  });

  it("onOpenDesign throwing / rejecting is a HANDOFF error", async () => {
    for (const onOpenDesign of [vi.fn(() => { throw new Error("studio busy"); }), vi.fn(async () => { throw new Error("x"); })]) {
      const t = await mountedList({ onOpenDesign });
      t.openButton(BEDROOM.designId).click();
      await flush();
      expect(onOpenDesign).toHaveBeenCalledTimes(1);
      expect(t.handle.getState().open.error.kind).toBe(ERROR_KIND.HANDOFF);
      expect(t.alert().textContent).not.toContain("studio busy");
    }
  });

  it("NO INVENTED IDS — openDesign() with an id the server did not list makes no request", async () => {
    const t = await mountedList();
    await t.handle.openDesign("00000000-0000-4000-8000-000000000000");
    await t.handle.openDesign("");
    await t.handle.openDesign(undefined);
    expect(t.client.calls.map((c) => c.method)).toEqual(["listDesigns"]);
    expect(t.onOpenDesign).not.toHaveBeenCalled();
  });

  it("NO INVENTED IDS — list rows without a server designId render no button", async () => {
    const client = {
      async listDesigns() {
        return { ok: true, designs: [{ name: "ghost", updatedAt: "2026-09-01T00:00:00.000Z" }, { designId: "srv-1", name: "real", createdAt: "a", updatedAt: "b" }] };
      },
      async getDesign() { throw new Error("unused"); },
      async getRevision() { throw new Error("unused"); },
    };
    const t = setup({ client });
    await flush();
    const buttons = byClass(t.root, "fmd-open");
    expect(buttons.map((b) => b.getAttribute("data-design-id"))).toEqual(["srv-1"]);
    expect(t.root.textContent).not.toContain("ghost");
  });

  it("a malformed list body is an error, not an empty list", async () => {
    const client = { async listDesigns() { return { ok: true }; }, async getDesign() {}, async getRevision() {} };
    const t = setup({ client });
    await flush();
    expect(t.handle.getState().list.error.kind).toBe(ERROR_KIND.BAD_RESPONSE);
  });
});

describe("stale-response guards", () => {
  it("refresh while loading: only the latest list answer is rendered", async () => {
    const gates = [deferred(), deferred()];
    let n = 0;
    const lists = [
      { ok: true, designs: [{ designId: "old-1", name: "OLD", createdAt: "a", updatedAt: "a" }] },
      { ok: true, designs: [{ designId: "new-1", name: "NEW", createdAt: "b", updatedAt: "b" }] },
    ];
    const client = {
      calls: [],
      async listDesigns() {
        const i = n++;
        await gates[i].promise;
        return lists[i];
      },
      async getDesign() {}, async getRevision() {},
    };
    const t = setup({ client });
    await flush();
    const second = t.handle.refresh();
    await flush();
    gates[1].resolve();
    await second;
    await flush();
    gates[0].resolve(); // the OLD answer arrives last
    await flush();
    expect(t.handle.getState().list.designs.map((d) => d.designId)).toEqual(["new-1"]);
    expect(t.root.textContent).not.toContain("OLD");
  });

  it("a superseded list request's FAILURE does not replace a newer success", async () => {
    const gates = [deferred(), deferred()];
    let n = 0;
    const client = {
      async listDesigns() {
        const i = n++;
        await gates[i].promise;
        if (i === 0) throw fakeErrors.storageUnavailable();
        return { ok: true, designs: [] };
      },
      async getDesign() {}, async getRevision() {},
    };
    const t = setup({ client });
    await flush();
    void t.handle.refresh();
    await flush();
    gates[1].resolve();
    await flush();
    gates[0].resolve();
    await flush();
    expect(t.handle.getState().list.status).toBe(LIST_STATUS.EMPTY);
  });

  it("refresh aborts the previous list request's signal", async () => {
    const signals = [];
    const gate = deferred();
    const client = {
      async listDesigns(o) { signals.push(o.signal); await gate.promise; return { ok: true, designs: [] }; },
      async getDesign() {}, async getRevision() {},
    };
    const t = setup({ client });
    await flush();
    void t.handle.refresh();
    await flush();
    expect(signals.length).toBe(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    gate.resolve();
  });

  it("a second open supersedes the first: only the second reaches onOpenDesign", async () => {
    const gates = new Map([[BEDROOM.designId, deferred()], [HALLWAY.designId, deferred()]]);
    const client = createFakeDesignsApiClient({ ...SEED, gate: (m, args) => (m === "getRevision" ? gates.get(args[0]).promise : undefined) });
    const t = await mountedList({ client });
    // Buttons are disabled while opening, so drive the second open programmatically
    // (e.g. keyboard shortcut / caller) to exercise the guard itself.
    void t.handle.openDesign(BEDROOM.designId);
    await flush();
    void t.handle.openDesign(HALLWAY.designId);
    await flush();
    gates.get(HALLWAY.designId).resolve();
    await flush();
    gates.get(BEDROOM.designId).resolve();
    await flush();
    expect(t.onOpenDesign).toHaveBeenCalledTimes(1);
    expect(t.onOpenDesign.mock.calls[0][0].designId).toBe(HALLWAY.designId);
    expect(t.handle.getState().open.designId).toBe(HALLWAY.designId);
  });

  it("destroy mid-list-request: nothing renders afterwards, signal aborted", async () => {
    const gate = deferred();
    let signal;
    const client = {
      async listDesigns(o) { signal = o.signal; await gate.promise; return { ok: true, designs: [{ designId: "x", name: "late", createdAt: "a", updatedAt: "a" }] }; },
      async getDesign() {}, async getRevision() {},
    };
    const t = setup({ client });
    await flush();
    t.handle.destroy();
    expect(signal.aborted).toBe(true);
    expect(t.root.childNodes.length).toBe(0);
    gate.resolve();
    await flush();
    expect(t.root.childNodes.length).toBe(0);
    expect(t.handle.getState().list.status).toBe(LIST_STATUS.LOADING);
  });

  it("destroy mid-open: onOpenDesign is never called", async () => {
    const gate = deferred();
    const client = createFakeDesignsApiClient({ ...SEED, gate: (m) => (m === "getRevision" ? gate.promise : undefined) });
    const t = await mountedList({ client });
    t.openButton(BEDROOM.designId).click();
    await flush();
    t.handle.destroy();
    gate.resolve();
    await flush();
    expect(t.onOpenDesign).not.toHaveBeenCalled();
  });

  it("destroy removes listeners and markup; refresh/openDesign after destroy are no-ops", async () => {
    const t = await mountedList();
    const btn = t.openButton(BEDROOM.designId);
    const refreshBtn = byClass(t.root, "fmd-refresh")[0];
    t.handle.destroy();
    expect(btn.listenerCount()).toBe(0);
    expect(refreshBtn.listenerCount()).toBe(0);
    expect(t.root.childNodes.length).toBe(0);
    const before = t.client.calls.length;
    await t.handle.refresh();
    await t.handle.openDesign(BEDROOM.designId);
    expect(t.client.calls.length).toBe(before);
    t.handle.destroy(); // idempotent
  });

  it("refresh during an open keeps the open result and re-applies button state", async () => {
    const gate = deferred();
    const client = createFakeDesignsApiClient({ ...SEED, gate: (m) => (m === "getRevision" ? gate.promise : undefined) });
    const t = await mountedList({ client });
    t.openButton(BEDROOM.designId).click();
    await flush();
    void t.handle.refresh();
    await flush();
    expect(byClass(t.root, "fmd-open").every((b) => b.disabled)).toBe(true);
    gate.resolve();
    await flush();
    expect(t.onOpenDesign).toHaveBeenCalledTimes(1);
    expect(t.openButton(BEDROOM.designId).getAttribute("aria-current")).toBe("true");
  });
});

describe("fake client stays faithful to the pinned server shapes", () => {
  const keys = (o) => Object.keys(o).sort();
  it("list / get / revision bodies have exactly the contract key sets", async () => {
    const c = createFakeDesignsApiClient(SEED);
    const list = await c.listDesigns();
    expect(keys(list)).toEqual(LIST_BODY_KEYS);
    for (const d of list.designs) expect(keys(d)).toEqual(DESIGN_LIST_ITEM_KEYS);
    const g = await c.getDesign(BEDROOM.designId);
    expect(keys(g)).toEqual(GET_DESIGN_BODY_KEYS);
    expect(keys(g.design)).toEqual(DESIGN_SUMMARY_KEYS);
    expect(keys(g.latestRevision)).toEqual(LATEST_REVISION_KEYS);
    expect((await c.getDesign(SHELL.designId)).latestRevision).toBeNull();
    const r = await c.getRevision(BEDROOM.designId, 2);
    expect(keys(r)).toEqual(REVISION_BODY_KEYS);
  });
  it("errors carry the same status/code as the server", async () => {
    const c = createFakeDesignsApiClient(SEED);
    await expect(c.getDesign("nope")).rejects.toMatchObject({ status: 404, code: "MISSING_DESIGN" });
    await expect(c.getRevision(BEDROOM.designId, 99)).rejects.toMatchObject({ status: 404, code: "MISSING_DESIGN" });
    expect(fakeErrors.missingAuth()).toMatchObject({ status: 401, code: "MISSING_AUTH" });
    expect(fakeErrors.integrity()).toMatchObject({ status: 409, code: "REVISION_INTEGRITY_FAILED" });
  });
});

describe("Open disabled at mount (openEnabled: false) — panel shown, not hidden", () => {
  it("lists the server designs with every Open button disabled and an explanatory notice", async () => {
    const t = setup({ openEnabled: false });
    await flush();
    expect(t.handle.getState().openEnabled).toBe(false);
    expect(t.handle.getState().list.status).toBe(LIST_STATUS.LIST);
    expect(t.section().getAttribute("data-open-enabled")).toBe("false");
    const buttons = byClass(t.root, "fmd-open");
    expect(buttons.length).toBe(4);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    const notice = byClass(t.root, "fmd-notice")[0];
    expect(notice.textContent).toBe(OPEN_DISABLED_NOTICE);
    for (const b of buttons) expect(b.getAttribute("aria-describedby").split(" ")).toContain(notice.id);
    // Refresh stays usable; the list is not hidden
    expect(byClass(t.root, "fmd-refresh")[0].disabled).toBe(false);
  });

  it("clicking or calling openDesign makes no request and never calls onOpenDesign", async () => {
    const t = setup({ openEnabled: false });
    await flush();
    t.openButton(BEDROOM.designId).click();
    await t.handle.openDesign(BEDROOM.designId);
    await flush();
    expect(t.client.calls.map((c) => c.method)).toEqual(["listDesigns"]);
    expect(t.onOpenDesign).not.toHaveBeenCalled();
    expect(t.handle.getState().open.status).toBe(OPEN_STATUS.IDLE);
  });

  it("stays disabled across refresh (fixed at mount)", async () => {
    const t = setup({ openEnabled: false });
    await flush();
    await t.handle.refresh();
    await flush();
    expect(byClass(t.root, "fmd-open").every((b) => b.disabled)).toBe(true);
    expect(byClass(t.root, "fmd-notice").length).toBe(1);
  });

  it("empty and error states still render normally", async () => {
    const e = setup({ openEnabled: false, seed: { designs: [] } });
    await flush();
    expect(e.handle.getState().list.status).toBe(LIST_STATUS.EMPTY);
    const f = setup({ openEnabled: false, seed: { ...SEED, fail: { listDesigns: fakeErrors.missingAuth() } } });
    await flush();
    expect(f.handle.getState().list.error.kind).toBe(ERROR_KIND.SIGNED_OUT);
  });

  it("onOpenDesign is optional when openEnabled is false; openEnabled must be boolean", () => {
    const doc = createFakeDocument();
    const root = doc.createElement("div");
    const client = createFakeDesignsApiClient();
    expect(() => mountMyDesigns(root, { client, openEnabled: false, document: doc, autoLoad: false })).not.toThrow();
    expect(() => mountMyDesigns(root, { client, onOpenDesign() {}, openEnabled: "no", document: doc })).toThrow(/openEnabled/);
  });

  it("default (openEnabled omitted) renders no notice and enabled buttons", async () => {
    const t = await mountedList();
    expect(byClass(t.root, "fmd-notice").length).toBe(0);
    expect(byClass(t.root, "fmd-open").some((b) => b.disabled)).toBe(false);
    expect(t.section().hasAttribute("data-open-enabled")).toBe(false);
  });
});
