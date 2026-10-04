/**
 * Design save / reopen coordinator — the client half of the /api/designs contract.
 * ---------------------------------------------------------------------
 * Pure, framework-free, no DOM. The Studio calls it; it calls a designs API
 * client (Antigravity's `createDesignsApiClient`, or anything with the same
 * four methods). It exists because the protocol's safety depends on client
 * behaviour the server cannot enforce:
 *
 *   - a response must only land on the editing session that sent the request
 *     (a save or create answered after the customer reopened another design
 *     must not re-label that design);
 *   - the stored revision is not the displayed revision (Undo rewinds the
 *     display, never the stored history);
 *   - saves from one tab are serialised (two in flight would race each other
 *     for the same revision number and one would be told STALE_REVISION);
 *   - a save whose answer was lost must be resent byte-identically before any
 *     new save, or a committed save is reported as a conflict;
 *   - STALE_REVISION means "someone else saved first" — never retry blind,
 *     never bump the number, let the customer choose.
 *
 * Identities (DESIGN_PERSISTENCE_API.md §7) — never substituted for each other:
 *
 *   designId          server-assigned on create; never sent to POST /api/designs
 *   specId            FurniSpec lineage inside one design; fixed across revisions
 *   storedRevision    last revision the SERVER confirmed for this design
 *   displayed revision / change token   the UI's; passed in, never stored here
 *   sessionId         the editing session; a binding belongs to exactly one
 *
 * Every outcome is a plain object with a `status` from SAVE_OUTCOME /
 * REOPEN_OUTCOME. Nothing here throws for a protocol answer; it throws only for
 * programmer errors (missing client, missing session getter).
 */

export const SAVE_OUTCOME = Object.freeze({
  SAVED: "SAVED",
  /** The server already had exactly this revision (an earlier answer was lost). */
  REPLAYED: "REPLAYED",
  /** The session changed while the request was in flight; nothing was applied. */
  DISCARDED_STALE_SESSION: "DISCARDED_STALE_SESSION",
  /** Someone else saved first. `latest` describes what is stored. */
  CONFLICT: "CONFLICT",
  /** The design itself is not saveable (400 / fingerprint / integrity). Keep on-screen state. */
  REFUSED: "REFUSED",
  /** 401 — sign in again, then call retryPending(). */
  SIGN_IN: "SIGN_IN",
  /** Outcome unknown (network, timeout, 5xx). The identical body is kept for retryPending(). */
  UNCONFIRMED: "UNCONFIRMED",
  /** This deployment has no durable store. Keep local state. */
  NOT_CONFIGURED: "NOT_CONFIGURED",
  /** The design no longer exists for this caller (404). */
  MISSING_DESIGN: "MISSING_DESIGN",
});

export const REOPEN_OUTCOME = Object.freeze({
  REOPENED: "REOPENED",
  /** A later reopen or reset happened while this one was loading. */
  SUPERSEDED: "SUPERSEDED",
  NO_SAVED_REVISION: "NO_SAVED_REVISION",
  REFUSED: "REFUSED",
  SIGN_IN: "SIGN_IN",
  UNAVAILABLE: "UNAVAILABLE",
  MISSING_DESIGN: "MISSING_DESIGN",
  NOT_CONFIGURED: "NOT_CONFIGURED",
});

const UNKNOWN_OUTCOME_CODES = new Set(["NETWORK", "STORAGE_UNAVAILABLE", "AUTH_UNAVAILABLE", "UNKNOWN"]);

function classify(err) {
  const code = err && typeof err.code === "string" ? err.code : "UNKNOWN";
  const status = err && typeof err.status === "number" ? err.status : undefined;
  if (code === "MISSING_AUTH" || status === 401) return { kind: "SIGN_IN", code };
  if (code === "PERSISTENCE_NOT_CONFIGURED") return { kind: "NOT_CONFIGURED", code };
  if (code === "MISSING_DESIGN" || status === 404) return { kind: "MISSING_DESIGN", code };
  if (code === "STALE_REVISION") return { kind: "CONFLICT", code };
  if (UNKNOWN_OUTCOME_CODES.has(code) || (status !== undefined && status >= 500)) return { kind: "UNKNOWN", code };
  // FINGERPRINT_MISMATCH, REVISION_INTEGRITY_FAILED, CONFLICT_REVISION, INVALID_*,
  // UNSUPPORTED_COMPONENT, BAD_REQUEST: the request itself will not succeed as sent.
  return { kind: "REFUSED", code };
}

