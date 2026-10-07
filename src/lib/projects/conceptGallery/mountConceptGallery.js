/**
 * Concept gallery: the caller's AI visual concepts from
 * GET /api/creative?resource=jobs (contract: docs/creative/SCENARIO_3D_API_CONTRACT.md
 * revision 2, PROPOSED, at f472aef). Framework-free; renders into `root` without innerHTML.
 *
 * Retry policy (Bekzod, 7 Oct): the gallery never repeats a failed request by itself.
 * Every failed list, Open or Download shows a visible "Try again"; only a click runs it again.
 * Polling a running job is status checking (3–5 s, stops when terminal or destroyed); after
 * POLL_FAILURES_BEFORE_PAUSE failed rounds in a row, or one 429, it pauses until the user asks.
 * Reload: nothing is kept in browser storage; the server's job list rebuilds the gallery and
 * unfinished jobs resume polling.
 *
 * Everything the gallery needs that Asset Engineer's viewer already does
 * (src/lib/assetViewer; v2.1 at b34e259, v3 at 1bb8b59) is INJECTED, never rebuilt:
 *   - creativeSource = createCreativeAssetSource({ fetchImpl, getAuthToken })
 *       .resolve(jobId, index, { signal }) -> fresh { url, format, filename, concept, ... } per call
 *       .getJob(jobId, { signal })         -> { job, refresh }
 *   - mountAssetViewer(el, { ...viewerOptions, creativeSource, renderConceptNotice: false, autoRetry: false })
 *       -> handle with load({ jobId, index, format, autoRetry: false }), getState() and dispose().
 *       Retries are user-initiated only, so the gallery passes autoRetry:false EXPLICITLY at mount
 *       and on every load(). Viewer v3 (1bb8b59) defaults autoRetry to false and, when it is off,
 *       shows its own focusable Try again that re-resolves fresh (AE-1, resolved). Older viewers
 *       (v2.1) ignore the unknown option and still work, but they re-resolve once and retry a
 *       display failure once by themselves; that is Asset Engineer's code, the gallery adds none.
 * The gallery imports nothing from their code. The only call v2 does not cover is the
 * list, so that is the one thing the gallery asks of `client` (createCreativeJobsClient).
 * The gallery always renders concept.notice itself (card and viewer panel).
 *
 * @typedef {object} CreativeJobsListClient
 *   Thin injected client for the list. It receives the bearer token from
 *   getAccessToken() (same rules as /api/designs) and resolves with the
 *   parsed `ok:true` body. On a non-2xx answer it rejects with
 *   `{ status, code, message?, details? }` (`code` from the
 *   `{ ok:false, code, error, details? }` body); on a network failure it
 *   rejects with no `status`.
 * @property {(args: { accessToken: string, signal?: AbortSignal }) => Promise<{ jobs: object[] }>} listJobs
 *   GET ?resource=jobs. Newest first, at most 50. Reads the store only.
 * @property {(args: { jobId: string, accessToken: string, signal?: AbortSignal }) => Promise<{ job: object, refresh?: object }>} [getJob]
 *   Only used when no creativeSource is injected.
 *
 * @typedef {object} OpenConceptRequest
 * @property {string} jobId
 * @property {number} index
 * @property {string|null} format      "glb" | "gltf" (only these are offered for opening)
 * @property {string|null} mimeType
 * @property {string} notice
 * @property {() => Promise<string>} resolveUrl  creativeSource.resolve() on every call; never a URL.
 *
 * @param {Element} root
 * @param {{
 *   client: CreativeJobsListClient,
 *   getAccessToken: () => (string|null|Promise<string|null>),
 *   creativeSource?: { resolve: Function, getJob?: Function },   // alias: assetResolver
 *   assetResolver?: { resolve: Function, getJob?: Function },
 *   mountAssetViewer?: (el: Element, options: object) => { load: Function, dispose: Function },
 *   viewerOptions?: object,            // e.g. { three, deps } for mountAssetViewer
 *   onOpenConcept?: (req: OpenConceptRequest) => void,
 *   pollIntervalMs?: number,
 *   formatDate?: (iso: string) => string,
 *   startDownload?: (args: { url: string, filename: string, jobId: string, index: number, format: string|null }) => void,
 *   title?: string,
 *   resolveReferenceThumbnail?: (args: { referenceId: string, jobId: string, signal?: AbortSignal }) => Promise<string|null>,
 * }} options
 * @returns {{ refresh: () => Promise<void>, destroy: () => void, getState: () => object }}
 */
