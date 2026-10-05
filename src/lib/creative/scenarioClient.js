/**
 * Server-side Scenario REST client. One request per call — NO retries: a
 * retried generation request can be a second paid generation.
 *
 * Endpoints and auth as documented at docs.scenario.com (2026-10-04):
 *   Basic auth (key:secret) · POST /assets · GET /assets/{id}
 *   GET /models/{id} · POST /generate/custom/{modelId}[?dryRun=true] · GET /jobs/{id}
 *
 * Response FIELD PATHS marked (unverified) below come from documentation
 * examples, not from an authenticated call. Every one of them fails closed:
 * an unrecognised shape raises PROVIDER_UNEXPECTED_RESPONSE or COST_UNVERIFIED
 * and never becomes a guessed value.
 */
import { CreativeError, CREATIVE_ERROR } from "./errors.js";

const TIMEOUT_MS = 30_000;
const INSUFFICIENT_RE = /(insufficient|not enough|exceed|out of).{0,40}(credit|unit|fund|balance|quota)/i;

export function createScenarioClient(cfg, { fetchImpl = globalThis.fetch } = {}) {
  const auth = "Basic " + Buffer.from(`${cfg.apiKey}:${cfg.apiSecret}`).toString("base64");

  /** @param {{ billable?: boolean }} o — billable: a lost answer leaves the outcome unknown. */
  async function call(method, path, { body, billable = false } = {}) {
    if (!cfg.credentialsConfigured) {
      throw new CreativeError(CREATIVE_ERROR.CREATIVE_NOT_CONFIGURED, "3D concept generation is not configured on this deployment.");
    }
    let res;
    try {
      res = await fetchImpl(`${cfg.baseUrl}${path}`, {
        method,
        headers: { authorization: auth, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new CreativeError(CREATIVE_ERROR.PROVIDER_UNAVAILABLE, "The 3D generation service could not be reached.", { outcomeUnknown: billable });
    }
    let payload = null;
    let text = "";
    try {
      text = await res.text();
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (res.ok) {
      if (!payload || typeof payload !== "object") {
        throw new CreativeError(CREATIVE_ERROR.PROVIDER_UNEXPECTED_RESPONSE, "The 3D generation service answered in an unexpected format.", { outcomeUnknown: billable });
      }
      return payload;
    }
    const providerMessage = safeMessage(payload, text);
    const details = { providerHttpStatus: res.status, ...(providerMessage ? { providerMessage } : {}) };
    if (res.status === 401 || res.status === 403) {
      throw new CreativeError(CREATIVE_ERROR.PROVIDER_AUTH_REJECTED, "The 3D generation service rejected this deployment's credentials.", { details });
    }
    // 402 is the conventional code; the message test covers a provider that
    // reports exhausted credits under another 4xx. (unverified for Scenario)
    if (res.status === 402 || (res.status < 500 && INSUFFICIENT_RE.test(providerMessage || ""))) {
      throw new CreativeError(CREATIVE_ERROR.PROVIDER_INSUFFICIENT_CREDITS, "The 3D generation service reported insufficient credits.", { details });
    }
    if (res.status === 429) {
      throw new CreativeError(CREATIVE_ERROR.PROVIDER_RATE_LIMITED, "The 3D generation service is rate-limiting requests.", { details });
    }
    if (res.status >= 500) {
      throw new CreativeError(CREATIVE_ERROR.PROVIDER_UNAVAILABLE, "The 3D generation service is unavailable right now.", { details, outcomeUnknown: billable });
    }
    if (res.status === 404) {
      throw new CreativeError(CREATIVE_ERROR.PROVIDER_REJECTED_REQUEST, "The 3D generation service did not find the requested resource.", { details: { ...details, notFound: true } });
    }
    throw new CreativeError(CREATIVE_ERROR.PROVIDER_REJECTED_REQUEST, "The 3D generation service refused the request.", { details });
  }

  return {
    /** Raw model record, for discovery. Zero cost. */
    async getModel(modelId) {
      return call("GET", `/models/${encodeURIComponent(modelId)}`);
    },

    /** @returns {Promise<{ assetId: string }>} */
    async uploadAsset({ name, contentType, buffer }) {
      const b64 = buffer.toString("base64");
      const payload = await call("POST", "/assets", {
        body: { name, image: cfg.uploadAsDataUrl ? `data:${contentType};base64,${b64}` : b64 },
      });
      const assetId = payload.asset?.id ?? payload.id; // (unverified)
      if (typeof assetId !== "string" || !assetId) {
        throw new CreativeError(CREATIVE_ERROR.PROVIDER_UNEXPECTED_RESPONSE, "The 3D generation service did not return an asset id for the reference.", { details: { keys: Object.keys(payload) } });
      }
      return { assetId };
    },

    /** Cost preview. Makes no generation. @returns {Promise<{ cost: number, raw: object }>} */
    async estimateCost(params) {
      const payload = await call("POST", `/generate/custom/${encodeURIComponent(cfg.modelId)}?dryRun=true`, { body: params });
      const cost = [payload.billing?.cost, payload.creativeUnitsCost, payload.cuCost].find((v) => typeof v === "number" && Number.isFinite(v) && v >= 0); // (unverified)
      if (cost === undefined) {
        throw new CreativeError(CREATIVE_ERROR.COST_UNVERIFIED, "The cost of this generation could not be confirmed, so nothing was submitted.", { details: { keys: Object.keys(payload) } });
      }
      return { cost, raw: payload };
    },

    /** THE PAID CALL. @returns {Promise<{ providerJobId: string, providerStatus: string|null }>} */
    async submitGeneration(params) {
      const payload = await call("POST", `/generate/custom/${encodeURIComponent(cfg.modelId)}`, { body: params, billable: true });
      const job = payload.job ?? payload;
      const providerJobId = job.jobId ?? job.id ?? job.job_id; // (unverified)
      if (typeof providerJobId !== "string" || !providerJobId) {
        throw new CreativeError(CREATIVE_ERROR.PROVIDER_UNEXPECTED_RESPONSE, "The 3D generation service accepted the request but returned no job id.", { outcomeUnknown: true, details: { keys: Object.keys(payload) } });
      }
      return { providerJobId, providerStatus: typeof job.status === "string" ? job.status : null };
    },

    /** @returns {Promise<{ providerStatus: string, providerProgress: number|null, assetIds: string[], providerError: string|null, cost: number|null }>} */
    async getJob(providerJobId) {
      const payload = await call("GET", `/jobs/${encodeURIComponent(providerJobId)}`);
      const job = payload.job ?? payload;
      if (typeof job.status !== "string" || !job.status) {
        throw new CreativeError(CREATIVE_ERROR.PROVIDER_UNEXPECTED_RESPONSE, "The 3D generation service returned a job without a status.", { details: { keys: Object.keys(job) } });
      }
      const ids = job.metadata?.assetIds; // documented
      const cost = [job.billing?.cost, job.cuCost].find((v) => typeof v === "number" && Number.isFinite(v));
      return {
        providerStatus: job.status,
        providerProgress: typeof job.progress === "number" && Number.isFinite(job.progress) ? job.progress : null,
        assetIds: Array.isArray(ids) ? ids.filter((x) => typeof x === "string" && x) : [],
        providerError: typeof job.error === "string" ? job.error.slice(0, 300) : typeof job.error?.message === "string" ? job.error.message.slice(0, 300) : null,
        cost: cost ?? null,
      };
    },

    /** Resolve a CURRENT url for an asset. @returns {Promise<{ url: string, mimeType: string|null }>} */
    async getAsset(assetId) {
      const payload = await call("GET", `/assets/${encodeURIComponent(assetId)}`);
      const asset = payload.asset ?? payload;
      if (typeof asset.url !== "string" || !/^https:\/\//.test(asset.url)) {
        throw new CreativeError(CREATIVE_ERROR.PROVIDER_UNEXPECTED_RESPONSE, "The 3D generation service returned an asset without a download address.", { details: { keys: Object.keys(asset) } });
      }
      return { url: asset.url, mimeType: typeof asset.mimeType === "string" ? asset.mimeType : null };
    },
  };
}

function safeMessage(payload, text) {
  const m = payload?.message ?? payload?.error?.message ?? payload?.error ?? payload?.reason;
  const s = typeof m === "string" ? m : typeof text === "string" && text.length < 400 && !text.trim().startsWith("<") ? text : "";
  return s.replace(/\s+/g, " ").trim().slice(0, 300);
}
