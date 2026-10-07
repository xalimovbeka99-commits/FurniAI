/**
 * Thin browser client for the creative-jobs LIST (and config), the one part of
 * /api/creative that Asset Engineer's createCreativeAssetSource does not cover.
 *
 * Why it exists and what it is not:
 * - It is NOT a fork of Antigravity's DesignsApiClient (src/lib/persistence/designsApiClient.js).
 *   That client is bound to /api/designs and its error codes, and its request/authHeaders helpers
 *   are not exported, so there is nothing to extend without editing AG's file. This one follows
 *   the same conventions (Bearer <Supabase access token>, `{ ok:false, code, error, details? }`
 *   errors, fail closed, nothing cached) for /api/creative only. Owner until agreed: Projects.
 *   Request to AG (via CraZy): export a generic authed-JSON request so both can share it.
 * - It makes exactly ONE fetch per call. It never retries, never caches, never stores a token
 *   or a URL, and never writes browser storage.
 * - Only existing endpoints (api/creative.js at f472aef, contract rev 2):
 *     GET ?resource=jobs              list, newest first, at most 50 (store only, no refresh)
 *     GET ?resource=jobs&jobId=<id>   one job (refreshes from the provider; used for polling)
 *     GET ?resource=config            feature availability (no secrets)
 *
 * Rejections are plain objects the gallery's classifyError() understands:
 *   HTTP error   -> { status, code, message, details }   (code from the body, else null)
 *   network      -> { status: null, code: "NETWORK" }
 *   bad 2xx body -> { status, code: "INVALID_RESPONSE" }
 */
export const CREATIVE_API_BASE = "/api/creative";

function url(baseUrl, query) {
  return `${(baseUrl || CREATIVE_API_BASE).replace(/\/$/, "")}?${query}`;
}

/**
 * @param {{ fetchImpl?: typeof fetch, baseUrl?: string }} [opts]
 */
export function createCreativeJobsClient(opts = {}) {
  const fetchImpl = opts.fetchImpl || (typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : null);
  const baseUrl = opts.baseUrl || CREATIVE_API_BASE;

  async function get(query, { accessToken, signal } = {}) {
    if (typeof accessToken !== "string" || !accessToken.trim()) {
      throw { status: 401, code: "MISSING_AUTH", message: "Sign in required." };
    }
    if (typeof fetchImpl !== "function") throw { status: null, code: "NETWORK", message: "fetch is not available." };
    let res;
    try {
      res = await fetchImpl(url(baseUrl, query), {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken.trim()}`, Accept: "application/json" },
        signal,
        cache: "no-store",
      });
    } catch (err) {
      if (err && (err.name === "AbortError" || err.code === "ABORT_ERR")) throw err;
      throw { status: null, code: "NETWORK", message: "Could not reach FurniAI." };
    }
    let body = null;
    try {
      const text = await res.text();
      body = text && text.trim() ? JSON.parse(text) : null;
    } catch (err) {
      if (err && err.name === "AbortError") throw err;
      body = null;
    }
    if (!res.ok) {
      throw {
        status: res.status,
        code: body && typeof body.code === "string" && body.code ? body.code : null,
        message: body && typeof body.error === "string" ? body.error : undefined,
        details: body && body.details && typeof body.details === "object" ? body.details : undefined,
      };
    }
    if (!body || body.ok !== true) throw { status: res.status, code: "INVALID_RESPONSE" };
    return body;
  }

  return {
    /** GET ?resource=jobs -> { ok, jobs } (newest first, at most 50). */
    async listJobs({ accessToken, signal } = {}) {
      const body = await get("resource=jobs", { accessToken, signal });
      if (!Array.isArray(body.jobs)) throw { status: 200, code: "INVALID_RESPONSE" };
      return body;
    },
    /** GET ?resource=jobs&jobId=<id> -> { ok, job, refresh }. */
    async getJob({ jobId, accessToken, signal } = {}) {
      if (typeof jobId !== "string" || !jobId) throw { status: null, code: "BAD_REQUEST", message: "jobId is required." };
      return get(`resource=jobs&jobId=${encodeURIComponent(jobId)}`, { accessToken, signal });
    },
    /** GET ?resource=config -> { ok, configured, liveGenerationEnabled, maxCostPerJob, missing, … }. */
    async getConfig({ accessToken, signal } = {}) {
      return get("resource=config", { accessToken, signal });
    },
  };
}

/**
 * Antigravity's shared token helper, used as is: index.html's getStudioAccessToken() is the
 * same function AG's My Projects (loadProjects) hands to DesignsApiClient.listDesigns. Asked on
 * every call (tokens refresh); nothing is cached. Without the helper on the page this answers
 * null, which the gallery shows as signed out.
 * Request to AG (via CraZy): expose it under a stable name, e.g. window.FurniAuth.getAccessToken.
 */
export async function studioAccessToken(scope = globalThis) {
  const helper = scope && typeof scope.getStudioAccessToken === "function" ? scope.getStudioAccessToken : null;
  if (!helper) return null;
  const t = await helper();
  return typeof t === "string" && t.trim() ? t : null;
}
