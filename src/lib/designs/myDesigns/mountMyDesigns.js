/**
 * My Designs — controller. Mounts the list of the signed-in customer's saved
 * designs (GET /api/designs) into a container and reopens one on request
 * (GET /api/designs/:designId, then GET /api/designs/:designId/revisions/:revision).
 *
 * This module does NOT talk HTTP itself. It is handed Antigravity's client
 * (`createDesignsApiClient()` from src/lib/persistence/designsApiClient.js)
 * and uses exactly three of its methods. It never builds a URL, never adds an
 * Authorization header, and never invents a design id or revision: every
 * value passed to `onOpenDesign` was read from a server response.
 */

import {
  ACTION,
  ERROR_KIND,
  MyDesignsResponseError,
  classifyError,
  createInitialState,
  parseDesignForOpen,
  parseDesignList,
  parseRevisionForOpen,
  reducer,
} from "./state.js";
import { createView, defaultFormatDate, ensureStyles } from "./render.js";
import { MY_DESIGNS_CSS, MY_DESIGNS_STYLE_ID } from "./styles.js";

/**
 * The part of Antigravity's designs client this module consumes.
 * Each method resolves with the PARSED JSON BODY of the 2xx response,
 * exactly as docs/m3/DESIGN_PERSISTENCE_API.md §4 documents it, and rejects
 * with a DesignsApiError on any non-2xx answer or transport failure.
 *
 * The trailing `options` argument is always passed; a client that does its
 * own token lookup may ignore `accessToken`. `signal` lets the module cancel
 * a request it no longer wants (refresh, destroy).
 *
 * @typedef {Object} DesignsApiClientLike
 * @property {(options?: DesignsCallOptions) => Promise<{ ok: true, designs: Array<{ designId: string, ownerUserId: string, name: string, createdAt: string, updatedAt: string }> }>} listDesigns
 *   GET /api/designs
 * @property {(designId: string, options?: DesignsCallOptions) => Promise<{ ok: true, design: { designId: string, ownerUserId: string, name: string, createdAt: string, updatedAt: string }, latestRevision: null | { revision: number, fingerprint: string, specId: string|null, validationStatus: string|null, createdAt: string } }>} getDesign
 *   GET /api/designs/:designId
 * @property {(designId: string, revision: number, options?: DesignsCallOptions) => Promise<{ ok: true, designId: string, revision: number, fingerprint: string, furniSpec: object, partGraph: object, origins: object|null, validationStatus: string|null, createdAt: string }>} getRevision
 *   GET /api/designs/:designId/revisions/:revision
 */

/**
 * @typedef {Object} DesignsCallOptions
 * @property {string} [accessToken] present when `getAccessToken` was supplied
 * @property {AbortSignal} [signal]
 */

/**
 * What a DesignsApiError must look like for this module to classify it.
 * `status` is the HTTP status (0 or absent = no HTTP answer at all);
 * `code` is the server's `code` field (`MISSING_AUTH`, `MISSING_DESIGN`, ...)
 * or a client transport code such as `NETWORK_ERROR`.
 *
 * @typedef {Error & { status?: number, code?: string, details?: object }} DesignsApiErrorLike
 */

/**
 * @typedef {Object} OpenDesignSelection  values from the server, never derived
 * @property {string} designId  from GET .../revisions/:revision `designId`
 * @property {number} revision  from GET .../revisions/:revision `revision` (== latestRevision.revision)
 * @property {string|null} name from GET /api/designs/:designId `design.name`
 */

/**
 * @typedef {Object} OpenDesignRecord  the reopen body, so the Studio need not refetch
 * @property {string} designId
 * @property {number} revision
 * @property {string|null} fingerprint
 * @property {object|null} furniSpec
 * @property {object|null} partGraph
 * @property {object|null} origins
 * @property {string|null} validationStatus
 * @property {string|null} createdAt
 */

/**
 * @typedef {Object} MountMyDesignsOptions
 * @property {DesignsApiClientLike} client  injected; required
 * @property {(selection: OpenDesignSelection, record: OpenDesignRecord) => (void|Promise<void>)} [onOpenDesign]
 *   required unless openEnabled is false
 * @property {boolean} [openEnabled=true]
 *   Fixed at mount. false = the list still loads and renders, every Open button is
 *   disabled with an explanatory notice, and openDesign() makes no request. For a
 *   Studio build without a reopen handler: the panel is shown, not hidden.
 * @property {() => (string|null|undefined|Promise<string|null|undefined>)} [getAccessToken]
 *   Optional. When supplied, a falsy result means "signed out" and NO request is made.
 * @property {() => void} [onSignIn]  shows a "Sign in" button in signed-out states
 * @property {Document} [document]
 * @property {(iso: string|null) => string} [formatDate]
 * @property {boolean} [injectStyles=true]
 * @property {boolean} [autoLoad=true]  call refresh() on mount
 * @property {string} [title="My designs"]
 */

/**
 * @param {HTMLElement} rootEl
 * @param {MountMyDesignsOptions} options
 * @returns {{ refresh: () => Promise<void>, openDesign: (designId: string) => Promise<void>, destroy: () => void, getState: () => import("./state.js").MyDesignsState }}
 */