import { CODE, FALLBACK_CONCEPT_NOTICE, MAX_POLL_MS, MIN_POLL_MS, POLL_FAILURES_BEFORE_PAUSE, isViewableFormat } from "./contract.js";
import { ASSET_MESSAGES, ConceptAssetError, DISPLAY_FAILED_MESSAGE, DISPLAY_FAILURE_CODES, ERROR_KIND, classifyError, isAbortError } from "./errors.js";
import { defaultFormatDate, el, pollingText, renderBody } from "./render.js";
import { LIST_STATUS, assetKey, availabilityFrom, hasPollableJobs, initialState, reduce, snapshot } from "./state.js";
import { CONCEPT_GALLERY_CSS, CONCEPT_GALLERY_STYLE_ID } from "./styles.js";

let mountCount = 0;

export function clampPollInterval(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return 4000;
  return Math.min(MAX_POLL_MS, Math.max(MIN_POLL_MS, n));
}

/** Failures about the job record (or the account's access to it), not one file: the card is locked. */
/**
 * Failures about one job record. 403 is NOT one of them (AE Q15, Oct 5): the backend's 403 is
 * about the account/session, and another person's job answers 404 MISSING_JOB, so a 403 from a
 * poll, Open or Download is page-wide, like a signed-out list (see goPageWide).
 */
const JOB_LEVEL_KINDS = new Set([ERROR_KIND.INTEGRITY, ERROR_KIND.NOT_FOUND]);
const PAGE_WIDE_KINDS = new Set([ERROR_KIND.SIGNED_OUT, ERROR_KIND.FORBIDDEN]);

function signedOutError() {
  return { status: null, code: CODE.SIGNED_OUT };
}

function findByAttr(node, name, value) {
  for (const c of node.childNodes || []) {
    if (c.nodeType !== 1) continue;
    if (c.getAttribute(name) === value) return c;
    const hit = findByAttr(c, name, value);
    if (hit) return hit;
  }
  return null;
}

function contains(ancestor, node) {
  for (let n = node; n; n = n.parentNode) if (n === ancestor) return true;
  return false;
}

