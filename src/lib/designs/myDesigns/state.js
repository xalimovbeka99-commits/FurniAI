/**
 * My Designs — pure state layer (no DOM, no I/O).
 *
 * Everything here is deterministic and unit-testable: the reducer, the error
 * classifier, and the response parsers that turn server bodies into the
 * values the UI is allowed to use. The parsers never invent a design id or a
 * revision: a body that lacks one is a BAD_RESPONSE, not a fallback.
 *
 * Response shapes are those of docs/m3/DESIGN_PERSISTENCE_API.md §4, pinned
 * by tests/contract/designs-api/*.contract.test.js against the real handlers.
 */

export const LIST_STATUS = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  EMPTY: "empty",
  LIST: "list",
  ERROR: "error",
});

export const OPEN_STATUS = Object.freeze({
  IDLE: "idle",
  OPENING: "opening",
  OPENED: "opened",
  ERROR: "error",
});

export const ERROR_KIND = Object.freeze({
  /** 401 MISSING_AUTH, or no access token available at all. The ONLY "sign in" signal. */
  SIGNED_OUT: "signed-out",
  /** The request never got an HTTP answer (offline, DNS, CORS, fetch threw). */
  NETWORK: "network",
  /** 5xx, or any other answer the UI has no specific path for. */
  SERVER: "server",
  /** 404 MISSING_DESIGN on open: not yours, not there, or malformed — one answer. */
  NOT_FOUND: "not-found",
  /** The design exists but has no saved revision (latestRevision: null). */
  NO_REVISION: "no-revision",
  /** 409 REVISION_INTEGRITY_FAILED on reopen: stored row no longer verifies. */
  INTEGRITY: "integrity",
  /** 2xx body that does not carry the fields the contract promises. */
  BAD_RESPONSE: "bad-response",
  /** onOpenDesign (the Studio's reopen) threw or rejected. */
  HANDOFF: "handoff",
});

export const ACTION = Object.freeze({
  LIST_REQUEST: "LIST_REQUEST",
  LIST_SUCCESS: "LIST_SUCCESS",
  LIST_FAILURE: "LIST_FAILURE",
  OPEN_REQUEST: "OPEN_REQUEST",
  OPEN_SUCCESS: "OPEN_SUCCESS",
  OPEN_FAILURE: "OPEN_FAILURE",
  OPEN_DISMISS: "OPEN_DISMISS",
});

/** @returns {MyDesignsState} */
export function createInitialState() {
  return Object.freeze({
    list: Object.freeze({ status: LIST_STATUS.IDLE, designs: Object.freeze([]), error: null, seq: 0 }),
    open: Object.freeze({ status: OPEN_STATUS.IDLE, designId: null, revision: null, name: null, error: null, seq: 0 }),
  });
}

/**
 * @typedef {{ designId: string, name: string|null, createdAt: string|null, updatedAt: string|null }} DesignRow
 * @typedef {{ kind: string, status: number|null, code: string|null }} UiError
 * @typedef {{ status: string, designs: ReadonlyArray<DesignRow>, error: UiError|null, seq: number }} ListState
 * @typedef {{ status: string, designId: string|null, revision: number|null, name: string|null, error: UiError|null, seq: number }} OpenState
 * @typedef {{ list: ListState, open: OpenState }} MyDesignsState
 */

/**
 * Pure reducer. Every *_SUCCESS / *_FAILURE carries the `seq` of the request
 * that produced it; one whose seq is not the CURRENT request's is a stale
 * answer (refresh while loading, a second open while the first was in flight)
 * and is ignored — the state object is returned unchanged.
 *
 * @param {MyDesignsState} state
 * @param {{ type: string, seq?: number, designs?: DesignRow[], error?: UiError, designId?: string, revision?: number, name?: string|null }} action
 * @returns {MyDesignsState}
 */
