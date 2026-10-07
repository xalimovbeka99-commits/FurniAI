/**
 * Browser client for /api/designs* (durable wardrobe design persistence).
 * Fail-closed: maps server error codes to readable Errors; never invents a store.
 *
 * Built as IIFE global DesignsApiClient via scripts/build-static.mjs.
 */

/** @typedef {{ ok: false, code?: string, error?: string, details?: object }} ErrorBody */

export const DESIGNS_API_BASE = "/api/designs";

export const DESIGNS_API_ERROR = Object.freeze({
  MISSING_AUTH: "MISSING_AUTH",
  MISSING_DESIGN: "MISSING_DESIGN",
  STALE_REVISION: "STALE_REVISION",
  CONFLICT_REVISION: "CONFLICT_REVISION",
  CONFLICT_DESIGN: "CONFLICT_DESIGN",
  FINGERPRINT_MISMATCH: "FINGERPRINT_MISMATCH",
  INVALID_FURNISPEC: "INVALID_FURNISPEC",
  INVALID_PARTGRAPH: "INVALID_PARTGRAPH",
  UNSUPPORTED_COMPONENT: "UNSUPPORTED_COMPONENT",
  BAD_REQUEST: "BAD_REQUEST",
  STORAGE_UNAVAILABLE: "STORAGE_UNAVAILABLE",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  NETWORK: "NETWORK",
  UNKNOWN: "UNKNOWN",
});

const READABLE = Object.freeze({
  MISSING_AUTH: "Sign in required to save or reopen designs.",
  MISSING_DESIGN: "That design is not available.",
  STALE_REVISION: "Someone else saved first — reload before saving again.",
  CONFLICT_REVISION: "Could not save this revision (conflict). Reload and try again.",
  CONFLICT_DESIGN: "A design with that id already exists.",
  FINGERPRINT_MISMATCH: "Design fingerprint did not match — nothing was saved.",
  INVALID_FURNISPEC: "The design specification was rejected.",
  INVALID_PARTGRAPH: "The part graph was rejected.",
  UNSUPPORTED_COMPONENT: "The design includes an unsupported component.",
  BAD_REQUEST: "The save request was incomplete or invalid.",
  STORAGE_UNAVAILABLE: "Design saving is temporarily unavailable.",
  METHOD_NOT_ALLOWED: "That persistence action is not allowed.",
  NETWORK: "Could not reach the design service.",
  UNKNOWN: "Could not complete the design persistence request.",
});

export class DesignsApiError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {{ status?: number, details?: object, body?: object }} [opts]
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "DesignsApiError";
    this.code = code || DESIGNS_API_ERROR.UNKNOWN;
    this.status = opts.status;
    this.details = opts.details;
    this.body = opts.body;
  }
}

/**
 * Map a fail-closed API error body (+ HTTP status) to DesignsApiError.
 * @param {number} status
 * @param {ErrorBody|null|undefined} body
 */
export function mapDesignsApiError(status, body) {
  const code =
    (body && typeof body.code === "string" && body.code) ||
    (status === 401
      ? DESIGNS_API_ERROR.MISSING_AUTH
      : status === 404
        ? DESIGNS_API_ERROR.MISSING_DESIGN
        : status === 409
          ? DESIGNS_API_ERROR.STALE_REVISION
          : status === 405
            ? DESIGNS_API_ERROR.METHOD_NOT_ALLOWED
            : status === 502 || status === 503
              ? DESIGNS_API_ERROR.STORAGE_UNAVAILABLE
              : DESIGNS_API_ERROR.UNKNOWN);
  const fallback = READABLE[code] || READABLE.UNKNOWN;
  const message =
    (body && typeof body.error === "string" && body.error.trim()) || fallback;
  return new DesignsApiError(code, message, {
    status,
    details: body && body.details,
    body: body || undefined,
  });
}

