/**
 * Pure state for the concept gallery. No DOM, no timers, no network.
 *
 * getState() returns a frozen snapshot of this shape:
 *   {
 *     list:    "loading" | "ready" | "error",
 *     error:   null | { kind, code, status },          // list-level failure
 *     jobs:    JobView[],                              // server order (newest first)
 *     jobErrors: { [jobId]: { kind, code } },          // per-job failure seen while polling
 *     checkDelayed: { [jobId]: code },                 // last refresh:{ok:false}; still polling
 *     assets:  { ["jobId:index"]: { phase: "resolving"|"error", action, kind?, code? } },
 *     polling: boolean,                                // a poll is scheduled or in flight
 *     pollFailures: number,                            // consecutive failed poll rounds (backoff)
 *   }
 * URLs are NEVER part of this state (contract §2.5).
 */
import { CODE, isBillingOutcome, isNonTerminal } from "./contract.js";
import { ERROR_KIND } from "./errors.js";

export const LIST_STATUS = Object.freeze({ LOADING: "loading", READY: "ready", ERROR: "error" });

export function initialState() {
  return {
    list: LIST_STATUS.LOADING,
    error: null,
    jobs: [],
    jobErrors: {},
    checkDelayed: {},
    assets: {},
    polling: false,
    pollFailures: 0,
  };
}

export const assetKey = (jobId, index) => `${jobId}:${index}`;

const str = (v) => (typeof v === "string" ? v : null);
/** The server's notice verbatim (never trimmed or shortened); a blank one counts as missing (v2.1 rule). */
const notice = (v) => (typeof v === "string" && v.trim() ? v : null);

/** Copy only the contract fields; anything else the server adds is ignored. */
export function normalizeJob(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.jobId !== "string" || !raw.jobId) return null;
  const outputs = Array.isArray(raw.outputs)
    ? raw.outputs
        .map((o, i) => ({
          index: Number.isInteger(o?.index) ? o.index : i,
          format: str(o?.format),
          mimeType: str(o?.mimeType),
        }))
    : [];
  const error =
    raw.error && typeof raw.error === "object" ? { code: str(raw.error.code), message: str(raw.error.message) } : null;
  return {
    jobId: raw.jobId,
    status: str(raw.status) || "",
    provider: str(raw.provider),
    model: str(raw.model),
    sourceReferenceId: str(raw.sourceReferenceId),
    // Kept for diagnostics via getState() only. Never rendered, never branched on.
    providerStatus: raw.providerStatus ?? null,
    providerProgress: raw.providerProgress ?? null,
    outputs,
    error,
    createdAt: str(raw.createdAt),
    submittedAt: str(raw.submittedAt),
    completedAt: str(raw.completedAt),
    updatedAt: str(raw.updatedAt),
    // Rev 2 §2.4. `estimatedCost` is a pre-submission preview, not a bill: never copied.
    billing: billingCopy(raw.usage),
    // Rev 2: whether FurniAI keeps its own copy of the file (always false today).
    durableCopy: typeof raw.storage?.durableCopy === "boolean" ? raw.storage.durableCopy : null,
    notice: notice(raw.concept?.notice),
    concept: raw.concept && typeof raw.concept === "object" ? conceptCopy(raw.concept) : null,
  };
}

/**
 * `outcome` is null when the server sent none (rev 1) or an unknown value, which
 * renders as "not reported", never as a guess. A reported cost without the
 * `reported` outcome is not shown.
 */
function billingCopy(u) {
  const outcome = u && typeof u === "object" && isBillingOutcome(u.billingOutcome) ? u.billingOutcome : null;
  const cost = outcome === "reported" && typeof u.reportedCost === "number" && Number.isFinite(u.reportedCost) ? u.reportedCost : null;
  return { outcome, reportedCost: cost, unit: outcome === "reported" ? str(u.unit) : null };
}

const CONCEPT_FIELDS = ["kind", "editable", "dimensionsVerified", "partsSeparable", "manufacturable", "notice"];
function conceptCopy(c) {
  return Object.fromEntries(CONCEPT_FIELDS.filter((k) => k in c).map((k) => [k, c[k]]));
}