export function reducer(state, action) {
  switch (action.type) {
    case ACTION.LIST_REQUEST:
      return freeze({
        ...state,
        list: freeze({ status: LIST_STATUS.LOADING, designs: state.list.designs, error: null, seq: action.seq }),
      });
    case ACTION.LIST_SUCCESS: {
      if (action.seq !== state.list.seq) return state;
      const designs = Object.freeze((action.designs || []).map((d) => Object.freeze({ ...d })));
      return freeze({
        ...state,
        list: freeze({
          status: designs.length === 0 ? LIST_STATUS.EMPTY : LIST_STATUS.LIST,
          designs,
          error: null,
          seq: state.list.seq,
        }),
      });
    }
    case ACTION.LIST_FAILURE:
      if (action.seq !== state.list.seq) return state;
      return freeze({
        ...state,
        list: freeze({ status: LIST_STATUS.ERROR, designs: Object.freeze([]), error: freeze({ ...action.error }), seq: state.list.seq }),
      });
    case ACTION.OPEN_REQUEST:
      return freeze({
        ...state,
        open: freeze({
          status: OPEN_STATUS.OPENING,
          designId: action.designId,
          revision: null,
          name: action.name ?? null,
          error: null,
          seq: action.seq,
        }),
      });
    case ACTION.OPEN_SUCCESS:
      if (action.seq !== state.open.seq) return state;
      return freeze({
        ...state,
        open: freeze({
          status: OPEN_STATUS.OPENED,
          designId: action.designId,
          revision: action.revision,
          name: action.name ?? null,
          error: null,
          seq: state.open.seq,
        }),
      });
    case ACTION.OPEN_FAILURE:
      if (action.seq !== state.open.seq) return state;
      return freeze({
        ...state,
        open: freeze({
          status: OPEN_STATUS.ERROR,
          designId: state.open.designId,
          revision: null,
          name: state.open.name,
          error: freeze({ ...action.error }),
          seq: state.open.seq,
        }),
      });
    case ACTION.OPEN_DISMISS:
      if (state.open.status !== OPEN_STATUS.ERROR && state.open.status !== OPEN_STATUS.OPENED) return state;
      return freeze({
        ...state,
        open: freeze({ status: OPEN_STATUS.IDLE, designId: null, revision: null, name: null, error: null, seq: state.open.seq }),
      });
    default:
      return state;
  }
}

/** Error raised by the parsers below; carries a UI error kind directly. */
export class MyDesignsResponseError extends Error {
  /** @param {string} kind @param {string} message */
  constructor(kind, message) {
    super(message);
    this.name = "MyDesignsResponseError";
    this.kind = kind;
  }
}

const NETWORK_CODES = new Set(["NETWORK_ERROR", "NETWORK", "FETCH_FAILED", "TIMEOUT", "OFFLINE"]);

/**
 * Map anything thrown by the designs client (a DesignsApiError-like object
 * with numeric `status` and string `code`, a raw fetch TypeError, or one of
 * our own MyDesignsResponseError) to a UI error.
 *
 * @param {unknown} err
 * @param {"list"|"open"} phase
 * @returns {UiError}
 */
export function classifyError(err, phase) {
  const e = /** @type {any} */ (err) || {};
  const status = typeof e.status === "number" && Number.isFinite(e.status) ? e.status : null;
  const code = typeof e.code === "string" && e.code ? e.code : null;
  const out = (kind) => ({ kind, status, code });

  if (e instanceof MyDesignsResponseError || (typeof e.kind === "string" && e.name === "MyDesignsResponseError")) {
    return { kind: e.kind, status: null, code: null };
  }
  if (status === 401 || code === "MISSING_AUTH") return out(ERROR_KIND.SIGNED_OUT);
  if (code === "REVISION_INTEGRITY_FAILED") return out(ERROR_KIND.INTEGRITY);
  if (phase === "open" && (status === 404 || code === "MISSING_DESIGN")) return out(ERROR_KIND.NOT_FOUND);
  if (
    status === 0 ||
    (code && NETWORK_CODES.has(code)) ||
    (status === null && (e.name === "TypeError" || e instanceof TypeError))
  ) {
    return out(ERROR_KIND.NETWORK);
  }
  return out(ERROR_KIND.SERVER);
}

/**
 * GET /api/designs body -> rows the list may render.
 * Rows without a server designId are DROPPED (they cannot be opened, and the
 * module will not make an id up for them).
 *
 * @param {unknown} body `{ ok: true, designs: [...] }`
 * @returns {DesignRow[]}
 */
export function parseDesignList(body) {
  const b = /** @type {any} */ (body);
  if (!b || typeof b !== "object" || !Array.isArray(b.designs)) {
    throw new MyDesignsResponseError(ERROR_KIND.BAD_RESPONSE, "Design list response has no designs array.");
  }
  const seen = new Set();
  const rows = [];
  for (const d of b.designs) {
    if (!d || typeof d !== "object") continue;
    if (typeof d.designId !== "string" || !d.designId.trim()) continue;
    if (seen.has(d.designId)) continue;
    seen.add(d.designId);
    rows.push({
      designId: d.designId,
      name: typeof d.name === "string" ? d.name : null,
      createdAt: typeof d.createdAt === "string" ? d.createdAt : null,
      updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : null,
    });
  }
  return rows;
}