function authHeaders(token) {
  if (!token || typeof token !== "string" || !token.trim()) {
    throw new DesignsApiError(
      DESIGNS_API_ERROR.MISSING_AUTH,
      READABLE.MISSING_AUTH,
      { status: 401 }
    );
  }
  return {
    Authorization: "Bearer " + token.trim(),
    Accept: "application/json",
  };
}

function joinUrl(baseUrl, path) {
  const base = (baseUrl || "").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : "/" + path;
  return base + p;
}

/**
 * @param {object} opts
 * @param {string} [opts.baseUrl]
 * @param {typeof fetch} [opts.fetchImpl]
 */
export function createDesignsApiClient(opts = {}) {
  const baseUrl = opts.baseUrl || "";
  const fetchImpl = opts.fetchImpl || globalThis.fetch;

  async function request(method, path, { token, body } = {}) {
    if (typeof fetchImpl !== "function") {
      throw new DesignsApiError(
        DESIGNS_API_ERROR.NETWORK,
        "Fetch is not available in this environment."
      );
    }
    const headers = {
      ...authHeaders(token),
    };
    const init = { method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetchImpl(joinUrl(baseUrl, path), init);
    } catch (err) {
      throw new DesignsApiError(DESIGNS_API_ERROR.NETWORK, READABLE.NETWORK, {
        details: { causeName: err && err.name },
      });
    }
    let parsed = null;
    const text = await res.text();
    if (text && text.trim()) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }
    if (!res.ok) {
      throw mapDesignsApiError(res.status, parsed);
    }
    return parsed;
  }

  return {
    /**
     * POST /api/designs
     * @param {{ name: string, token: string, designId?: string }} args
     */
    async createDesign({ name, token, designId } = {}) {
      const body = { name };
      if (designId) body.designId = designId;
      return request("POST", DESIGNS_API_BASE, { token, body });
    },

    /**
     * POST /api/designs/:designId/revisions
     */
    async saveAcceptedRevision({
      designId,
      revision,
      furniSpec,
      partGraph,
      origins,
      fingerprint,
      expectedPreviousRevision,
      token,
      validationStatus = "ACCEPTED",
    } = {}) {
      if (!designId) {
        throw new DesignsApiError(
          DESIGNS_API_ERROR.BAD_REQUEST,
          "designId is required."
        );
      }
      return request(
        "POST",
        DESIGNS_API_BASE +
          "/" +
          encodeURIComponent(designId) +
          "/revisions",
        {
          token,
          body: {
            revision,
            expectedPreviousRevision:
              expectedPreviousRevision === undefined
                ? null
                : expectedPreviousRevision,
            fingerprint,
            furniSpec,
            partGraph,
            origins: origins || {},
            validationStatus,
          },
        }
      );
    },

    /**
     * GET /api/designs/:designId/revisions/:revision
     */
    async getRevision({ designId, revision, token } = {}) {
      if (!designId) {
        throw new DesignsApiError(
          DESIGNS_API_ERROR.BAD_REQUEST,
          "designId is required."
        );
      }
      return request(
        "GET",
        DESIGNS_API_BASE +
          "/" +
          encodeURIComponent(designId) +
          "/revisions/" +
          encodeURIComponent(String(revision)),
        { token }
      );
    },

    /**
     * GET /api/designs
     */
    async listDesigns({ token } = {}) {
      return request("GET", DESIGNS_API_BASE, { token });
    },

    /**
     * GET /api/designs/:designId
     */
    async getDesign({ designId, token } = {}) {
      if (!designId) {
        throw new DesignsApiError(
          DESIGNS_API_ERROR.BAD_REQUEST,
          "designId is required."
        );
      }
      return request(
        "GET",
        DESIGNS_API_BASE + "/" + encodeURIComponent(designId),
        { token }
      );
    },
  };
}

/** Default singleton for browser IIFE consumers. */
export const DesignsApiClient = createDesignsApiClient();

export default DesignsApiClient;