const safeError = (err) => ({
  code: err && typeof err.code === "string" ? err.code : "UNKNOWN",
  status: err && typeof err.status === "number" ? err.status : undefined,
  message: err && typeof err.message === "string" ? err.message : "",
  details: err && err.details && typeof err.details === "object" ? err.details : undefined,
});

/**
 * @param {object} deps
 * @param {object} deps.client  { createDesign, saveAcceptedRevision, getDesign, getRevision }
 * @param {() => (string|null|Promise<string|null>)} deps.getToken
 * @param {() => string} deps.getSessionId  the Studio's live editing-session id
 */
export function createDesignSaveCoordinator({ client, getToken, getSessionId } = {}) {
  for (const m of ["createDesign", "saveAcceptedRevision", "getDesign", "getRevision"]) {
    if (!client || typeof client[m] !== "function") {
      throw new TypeError(`createDesignSaveCoordinator: client.${m} is required.`);
    }
  }
  if (typeof getSessionId !== "function") throw new TypeError("createDesignSaveCoordinator: getSessionId is required.");
  if (typeof getToken !== "function") throw new TypeError("createDesignSaveCoordinator: getToken is required.");

  /**
   * The one binding: which saved design (if any) the current editing session
   * is editing. Replaced — never mutated across sessions — by bind()/reset().
   */
  let binding = { sessionId: null, designId: null, specId: null, storedRevision: null, name: null };
  /** The exact request of a save whose outcome is unknown, for identical resend. */
  let pending = null;
  /** Serialises saves: each save starts after the previous one settles. */
  let queue = Promise.resolve();
  /** Monotonic ticket for reopen/reset supersession. */
  let navTicket = 0;
  /** Change token captured by the last confirmed save in this binding. */
  let savedChangeToken = null;

  const live = () => getSessionId();
  const bindingIsLive = (b) => b === binding && b.sessionId === live();

  function snapshot() {
    return {
      sessionId: binding.sessionId,
      designId: binding.designId,
      specId: binding.specId,
      storedRevision: binding.storedRevision,
      name: binding.name,
      savedChangeToken,
      hasUnconfirmedSave: pending !== null && pending.binding === binding,
    };
  }

  /** Start editing a new, never-saved design in `sessionId`. */
  function reset(sessionId = live()) {
    navTicket += 1;
    binding = { sessionId, designId: null, specId: null, storedRevision: null, name: null };
    pending = null;
    savedChangeToken = null;
    return snapshot();
  }

  /** Bind `sessionId` to an existing saved design (after a reopen the UI has applied). */
  function bind({ sessionId = live(), designId, specId = null, storedRevision, name = null, changeToken = null }) {
    navTicket += 1;
    binding = { sessionId, designId, specId, storedRevision, name };
    pending = null;
    savedChangeToken = changeToken;
    return snapshot();
  }

  async function send(req) {
    return client.saveAcceptedRevision({ ...req.body, designId: req.designId, token: req.token });
  }

  function landed(b, req, saved, replay) {
    b.storedRevision = saved.revision;
    if (req.body.furniSpec && typeof req.body.furniSpec.specId === "string") b.specId = req.body.furniSpec.specId;
    if (b === binding) savedChangeToken = req.changeToken;
    if (pending === req) pending = null;
    return {
      status: replay ? SAVE_OUTCOME.REPLAYED : SAVE_OUTCOME.SAVED,
      designId: b.designId,
      storedRevision: saved.revision,
      fingerprint: saved.fingerprint,
      savedChangeToken: req.changeToken,
    };
  }

  async function onSaveError(b, req, err) {
    const c = classify(err);
    const error = safeError(err);
    if (c.kind === "UNKNOWN") {
      pending = req;
      return { status: SAVE_OUTCOME.UNCONFIRMED, designId: b.designId, error };
    }
    if (c.kind === "SIGN_IN") {
      pending = req; // resend the same body after sign-in
      return { status: SAVE_OUTCOME.SIGN_IN, designId: b.designId, error };
    }
    if (pending === req) pending = null;
    if (c.kind === "CONFLICT") {
      let latest = null;
      try {
        const token = await getToken();
        const summary = await client.getDesign({ designId: b.designId, token });
        latest = summary && summary.latestRevision ? summary.latestRevision : null;
      } catch {
        latest = null;
      }
      return {
        status: SAVE_OUTCOME.CONFLICT,
        designId: b.designId,
        storedRevision: b.storedRevision,
        latest,
        error,
      };
    }
    if (c.kind === "NOT_CONFIGURED") return { status: SAVE_OUTCOME.NOT_CONFIGURED, error };
    if (c.kind === "MISSING_DESIGN") return { status: SAVE_OUTCOME.MISSING_DESIGN, designId: b.designId, error };
    return { status: SAVE_OUTCOME.REFUSED, designId: b.designId, error };
  }

  async function resend(b, req) {
    try {
      const token = (await getToken()) || req.token;
      const saved = await send({ ...req, token });
      if (!bindingIsLive(b)) return { status: SAVE_OUTCOME.DISCARDED_STALE_SESSION, designId: b.designId };
      return landed(b, req, saved, saved && saved.idempotentReplay === true);
    } catch (err) {
      if (!bindingIsLive(b)) return { status: SAVE_OUTCOME.DISCARDED_STALE_SESSION, designId: b.designId };
      return onSaveError(b, req, err);
    }
  }

  async function doSave({ furniSpec, partGraph, fingerprint, origins = {}, name, changeToken = null, validationStatus = "ACCEPTED" }) {
    const b = binding;
    const startedIn = live();
    if (b.sessionId !== startedIn) {
      // The UI rotated the session without calling reset()/bind(): refuse
      // rather than write the new session's design into the old binding.
      return { status: SAVE_OUTCOME.DISCARDED_STALE_SESSION, designId: b.designId };
    }

    // 1. An earlier save whose answer was lost is resolved first, identically.
    if (pending && pending.binding === b) {
      const first = await resend(b, pending);
      if (first.status !== SAVE_OUTCOME.SAVED && first.status !== SAVE_OUTCOME.REPLAYED) return first;
    }

    const token = await getToken();
    if (!token) return { status: SAVE_OUTCOME.SIGN_IN, designId: b.designId, error: { code: "MISSING_AUTH" } };

    // 2. Create the design shell once. The id is the server's; it is adopted
    //    only by the session that asked for it.
    if (!b.designId) {
      let created;
      try {
        created = await client.createDesign({ name: name || b.name || "Wardrobe design", token });
      } catch (err) {
        if (!bindingIsLive(b)) return { status: SAVE_OUTCOME.DISCARDED_STALE_SESSION, designId: null };
        const c = classify(err);
        // A lost create answer is harmless (an empty shell); nothing to resend.
        const status =
          c.kind === "SIGN_IN" ? SAVE_OUTCOME.SIGN_IN
          : c.kind === "NOT_CONFIGURED" ? SAVE_OUTCOME.NOT_CONFIGURED
          : c.kind === "UNKNOWN" ? SAVE_OUTCOME.UNCONFIRMED
          : SAVE_OUTCOME.REFUSED;
        return { status, designId: null, error: safeError(err) };
      }
      if (!bindingIsLive(b)) {
        return {
          status: SAVE_OUTCOME.DISCARDED_STALE_SESSION,
          designId: null,
          orphanedDesignId: created && created.designId ? created.designId : null,
        };
      }
      b.designId = created.designId;
      b.name = created.name ?? name ?? null;
    }

    // 3. Append storedRevision + 1, stating what it builds on. The displayed
    //    revision (which Undo rewinds) is deliberately not consulted.
    const prior = b.storedRevision;
    const req = {
      binding: b,
      designId: b.designId,
      token,
      changeToken,
      body: {
        revision: prior == null ? 1 : prior + 1,
        expectedPreviousRevision: prior == null ? null : prior,
        fingerprint,
        furniSpec,
        partGraph,
        origins,
        validationStatus,
      },
    };
    try {
      const saved = await send(req);
      if (!bindingIsLive(b)) return { status: SAVE_OUTCOME.DISCARDED_STALE_SESSION, designId: b.designId };
      return landed(b, req, saved, saved && saved.idempotentReplay === true);
    } catch (err) {
      if (!bindingIsLive(b)) return { status: SAVE_OUTCOME.DISCARDED_STALE_SESSION, designId: b.designId };
      return onSaveError(b, req, err);
    }
  }

  /** Save the design currently on screen. Saves are serialised. */
  function save(args) {
    const run = queue.then(() => doSave(args));
    queue = run.catch(() => undefined);
    return run;
  }

  /** Resend the unconfirmed save identically (after UNCONFIRMED or SIGN_IN). */
  function retryPending() {
    const run = queue.then(async () => {
      const b = binding;
      if (!pending || pending.binding !== b) return { status: SAVE_OUTCOME.SAVED, designId: b.designId, storedRevision: b.storedRevision, nothingPending: true };
      if (b.sessionId !== live()) return { status: SAVE_OUTCOME.DISCARDED_STALE_SESSION, designId: b.designId };
      return resend(b, pending);
    });
    queue = run.catch(() => undefined);
    return run;
  }

  /**
   * After CONFLICT the customer chose to keep what is on screen: build on the
   * revision that is actually stored. The next save() is latest + 1 with
   * expectedPreviousRevision = latest. (To take theirs, reopen it instead.)
   */
  function adoptLatestAsBase(latestRevision) {
    if (!Number.isInteger(latestRevision) || latestRevision < 1) {
      throw new TypeError("adoptLatestAsBase requires the stored latest revision number.");
    }
    binding.storedRevision = latestRevision;
    savedChangeToken = null;
    return snapshot();
  }

  /**
   * Fetch a saved revision. Does NOT change the binding: the UI rotates its
   * editing session, replaces its state from `payload`, then calls
   * bind({ sessionId: <new>, designId, storedRevision: payload.revision, specId }).
   * A reopen overtaken by another reopen or a reset answers SUPERSEDED.
   */
  async function reopen({ designId, revision } = {}) {
    navTicket += 1;
    const ticket = navTicket;
    const superseded = () => ticket !== navTicket;
    try {
      const token = await getToken();
      if (!token) return { status: REOPEN_OUTCOME.SIGN_IN };
      let rev = revision;
      let summary = null;
      if (rev == null) {
        summary = await client.getDesign({ designId, token });
        if (superseded()) return { status: REOPEN_OUTCOME.SUPERSEDED };
        rev = summary && summary.latestRevision ? summary.latestRevision.revision : null;
        if (rev == null) return { status: REOPEN_OUTCOME.NO_SAVED_REVISION, designId };
      }
      const payload = await client.getRevision({ designId, revision: rev, token });
      if (superseded()) return { status: REOPEN_OUTCOME.SUPERSEDED };
      return {
        status: REOPEN_OUTCOME.REOPENED,
        designId: payload.designId || designId,
        storedRevision: payload.revision,
        specId: payload.furniSpec && payload.furniSpec.specId,
        name: summary && summary.design ? summary.design.name : null,
        payload,
      };
    } catch (err) {
      if (superseded()) return { status: REOPEN_OUTCOME.SUPERSEDED };
      const c = classify(err);
      const error = safeError(err);
      if (c.kind === "SIGN_IN") return { status: REOPEN_OUTCOME.SIGN_IN, error };
      if (c.kind === "MISSING_DESIGN") return { status: REOPEN_OUTCOME.MISSING_DESIGN, error };
      if (c.kind === "NOT_CONFIGURED") return { status: REOPEN_OUTCOME.NOT_CONFIGURED, error };
      if (c.kind === "UNKNOWN") return { status: REOPEN_OUTCOME.UNAVAILABLE, error };
      return { status: REOPEN_OUTCOME.REFUSED, error }; // e.g. REVISION_INTEGRITY_FAILED
    }
  }

  /** True only if the design on screen (its change token) is the one last confirmed saved. */
  function isSaved(currentChangeToken) {
    return savedChangeToken !== null && currentChangeToken === savedChangeToken && binding.sessionId === live();
  }

  return { save, retryPending, reopen, bind, reset, adoptLatestAsBase, isSaved, snapshot };
}