export function mountMyDesigns(rootEl, options = /** @type {any} */ ({})) {
  const {
    client,
    getAccessToken,
    onOpenDesign,
    onSignIn = null,
    formatDate = defaultFormatDate,
    injectStyles = true,
    autoLoad = true,
    title,
    openEnabled = true,
  } = options;
  const doc = options.document || (rootEl && rootEl.ownerDocument) || globalThis.document;

  if (!rootEl || typeof rootEl.appendChild !== "function") throw new TypeError("mountMyDesigns: rootEl must be a DOM element.");
  if (!doc || typeof doc.createElement !== "function") throw new TypeError("mountMyDesigns: no document available.");
  for (const m of ["listDesigns", "getDesign", "getRevision"]) {
    if (!client || typeof client[m] !== "function") {
      throw new TypeError(`mountMyDesigns: client.${m} must be a function (inject createDesignsApiClient()).`);
    }
  }
  if (typeof openEnabled !== "boolean") throw new TypeError("mountMyDesigns: openEnabled must be a boolean when given.");
  if (openEnabled && typeof onOpenDesign !== "function") {
    throw new TypeError("mountMyDesigns: onOpenDesign must be a function (or pass openEnabled: false).");
  }
  if (getAccessToken !== undefined && typeof getAccessToken !== "function") {
    throw new TypeError("mountMyDesigns: getAccessToken must be a function when given.");
  }

  if (injectStyles) ensureStyles(doc, MY_DESIGNS_STYLE_ID, MY_DESIGNS_CSS);

  let state = createInitialState({ openEnabled });
  let destroyed = false;
  let listSeq = 0;
  let openSeq = 0;
  let listAbort = null;
  let openAbort = null;

  const view = createView(doc, rootEl, {
    onRefresh: () => void refresh(),
    onOpen: (id) => void openDesign(id),
    onDismiss: () => dispatch({ type: ACTION.OPEN_DISMISS }),
    onSignIn: typeof onSignIn === "function" ? onSignIn : null,
    formatDate,
    title,
    openEnabled,
  });

  function dispatch(action) {
    if (destroyed) return;
    const next = reducer(state, action);
    if (next === state) return;
    state = next;
    view.update(state);
  }

  async function resolveToken() {
    if (typeof getAccessToken !== "function") return { ok: true, token: undefined };
    let token;
    try {
      token = await getAccessToken();
    } catch {
      token = null;
    }
    if (typeof token !== "string" || !token.trim()) return { ok: false, token: null };
    return { ok: true, token };
  }

  function callOptions(token, signal) {
    const o = {};
    if (token !== undefined) o.accessToken = token;
    if (signal) o.signal = signal;
    return o;
  }

  async function refresh() {
    if (destroyed) return;
    const seq = ++listSeq;
    if (listAbort) listAbort.abort();
    listAbort = typeof AbortController === "function" ? new AbortController() : null;
    const signal = listAbort ? listAbort.signal : undefined;
    const stale = () => destroyed || seq !== listSeq;

    dispatch({ type: ACTION.LIST_REQUEST, seq });
    const auth = await resolveToken();
    if (stale()) return;
    if (!auth.ok) {
      dispatch({ type: ACTION.LIST_FAILURE, seq, error: { kind: ERROR_KIND.SIGNED_OUT, status: null, code: null } });
      return;
    }
    try {
      const body = await client.listDesigns(callOptions(auth.token, signal));
      if (stale()) return;
      dispatch({ type: ACTION.LIST_SUCCESS, seq, designs: parseDesignList(body) });
    } catch (err) {
      if (stale()) return;
      dispatch({ type: ACTION.LIST_FAILURE, seq, error: classifyError(err, "list") });
    }
  }

  async function openDesign(designId) {
    if (destroyed || !openEnabled) return;
    // Only ids the SERVER listed can be opened. An id from anywhere else
    // (a stale button, a caller's guess) is refused without a request.
    const row = state.list.designs.find((d) => d.designId === designId);
    if (!row) return;

    const seq = ++openSeq;
    if (openAbort) openAbort.abort();
    openAbort = typeof AbortController === "function" ? new AbortController() : null;
    const signal = openAbort ? openAbort.signal : undefined;
    const stale = () => destroyed || seq !== openSeq;

    dispatch({ type: ACTION.OPEN_REQUEST, seq, designId: row.designId, name: row.name });
    const auth = await resolveToken();
    if (stale()) return;
    if (!auth.ok) {
      dispatch({ type: ACTION.OPEN_FAILURE, seq, error: { kind: ERROR_KIND.SIGNED_OUT, status: null, code: null } });
      return;
    }

    let selection;
    let record;
    try {
      const designBody = await client.getDesign(row.designId, callOptions(auth.token, signal));
      if (stale()) return;
      const target = parseDesignForOpen(designBody, row.designId);

      const revisionBody = await client.getRevision(target.designId, target.revision, callOptions(auth.token, signal));
      if (stale()) return;
      record = parseRevisionForOpen(revisionBody, target.designId, target.revision);
      selection = Object.freeze({ designId: record.designId, revision: record.revision, name: target.name });
    } catch (err) {
      if (stale()) return;
      dispatch({ type: ACTION.OPEN_FAILURE, seq, error: classifyError(err, "open") });
      return;
    }

    // Last check before handing off: a superseded or destroyed open must
    // never reach the Studio.
    if (stale()) return;
    try {
      await onOpenDesign(selection, record);
    } catch {
      if (stale()) return;
      dispatch({ type: ACTION.OPEN_FAILURE, seq, error: { kind: ERROR_KIND.HANDOFF, status: null, code: null } });
      return;
    }
    if (stale()) return;
    dispatch({ type: ACTION.OPEN_SUCCESS, seq, designId: selection.designId, revision: selection.revision, name: selection.name });
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (listAbort) listAbort.abort();
    if (openAbort) openAbort.abort();
    view.destroy();
  }

  view.update(state);
  if (autoLoad) void refresh();

  return {
    refresh,
    openDesign,
    destroy,
    getState: () => state,
  };
}

export { MyDesignsResponseError };
