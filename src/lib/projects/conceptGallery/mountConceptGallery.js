/**
 * Concept gallery: the caller's AI visual concepts from
 * GET /api/creative?resource=jobs (contract: SCENARIO_3D_API_CONTRACT.md,
 * PROPOSED). Framework-free; renders into `root` without innerHTML.
 *
 * @typedef {object} CreativeJobsClient
 *   Thin injected client for /api/creative. Every method receives the bearer
 *   token the gallery got from getAccessToken() (same rules as /api/designs)
 *   and an AbortSignal, and resolves with the parsed `ok:true` body. On a
 *   non-2xx answer it rejects with `{ status, code, message?, details? }`
 *   (`code` taken from the `{ ok:false, code, error, details? }` body); on a
 *   network failure it rejects with no `status`. No browser client ships with
 *   the backend at 7f42f956, so this interface is the gallery's requirement,
 *   not a copy of an existing one.
 * @property {(args: { accessToken: string, signal?: AbortSignal }) => Promise<{ jobs: object[] }>} listJobs
 *   GET ?resource=jobs. Newest first, at most 50. Reads the store only.
 * @property {(args: { jobId: string, accessToken: string, signal?: AbortSignal }) => Promise<{ job: object, refresh?: { ok: boolean, code?: string } }>} getJob
 *   GET ?resource=jobs&jobId=. The only call that refreshes from the provider,
 *   so it is what the gallery polls for each non-terminal job.
 * @property {(args: { jobId: string, index: number, accessToken: string, signal?: AbortSignal }) => Promise<{ asset: { url: string } }>} getAssetUrl
 *   GET ?resource=asset&jobId=&index=. Called on EVERY open and download.
 *
 * @typedef {object} OpenConceptRequest
 * @property {string} jobId
 * @property {number} index
 * @property {string|null} format      "glb" | "gltf" (only these are offered for opening)
 * @property {string|null} mimeType
 * @property {string} notice          concept.notice, to show next to the viewer
 * @property {() => Promise<string>} resolveUrl
 *   Asks the API for a CURRENT address each time it is called (one automatic
 *   retry on a transient failure). Never a URL: the viewer must call it for
 *   every load and call it again once if the load of that URL fails.
 *   Rejects with a ConceptAssetError carrying `code`.
 *
 * @param {Element} root
 * @param {{
 *   client: CreativeJobsClient,
 *   getAccessToken: () => (string|null|Promise<string|null>),
 *   onOpenConcept?: (req: OpenConceptRequest) => void,
 *   assetResolver?: (args: { jobId: string, index: number, accessToken: string, signal?: AbortSignal }) => Promise<{ asset: { url: string } } | { url: string }>,
 *   pollIntervalMs?: number,
 *   formatDate?: (iso: string) => string,
 *   startDownload?: (args: { url: string, filename: string, jobId: string, index: number, format: string|null }) => void,
 *   title?: string,
 * }} options
 * @returns {{ refresh: () => Promise<void>, destroy: () => void, getState: () => object }}
 */
import { CODE, FALLBACK_CONCEPT_NOTICE, MAX_BACKOFF_MS, MAX_POLL_MS, MIN_POLL_MS, isViewableFormat } from "./contract.js";
import { ASSET_MESSAGES, ConceptAssetError, ERROR_KIND, classifyError, isAbortError, isRetryableAssetError } from "./errors.js";
import { defaultFormatDate, el, pollingText, renderBody } from "./render.js";
import { LIST_STATUS, assetKey, hasPollableJobs, initialState, reduce, snapshot } from "./state.js";
import { CONCEPT_GALLERY_CSS, CONCEPT_GALLERY_STYLE_ID } from "./styles.js";

let mountCount = 0;