export function mountConceptGallery(root, options = {}) {
  if (!root || typeof root.appendChild !== "function") throw new TypeError("mountConceptGallery: root element is required");
  const { client, getAccessToken } = options;
  if (!client || typeof client.listJobs !== "function") throw new TypeError("mountConceptGallery: client.listJobs is required");
  if (typeof getAccessToken !== "function") throw new TypeError("mountConceptGallery: getAccessToken is required");
  const sourceOpt = options.creativeSource || options.assetResolver || null;
  if (sourceOpt && typeof sourceOpt.resolve !== "function") throw new TypeError("mountConceptGallery: creativeSource.resolve is required");
  const source = sourceOpt;
  const hasSourceJob = Boolean(source && typeof source.getJob === "function");
  if (!hasSourceJob && typeof client.getJob !== "function") {
    throw new TypeError("mountConceptGallery: creativeSource.getJob or client.getJob is required");
  }

  const doc = root.ownerDocument || globalThis.document;
  const interval = clampPollInterval(options.pollIntervalMs ?? 4000);
  const formatDate = typeof options.formatDate === "function" ? options.formatDate : defaultFormatDate;
  const onOpenConcept = typeof options.onOpenConcept === "function" ? options.onOpenConcept : null;
  const mountViewer = source && typeof options.mountAssetViewer === "function" ? options.mountAssetViewer : null;
  const viewerOptions = options.viewerOptions && typeof options.viewerOptions === "object" ? options.viewerOptions : {};
  const startDownload = typeof options.startDownload === "function" ? options.startDownload : defaultStartDownload;
  const resolveThumb = typeof options.resolveReferenceThumbnail === "function" ? options.resolveReferenceThumbnail : null;
  /** jobId -> thumbnail address. Kept here, never in state or storage; dropped on every list load. */
  const thumbUrls = new Map();
  const setT = (fn, ms) => globalThis.setTimeout(fn, ms);
  const clearT = (id) => globalThis.clearTimeout(id);
  const idPrefix = `fcg${++mountCount}`;

  let state = initialState();
  let destroyed = false;
  let listSeq = 0;
  let pollGen = 0;
  let timer = null;
  let nextDelay = interval;
  const controllers = new Set();

  injectStyles(doc);
  const titleId = `${idPrefix}-title`;
  const refreshBtn = el(doc, "button", { type: "button", class: "fcg-btn", "data-action": "refresh", text: "Refresh" });
  refreshBtn.addEventListener("click", () => {
    refresh();
  });
  const live = el(doc, "p", { class: "fcg-live", role: "status", "aria-live": "polite" });
  const announcer = el(doc, "p", { class: "fcg-sr", role: "alert", "aria-live": "assertive", "data-announcer": "" });
  const body = el(doc, "div", { class: "fcg-content" });
  const viewerSlot = el(doc, "div", { class: "fcg-viewer-slot" });
  const section = el(
    doc,
    "section",
    { class: "fcg", "aria-labelledby": titleId, "data-concept-gallery": "" },
    el(doc, "div", { class: "fcg-head" }, el(doc, "h2", { class: "fcg-title", id: titleId, text: options.title || "3D concepts" }), refreshBtn),
    el(doc, "p", { class: "fcg-sub", "data-concept-intro": "", text: "AI visual concepts made from your reference images. They are not dimensioned designs: they have no measurements and can't be opened in the Studio." }),
    live,
    announcer,
    viewerSlot,
    body,
  );
  root.appendChild(section);

  const ctx = {
    idPrefix,
    formatDate,
    canOpen: Boolean(source && (onOpenConcept || mountViewer)),
    canDownload: Boolean(source),
    onRefresh: () => {
      refresh();
    },
    onOpen: (jobId, index) => openConcept(jobId, index),
    onDownload: (jobId, index) => {
      download(jobId, index).catch(() => {});
    },
    /** The visible "Try again" on a failed Open/Download: the ONLY way that request runs again. */
    onRetryAsset: (jobId, index, action) => {
      if (action === "open") openConcept(jobId, index);
      else download(jobId, index).catch(() => {});
    },
    /** The visible "Check status again" after polling paused. */
    onResumePolling: () => resumePolling(),
    thumbFor: (jobId) => thumbUrls.get(jobId) || null,
    onThumbError: (jobId) => {
      thumbUrls.delete(jobId);
      dispatch({ type: "THUMB", jobId, phase: "none" });
    },
  };

  function render() {
    if (destroyed) return;
    const active = doc.activeElement;
    const focusKey = active && contains(section, active) ? active.getAttribute?.("data-focus-key") : null;
    section.setAttribute("aria-busy", state.list === LIST_STATUS.LOADING ? "true" : "false");
    refreshBtn.disabled = state.list === LIST_STATUS.LOADING;
    renderBody(doc, body, state, ctx);
    const text = pollingText(state, nextDelay);
    if (live.textContent !== text) live.textContent = text;
    if (focusKey) {
      const target = findByAttr(body, "data-focus-key", focusKey);
      if (target && typeof target.focus === "function") target.focus();
    }
  }

  function dispatch(action) {
    if (destroyed) return;
    state = reduce(state, action);
    render();
  }

  function announce(text) {
    if (!destroyed && announcer.textContent !== text) announcer.textContent = text;
  }

  function track() {
    const c = typeof AbortController === "function" ? new AbortController() : null;
    if (c) controllers.add(c);
    return {
      signal: c ? c.signal : undefined,
      done: () => c && controllers.delete(c),
      abort: () => c && (c.abort(), controllers.delete(c)),
    };
  }

  async function token() {
    const t = await getAccessToken();
    if (typeof t !== "string" || !t) throw signedOutError();
    return t;
  }

  /** Signed out (401) or not allowed (403): the whole list is replaced by one panel; polling stops. */
  function goPageWide(err) {
    stopPolling();
    dispatch({ type: "SIGNED_OUT", error: err });
  }

  // ---- list ---------------------------------------------------------------
  let listTrack = null;
  async function refresh() {
    if (destroyed) return;
    const seq = ++listSeq;
    stopPolling();
    if (listTrack) listTrack.abort(); // a newer list supersedes the older one
    dispatch({ type: "LIST_START" });
    const t = (listTrack = track());
    try {
      const accessToken = await token();
      const res = await client.listJobs({ accessToken, signal: t.signal });
      if (destroyed || seq !== listSeq) return;
      thumbUrls.clear();
      dispatch({ type: "LIST_OK", jobs: res && res.jobs });
      schedulePoll(interval, true);
      loadAvailability(accessToken, seq);
      loadThumbs(seq);
    } catch (err) {
      if (destroyed || seq !== listSeq || isAbortError(err)) return;
      const c = classifyError(err);
      if (c.kind === ERROR_KIND.SIGNED_OUT) goPageWide(c);
      else dispatch({ type: "LIST_ERR", error: c });
    } finally {
      t.done();
    }
  }

  /** GET ?resource=config once per list load, if the client has it. Never retried; a failure says "unknown". */
  async function loadAvailability(accessToken, seq) {
    if (typeof client.getConfig !== "function") return;
    const t = track();
    try {
      const cfg = await client.getConfig({ accessToken, signal: t.signal });
      if (!destroyed && seq === listSeq) dispatch({ type: "AVAILABILITY", availability: availabilityFrom(cfg) });
    } catch (err) {
      if (!destroyed && seq === listSeq && !isAbortError(err)) dispatch({ type: "AVAILABILITY", availability: availabilityFrom(null) });
    } finally {
      t.done();
    }
  }

  /** Reference thumbnails through the host's resolver (the contract has no field). One try each. */
  function loadThumbs(seq) {
    if (!resolveThumb || state.list !== LIST_STATUS.READY) return;
    for (const job of state.jobs) {
      if (!job.sourceReferenceId) continue;
      dispatch({ type: "THUMB", jobId: job.jobId, phase: "loading" });
      const t = track();
      Promise.resolve()
        .then(() => resolveThumb({ referenceId: job.sourceReferenceId, jobId: job.jobId, signal: t.signal }))
        .then(
          (u) => {
            if (destroyed || seq !== listSeq) return;
            const ok = typeof u === "string" && /^(https?:|blob:|data:image\/)/i.test(u);
            if (ok) thumbUrls.set(job.jobId, u);
            dispatch({ type: "THUMB", jobId: job.jobId, phase: ok ? "ready" : "none" });
          },
          () => {
            if (!destroyed && seq === listSeq) dispatch({ type: "THUMB", jobId: job.jobId, phase: "none" });
          },
        )
        .finally(() => t.done());
    }
  }

  // ---- polling ------------------------------------------------------------
  const isHidden = () => Boolean(doc.hidden) || doc.visibilityState === "hidden";

  function stopPolling() {
    pollGen++;
    if (timer !== null) clearT(timer);
    timer = null;
    if (state.polling) dispatch({ type: "POLLING", polling: false, failures: 0 });
  }

  function schedulePoll(delay, reset = false) {
    if (destroyed) return;
    if (timer !== null) clearT(timer);
    timer = null;
    if (isHidden() || state.list !== LIST_STATUS.READY || state.pollPaused || !hasPollableJobs(state)) {
      if (state.polling) dispatch({ type: "POLLING", polling: false, failures: 0 });
      return;
    }
    nextDelay = delay;
    const gen = pollGen;
    timer = setT(() => {
      timer = null;
      if (gen === pollGen) pollRound(gen);
    }, delay);
    if (!state.polling || reset) dispatch({ type: "POLLING", polling: true, failures: reset ? 0 : state.pollFailures });
  }

  async function pollRound(gen) {
    if (destroyed || isHidden()) return;
    const seq = listSeq;
    const ids = state.jobs.filter((j) => hasPollableJobs({ ...state, jobs: [j] })).map((j) => j.jobId);
    let accessToken = null;
    if (!hasSourceJob) {
      try {
        accessToken = await token();
      } catch (err) {
        if (!destroyed && gen === pollGen) goPageWide(classifyError(err));
        return;
      }
    }
    const t = track();
    const results = await Promise.all(
      ids.map((jobId) =>
        fetchJob(jobId, accessToken, t.signal).then(
          (res) => ({ jobId, res }),
          (err) => ({ jobId, err }),
        ),
      ),
    );
    t.done();
    if (destroyed || gen !== pollGen || seq !== listSeq) return; // stale round
    let failed = null;
    for (const r of results) {
      if (r.res) {
        if (r.res.job) dispatch({ type: "JOB_OK", job: r.res.job, refresh: r.res.refresh });
        else failed = failed || { kind: ERROR_KIND.MALFORMED, code: CODE.INVALID_RESPONSE };
        continue;
      }
      if (isAbortError(r.err)) return;
      const c = classifyError(r.err);
      if (PAGE_WIDE_KINDS.has(c.kind)) return goPageWide(c);
      if (JOB_LEVEL_KINDS.has(c.kind)) dispatch({ type: "JOB_ERR", jobId: r.jobId, error: c });
      else if (!failed || c.kind === ERROR_KIND.RATE_LIMITED) failed = c;
    }
    const failures = failed ? state.pollFailures + 1 : 0;
    // A 429 means "ask less": status checks pause at once. Other failures pause after a few rounds.
    // Nothing restarts them but the user ("Check status again"), Refresh or a reload.
    if (failed && (failed.kind === ERROR_KIND.RATE_LIMITED || failures >= POLL_FAILURES_BEFORE_PAUSE)) {
      pausePolling(failed);
      return;
    }
    // Still status checking, still inside the contract's 3–5 s window (no exponential backoff).
    const delay = failed ? MAX_POLL_MS : interval;
    nextDelay = delay;
    dispatch({ type: "POLLING", polling: true, failures });
    schedulePoll(delay);
  }

  function pausePolling(error) {
    pollGen++;
    if (timer !== null) clearT(timer);
    timer = null;
    dispatch({ type: "POLL_PAUSED", error: { kind: error.kind, code: error.code } });
    announce("Status checks are paused. Use Check status again when you're ready.");
  }

  function resumePolling() {
    if (destroyed || !state.pollPaused) return;
    dispatch({ type: "POLL_RESUMED" });
    schedulePoll(0, true);
  }

  function onVisibility() {
    if (destroyed) return;
    if (isHidden()) stopPolling();
    else if (state.list === LIST_STATUS.READY && !state.pollPaused && hasPollableJobs(state)) schedulePoll(0, true);
  }
  if (typeof doc.addEventListener === "function") doc.addEventListener("visibilitychange", onVisibility);

  /** getJob through the injected creative source (v2), else the list client. */
  function fetchJob(jobId, accessToken, signal) {
    return hasSourceJob ? source.getJob(jobId, { signal }) : client.getJob({ jobId, accessToken, signal });
  }

  /** One getJob for a job the server says isn't ready (e.g. after ASSET_NOT_READY). */
  async function refreshOneJob(jobId) {
    const seq = listSeq;
    const t = track();
    try {
      const res = await fetchJob(jobId, hasSourceJob ? null : await token(), t.signal);
      if (!destroyed && seq === listSeq && res?.job) {
        dispatch({ type: "JOB_OK", job: res.job, refresh: res.refresh });
        if (!state.polling && !state.pollPaused) schedulePoll(interval, true);
      }
    } catch (err) {
      if (destroyed || isAbortError(err)) return;
      const c = classifyError(err);
      if (c.kind === ERROR_KIND.FORBIDDEN) goPageWide(c);
      else if (JOB_LEVEL_KINDS.has(c.kind)) dispatch({ type: "JOB_ERR", jobId, error: c });
    } finally {
      t.done();
    }
  }

  // ---- assets: a fresh address on every open / download ---------------------
  async function resolveAssetOnce(jobId, index) {
    const t = track();
    try {
      const d = await source.resolve(jobId, index, { signal: t.signal }); // fresh address on every call
      // v2.1's source already answers RESOLVE_MALFORMED for this; a custom source may not.
      if (!d || typeof d.url !== "string" || !d.url) throw { status: null, code: CODE.INVALID_RESPONSE, details: { cause: "malformed", retryable: false } };
      return d;
    } finally {
      t.done();
    }
  }

  /**
   * One resolve per user action, never more. The earlier one-shot automatic re-resolve (and its
   * ~1 s 429 wait) is gone: a failure shows "Try again" and only a click resolves again.
   */
  async function resolveAsset(jobId, index) {
    try {
      return await resolveAssetOnce(jobId, index);
    } catch (err) {
      if (isAbortError(err)) throw err;
      throw new ConceptAssetError(classifyError(err), err);
    }
  }

  async function runAsset(jobId, index, action) {
    const key = assetKey(jobId, index);
    announce("");
    dispatch({ type: "ASSET_START", key, action });
    try {
      const asset = await resolveAsset(jobId, index);
      dispatch({ type: "ASSET_OK", key });
      return asset;
    } catch (err) {
      if (destroyed || isAbortError(err)) throw err;
      const e = err instanceof ConceptAssetError ? err : new ConceptAssetError(classifyError(err), err);
      dispatch({ type: "ASSET_ERR", key, action, error: { kind: e.kind, code: e.code } });
      announce(ASSET_MESSAGES[e.kind] || ASSET_MESSAGES[ERROR_KIND.REQUEST]);
      afterAssetFailure(jobId, { kind: e.kind, code: e.code, status: e.status });
      throw e;
    }
  }

  function findOutput(jobId, index) {
    const job = state.jobs.find((j) => j.jobId === jobId);
    const output = job && job.outputs.find((o) => o.index === index);
    return job && output ? { job, output } : null;
  }

  function openConcept(jobId, index) {
    const hit = findOutput(jobId, index);
    if (!hit || !source || !(onOpenConcept || mountViewer) || !isViewableFormat(hit.output.format)) return;
    if (state.assets[assetKey(jobId, index)]?.phase === "resolving") return;
    const request = Object.freeze({
      jobId,
      index,
      format: hit.output.format,
      mimeType: hit.output.mimeType,
      notice: hit.job.notice || FALLBACK_CONCEPT_NOTICE,
      resolveUrl: () => runAsset(jobId, index, "open").then((asset) => asset.url),
    });
    if (mountViewer) {
      openerKey = `open:${assetKey(jobId, index)}`;
      openInViewer(request, hit.job.concept);
    }
    if (onOpenConcept) {
      try {
        onOpenConcept(request);
      } catch {
        /* the host's error is its own; the gallery keeps working */
      }
    }
  }

  // ---- injected viewer (Asset Engineer's mountAssetViewer v2) ----------------
  let viewer = null;
  let viewerPanel = null;
  let viewerStatus = null;
  let viewerHost = null;
  let viewerNotice = null;
  let openSeq = 0;
  /** data-focus-key of the Open button that opened the panel, so Close can hand focus back. */
  let openerKey = null;

  function closeViewer() {
    openSeq++;
    if (viewer) {
      try {
        viewer.dispose();
      } catch {
        /* already gone */
      }
    }
    viewer = null;
    viewerStatus = null;
    viewerHost = null;
    viewerNotice = null;
    if (viewerPanel && viewerPanel.parentNode) viewerPanel.parentNode.removeChild(viewerPanel);
    viewerPanel = null;
  }

  function ensureViewer(request) {
    const heading = el(doc, "h3", { class: "fcg-viewer-title", id: `${idPrefix}-viewer-title`, tabindex: "-1" }, "3D view: concept ", el(doc, "code", { class: "fcg-id", text: request.jobId }));
    const close = el(doc, "button", { type: "button", class: "fcg-btn", "data-action": "close-viewer", text: "Close 3D view" });
    close.addEventListener("click", () => {
      const key = openerKey;
      closeViewer();
      // Focus goes back to the Open button that opened the panel (it may be gone after a refresh).
      const target = key ? findByAttr(body, "data-focus-key", key) : null;
      if (target && typeof target.focus === "function") target.focus();
      else if (typeof refreshBtn.focus === "function") refreshBtn.focus();
    });
    if (!viewerPanel) {
      viewerHost = el(doc, "div", { class: "fcg-viewer-host" });
      viewerStatus = el(doc, "p", { class: "fcg-hint", "data-viewer-status": "" });
      viewerPanel = el(doc, "section", { class: "fcg-viewer", "aria-labelledby": `${idPrefix}-viewer-title`, "data-viewer-panel": "" });
      viewerSlot.appendChild(viewerPanel);
      // The viewer resolves the address itself through the same injected source.
      // renderConceptNotice:false: the panel shows the notice itself (always), so the
      // viewer's overlay must not show it a second time. autoRetry:false: retries are
      // user-initiated only (viewer v3; older viewers ignore it). Both set last so
      // viewerOptions can't override them.
      viewer = mountViewer(viewerHost, { ...viewerOptions, creativeSource: source, renderConceptNotice: false, autoRetry: false });
    }
    viewerPanel.textContent = "";
    viewerPanel.appendChild(el(doc, "div", { class: "fcg-viewer-head" }, heading, close));
    viewerNotice = el(doc, "p", { class: "fcg-notice", "data-concept-notice": "", text: request.notice });
    viewerPanel.appendChild(viewerNotice);
    viewerPanel.appendChild(viewerHost);
    viewerPanel.appendChild(viewerStatus);
    viewerPanel.setAttribute("data-job-id", request.jobId);
    if (typeof heading.focus === "function") heading.focus();
  }

  async function openInViewer(request, concept) {
    const seq = ++openSeq;
    try {
      ensureViewer(request);
    } catch {
      closeViewer();
      announce("The 3D view couldn't start on this page.");
      return;
    }
    const key = assetKey(request.jobId, request.index);
    const setStatus = (text, code) => {
      if (seq !== openSeq || !viewerStatus) return;
      viewerStatus.textContent = text;
      if (code) viewerStatus.setAttribute("data-code", code);
      else viewerStatus.removeAttribute("data-code");
    };
    setStatus("Opening the 3D view…");
    dispatch({ type: "ASSET_START", key, action: "open" });
    let result;
    try {
      // A job-output reference, never a URL; the viewer resolves fresh. autoRetry:false per call
      // (viewer v3): no automatic re-resolve or display retry. Older viewers ignore the option.
      result = await viewer.load({ jobId: request.jobId, index: request.index, format: request.format, mimeType: request.mimeType, concept, autoRetry: false });
    } catch (err) {
      result = { ok: false, error: { code: err?.code || "VIEWER_ERROR", serverCode: err?.serverCode, status: err?.status } };
    }
    if (seq !== openSeq || !result || result.superseded) {
      dispatch({ type: "ASSET_OK", key });
      return;
    }
    showViewerNotice();
    if (result.ok) {
      dispatch({ type: "ASSET_OK", key });
      setStatus(result.downloadOnly ? "This file can't be shown in the 3D view. Use Download." : "");
      return;
    }
    const c = classifyError({ name: "AssetViewerError", ...result.error });
    // Only a failure to *show* the file (ASSET_DISPLAY_FAILED and the viewer's other display
    // codes) suggests Download. A server, network, sign-in, permission, configuration or
    // malformed-answer failure would hit Download too, so it gets its own message (QE G2).
    const displayFailure = c.kind === ERROR_KIND.REQUEST && DISPLAY_FAILURE_CODES.has(result.error?.code || "VIEWER_ERROR");
    const text = displayFailure ? DISPLAY_FAILED_MESSAGE : ASSET_MESSAGES[c.kind] || ASSET_MESSAGES[ERROR_KIND.REQUEST];
    dispatch({ type: "ASSET_ERR", key, action: "open", error: c.kind === ERROR_KIND.REQUEST ? { kind: ERROR_KIND.REQUEST, code: result.error?.code || c.code } : c });
    setStatus(text, c.code);
    announce(text);
    afterAssetFailure(request.jobId, c);
  }

  /**
   * The viewer was mounted with renderConceptNotice:false, so the panel must always carry the
   * notice. It starts with the job's (or the fallback) and switches to the server's text from
   * this resolve when the viewer has one (v2.1 keeps it verbatim; noticeSource "server").
   */
  function showViewerNotice() {
    if (!viewerNotice || !viewer || typeof viewer.getState !== "function") return;
    let concept = null;
    try {
      concept = viewer.getState()?.concept || null;
    } catch {
      return;
    }
    const text = concept && concept.noticeSource === "server" && typeof concept.notice === "string" && concept.notice.trim() ? concept.notice : null;
    if (text && viewerNotice.textContent !== text) viewerNotice.textContent = text;
  }

  /**
   * What an Open/Download failure means for the card (QE G1). It matches the polling path:
   * - 403 (FORBIDDEN / UNAUTHORIZED) is about the account/session (AE Q15): page-wide, the list is
   *   replaced by the permission panel like a signed-out list. Refresh is the way back.
   * - 409 RECORD_INTEGRITY_FAILED and 404 MISSING_JOB are about the job record, not this one file.
   *   The card becomes job-errored ("Integrity check failed" / "Not found"): no Open or Download,
   *   never polled. The next list refresh drops the row if the server still refuses it.
   * - 409 ASSET_NOT_READY re-checks the job once.
   * - 410 ASSET_UNAVAILABLE stays per-file. The record is intact and the server status is still
   *   succeeded (contract §2.5: "Scenario no longer has it"), so the card keeps its status and
   *   just shows the message on that file. Nothing is retried automatically.
   */
  function afterAssetFailure(jobId, c) {
    if (destroyed) return;
    if (c.kind === ERROR_KIND.FORBIDDEN) {
      goPageWide({ kind: c.kind, code: c.code, status: c.status ?? null });
    } else if (JOB_LEVEL_KINDS.has(c.kind)) {
      dispatch({ type: "JOB_ERR", jobId, error: { kind: c.kind, code: c.code, status: c.status ?? null } });
    } else if (c.kind === ERROR_KIND.ASSET_NOT_READY) {
      refreshOneJob(jobId);
    }
  }

  async function download(jobId, index) {
    const hit = findOutput(jobId, index);
    if (!hit || !source || state.assets[assetKey(jobId, index)]?.phase === "resolving") return;
    const d = await runAsset(jobId, index, "download");
    const format = d.format || hit.output.format || null;
    // Prefer the source's own name (furniai-concept-<job>-<i>.<fmt|bin>); the provider's is not trusted.
    const filename = typeof d.filename === "string" && d.filename ? d.filename : `furniai-concept-${jobId}-${index}.${format || "bin"}`;
    startDownload({ url: d.url, filename, jobId, index, format });
  }

  function defaultStartDownload({ url, filename }) {
    const a = doc.createElement("a");
    a.setAttribute("href", url);
    a.setAttribute("download", filename);
    a.setAttribute("rel", "noopener");
    a.setAttribute("target", "_blank");
    doc.body.appendChild(a);
    a.click();
    a.parentNode.removeChild(a); // the address is used once and not kept
  }

  function destroy() {
    if (destroyed) return;
    pollGen++;
    if (timer !== null) clearT(timer);
    timer = null;
    closeViewer();
    destroyed = true;
    for (const c of controllers) c.abort();
    controllers.clear();
    if (typeof doc.removeEventListener === "function") doc.removeEventListener("visibilitychange", onVisibility);
    if (section.parentNode) section.parentNode.removeChild(section);
  }

  render();
  refresh();

  return {
    refresh,
    destroy,
    getState: () => snapshot({ ...state, nextPollDelayMs: state.polling ? nextDelay : null, destroyed }),
  };
}

function injectStyles(doc) {
  if (!doc || !doc.head || typeof doc.getElementById !== "function") return;
  if (doc.getElementById(CONCEPT_GALLERY_STYLE_ID)) return;
  const style = doc.createElement("style");
  style.setAttribute("id", CONCEPT_GALLERY_STYLE_ID);
  style.textContent = CONCEPT_GALLERY_CSS;
  doc.head.appendChild(style);
}