function time(iso) {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : null;
}

/** An incoming job view replaces the current one unless it is provably older. */
export function isNewerOrSame(incoming, current) {
  const a = time(incoming.updatedAt);
  const b = time(current.updatedAt);
  if (a === null || b === null) return true;
  return a >= b;
}

export function hasPollableJobs(state) {
  return state.jobs.some((j) => isNonTerminal(j.status) && !state.jobErrors[j.jobId]);
}

const without = (obj, key) => {
  if (!(key in obj)) return obj;
  const next = { ...obj };
  delete next[key];
  return next;
};

export function reduce(state, action) {
  switch (action.type) {
    case "LIST_START":
      return { ...state, list: LIST_STATUS.LOADING, error: null };
    case "LIST_OK": {
      if (!Array.isArray(action.jobs)) {
        return { ...state, list: LIST_STATUS.ERROR, error: { kind: ERROR_KIND.REQUEST, code: CODE.INVALID_RESPONSE, status: null } };
      }
      const seen = new Set();
      const jobs = [];
      for (const raw of action.jobs) {
        const j = normalizeJob(raw);
        if (j && !seen.has(j.jobId)) {
          seen.add(j.jobId);
          jobs.push(j);
        }
      }
      const ids = new Set(jobs.map((j) => j.jobId));
      const keepIds = (obj) => Object.fromEntries(Object.entries(obj).filter(([id]) => ids.has(id)));
      return {
        ...state,
        list: LIST_STATUS.READY,
        error: null,
        jobs,
        // A 403 lock is about access at that moment; a list the account may read lifts it.
        jobErrors: Object.fromEntries(Object.entries(keepIds(state.jobErrors)).filter(([, e]) => e.kind !== ERROR_KIND.FORBIDDEN)),
        checkDelayed: keepIds(state.checkDelayed),
        assets: Object.fromEntries(Object.entries(state.assets).filter(([k]) => ids.has(k.slice(0, k.lastIndexOf(":"))))),
      };
    }
    case "LIST_ERR":
      return { ...state, list: LIST_STATUS.ERROR, error: action.error, polling: false };
    case "JOB_OK": {
      const incoming = normalizeJob(action.job);
      if (!incoming) return state;
      const i = state.jobs.findIndex((j) => j.jobId === incoming.jobId);
      if (i < 0 || !isNewerOrSame(incoming, state.jobs[i])) return state;
      const jobs = state.jobs.slice();
      jobs[i] = incoming;
      const delayed =
        action.refresh && action.refresh.ok === false
          ? { ...state.checkDelayed, [incoming.jobId]: str(action.refresh.code) || CODE.INTERNAL }
          : without(state.checkDelayed, incoming.jobId);
      return { ...state, jobs, checkDelayed: delayed, jobErrors: without(state.jobErrors, incoming.jobId) };
    }
    case "JOB_ERR":
      return { ...state, jobErrors: { ...state.jobErrors, [action.jobId]: { kind: action.error.kind, code: action.error.code } } };
    case "POLLING":
      return { ...state, polling: action.polling, pollFailures: action.failures ?? state.pollFailures };
    case "ASSET_START":
      return { ...state, assets: { ...state.assets, [action.key]: { phase: "resolving", action: action.action } } };
    case "ASSET_OK":
      return { ...state, assets: without(state.assets, action.key) };
    case "ASSET_ERR":
      return {
        ...state,
        assets: { ...state.assets, [action.key]: { phase: "error", action: action.action, kind: action.error.kind, code: action.error.code } },
      };
    case "SIGNED_OUT":
      return { ...initialState(), list: LIST_STATUS.ERROR, error: action.error };
    default:
      return state;
  }
}

/** Deep-frozen copy for getState(). */
export function snapshot(state) {
  return deepFreeze(JSON.parse(JSON.stringify(state)));
}

function deepFreeze(o) {
  if (o && typeof o === "object") {
    for (const v of Object.values(o)) deepFreeze(v);
    Object.freeze(o);
  }
  return o;
}