export function clampPollInterval(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return 4000;
  return Math.min(MAX_POLL_MS, Math.max(MIN_POLL_MS, n));
}

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
  for (const m of ["listJobs", "getJob", "getAssetUrl"]) {
    if (!client || typeof client[m] !== "function") throw new TypeError(`mountConceptGallery: client.${m} is required`);
  }
  if (typeof getAccessToken !== "function") throw new TypeError("mountConceptGallery: getAccessToken is required");

  const doc = root.ownerDocument || globalThis.document;
  const interval = clampPollInterval(options.pollIntervalMs ?? 4000);
  const formatDate = typeof options.formatDate === "function" ? options.formatDate : defaultFormatDate;
  const onOpenConcept = typeof options.onOpenConcept === "function" ? options.onOpenConcept : null;
  const resolver =
    typeof options.assetResolver === "function" ? options.assetResolver : (args) => client.getAssetUrl(args);
  const startDownload = typeof options.startDownload === "function" ? options.startDownload : defaultStartDownload;
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
  const section = el(
    doc,
    "section",
    { class: "fcg", "aria-labelledby": titleId, "data-concept-gallery": "" },
    el(doc, "div", { class: "fcg-head" }, el(doc, "h2", { class: "fcg-title", id: titleId, text: options.title || "3D concepts" }), refreshBtn),
    live,
    announcer,
    body,
  );
  root.appendChild(section);

  const ctx = {
    idPrefix,
    formatDate,
    canOpen: Boolean(onOpenConcept),
    onRefresh: () => {
      refresh();
    },
    onOpen: (jobId, index) => openConcept(jobId, index),
    onDownload: (jobId, index) => {
      download(jobId, index).catch(() => {});
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

  function goSignedOut(err) {
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
      dispatch({ type: "LIST_OK", jobs: res && res.jobs });
      schedulePoll(interval, true);
    } catch (err) {
      if (destroyed || seq !== listSeq || isAbortError(err)) return;
      const c = classifyError(err);
      if (c.kind === ERROR_KIND.SIGNED_OUT) goSignedOut(c);
      else dispatch({ type: "LIST_ERR", error: c });
    } finally {
      t.done();
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
    if (isHidden() || state.list !== LIST_STATUS.READY || !hasPollableJobs(state)) {
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
    let accessToken;
    try {
      accessToken = await token();
    } catch (err) {
      if (!destroyed && gen === pollGen) goSignedOut(classifyError(err));
      return;
    }
    const t = track();
    const results = await Promise.all(
      ids.map((jobId) =>
        client.getJob({ jobId, accessToken, signal: t.signal }).then(
          (res) => ({ jobId, res }),
          (err) => ({ jobId, err }),
        ),
      ),
    );
    t.done();
    if (destroyed || gen !== pollGen || seq !== listSeq) return; // stale round
    let failed = false;
    for (const r of results) {
      if (r.res) {
        if (r.res.job) dispatch({ type: "JOB_OK", job: r.res.job, refresh: r.res.refresh });
        else failed = true;
        continue;
      }
      if (isAbortError(r.err)) return;
      const c = classifyError(r.err);
      if (c.kind === ERROR_KIND.SIGNED_OUT) return goSignedOut(c);
      if (c.kind === ERROR_KIND.INTEGRITY || c.kind === ERROR_KIND.NOT_FOUND) dispatch({ type: "JOB_ERR", jobId: r.jobId, error: c });
      else failed = true;
    }
    const failures = failed ? state.pollFailures + 1 : 0;
    const delay = failed ? Math.min(MAX_BACKOFF_MS, interval * 2 ** failures) : interval;
    nextDelay = delay;
    dispatch({ type: "POLLING", polling: true, failures });
    schedulePoll(delay);
  }

  function onVisibility() {
    if (destroyed) return;
    if (isHidden()) stopPolling();
    else if (state.list === LIST_STATUS.READY && hasPollableJobs(state)) schedulePoll(0, true);
  }
  if (typeof doc.addEventListener === "function") doc.addEventListener("visibilitychange", onVisibility);

  /** One getJob for a job the server says isn't ready (e.g. after ASSET_NOT_READY). */
  async function refreshOneJob(jobId) {
    const seq = listSeq;
    const t = track();
    try {
      const res = await client.getJob({ jobId, accessToken: await token(), signal: t.signal });
      if (!destroyed && seq === listSeq && res?.job) {
        dispatch({ type: "JOB_OK", job: res.job, refresh: res.refresh });
        if (!state.polling) schedulePoll(interval, true);
      }
    } catch (err) {
      if (destroyed || isAbortError(err)) return;
      const c = classifyError(err);
      if (c.kind === ERROR_KIND.INTEGRITY || c.kind === ERROR_KIND.NOT_FOUND) dispatch({ type: "JOB_ERR", jobId, error: c });
    } finally {
      t.done();
    }
  }

  // ---- assets: a fresh address on every open / download ---------------------
  async function resolveAssetOnce(jobId, index) {
    const accessToken = await token();
    const t = track();
    try {
      const res = await resolver({ jobId, index, accessToken, signal: t.signal });
      const asset = res && typeof res === "object" && res.asset ? res.asset : res;
      if (!asset || typeof asset.url !== "string" || !asset.url) throw { status: null, code: CODE.INVALID_RESPONSE };
      return asset;
    } finally {
      t.done();
    }
  }

  async function resolveAsset(jobId, index) {
    try {
      return await resolveAssetOnce(jobId, index);
    } catch (first) {
      const c = classifyError(first);
      if (!isRetryableAssetError(c)) throw new ConceptAssetError(c, first);
      try {
        return await resolveAssetOnce(jobId, index); // contract §2.5: call it again once
      } catch (second) {
        throw new ConceptAssetError(classifyError(second), second);
      }
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
      const e = err instanceof ConceptAssetError ? err : new ConceptAssetError(classifyError(err), err);
      dispatch({ type: "ASSET_ERR", key, action, error: { kind: e.kind, code: e.code } });
      announce(ASSET_MESSAGES[e.kind] || ASSET_MESSAGES[ERROR_KIND.REQUEST]);
      if (e.kind === ERROR_KIND.ASSET_NOT_READY && !destroyed) refreshOneJob(jobId);
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
    if (!hit || !onOpenConcept || !isViewableFormat(hit.output.format)) return;
    if (state.assets[assetKey(jobId, index)]?.phase === "resolving") return;
    const request = Object.freeze({
      jobId,
      index,
      format: hit.output.format,
      mimeType: hit.output.mimeType,
      notice: hit.job.notice || FALLBACK_CONCEPT_NOTICE,
      resolveUrl: () => runAsset(jobId, index, "open").then((asset) => asset.url),
    });
    try {
      onOpenConcept(request);
    } catch {
      /* the host's error is its own; the gallery keeps working */
    }
  }

  async function download(jobId, index) {
    const hit = findOutput(jobId, index);
    if (!hit || state.assets[assetKey(jobId, index)]?.phase === "resolving") return;
    const asset = await runAsset(jobId, index, "download");
    const format = asset.format || hit.output.format || null;
    startDownload({ url: asset.url, filename: `concept-${jobId}-${index}${format ? `.${format}` : ""}`, jobId, index, format });
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