/**
 * GET /api/designs/:designId body -> the revision to reopen.
 * @param {unknown} body `{ ok: true, design: {...}, latestRevision: {...}|null }`
 * @param {string} requestedDesignId
 * @returns {{ designId: string, name: string|null, revision: number }}
 */
export function parseDesignForOpen(body, requestedDesignId) {
  const b = /** @type {any} */ (body);
  const design = b && typeof b === "object" ? b.design : null;
  if (!design || typeof design !== "object" || design.designId !== requestedDesignId) {
    throw new MyDesignsResponseError(ERROR_KIND.BAD_RESPONSE, "Design response does not describe the requested design.");
  }
  if (b.latestRevision === null) {
    throw new MyDesignsResponseError(ERROR_KIND.NO_REVISION, "This design has no saved revision yet.");
  }
  const rev = b.latestRevision && b.latestRevision.revision;
  if (!Number.isInteger(rev) || rev < 1) {
    throw new MyDesignsResponseError(ERROR_KIND.BAD_RESPONSE, "Design response has no usable latest revision.");
  }
  return { designId: design.designId, name: typeof design.name === "string" ? design.name : null, revision: rev };
}

/**
 * GET /api/designs/:designId/revisions/:revision body -> verified record.
 * The body must name exactly the design and revision that were requested.
 *
 * @param {unknown} body
 * @param {string} designId
 * @param {number} revision
 */
export function parseRevisionForOpen(body, designId, revision) {
  const b = /** @type {any} */ (body);
  if (!b || typeof b !== "object" || b.designId !== designId || b.revision !== revision) {
    throw new MyDesignsResponseError(ERROR_KIND.BAD_RESPONSE, "Revision response does not match the requested design revision.");
  }
  return Object.freeze({
    designId: b.designId,
    revision: b.revision,
    fingerprint: typeof b.fingerprint === "string" ? b.fingerprint : null,
    furniSpec: b.furniSpec ?? null,
    partGraph: b.partGraph ?? null,
    origins: b.origins ?? null,
    validationStatus: b.validationStatus ?? null,
    createdAt: typeof b.createdAt === "string" ? b.createdAt : null,
  });
}

/**
 * Customer-facing copy. Fixed strings only: server `error` text is never
 * echoed, so nothing from a response body reaches the page except a design
 * name, and that is always set via textContent.
 *
 * @param {UiError|null} error
 * @param {"list"|"open"} phase
 */
export function messageFor(error, phase) {
  if (!error) return "";
  switch (error.kind) {
    case ERROR_KIND.SIGNED_OUT:
      return phase === "open"
        ? "Your session has ended. Sign in again to open this design."
        : "Sign in to see your saved designs.";
    case ERROR_KIND.NETWORK:
      return phase === "open"
        ? "Could not reach FurniAI to open this design. Check your connection and try again."
        : "Could not reach FurniAI. Check your connection and try again.";
    case ERROR_KIND.NOT_FOUND:
      return "This design could not be opened. It may no longer be available to this account.";
    case ERROR_KIND.NO_REVISION:
      return "This design has no saved version yet, so there is nothing to open.";
    case ERROR_KIND.INTEGRITY:
      return "This saved version failed its integrity check and was not opened. Nothing was changed.";
    case ERROR_KIND.BAD_RESPONSE:
      return "FurniAI sent an unexpected answer. Nothing was opened. Please try again.";
    case ERROR_KIND.HANDOFF:
      return "The design was fetched but the Studio could not open it. Nothing was changed.";
    case ERROR_KIND.SERVER:
    default:
      if (error.code === "PERSISTENCE_NOT_CONFIGURED") return "Saved designs are not available on this deployment.";
      if (error.code === "AUTH_UNAVAILABLE") return "Sign-in could not be checked right now. Please try again shortly.";
      return phase === "open"
        ? "This design could not be opened right now. Please try again."
        : "Your designs could not be loaded right now. Please try again.";
  }
}

function freeze(o) {
  return Object.freeze(o);
}
