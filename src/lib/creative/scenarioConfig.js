/**
 * Scenario configuration, read from the server environment only.
 *
 * Nothing about the provider that could not be verified from an authenticated
 * call is given a default here: the model id, the name of the model's image
 * input and the provider's terminal status words must be set from what
 * `npm run scenario:discover` reports for this account. An unset value makes
 * the feature answer CREATIVE_NOT_CONFIGURED rather than guess.
 */
export const DEFAULT_SCENARIO_BASE_URL = "https://api.cloud.scenario.com/v1";

const list = (v) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean);

export function readScenarioConfig(env = process.env) {
  let extraParams = {};
  let extraParamsError = null;
  if (env.SCENARIO_3D_EXTRA_PARAMS_JSON) {
    try {
      const parsed = JSON.parse(env.SCENARIO_3D_EXTRA_PARAMS_JSON);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
      extraParams = parsed;
    } catch {
      extraParamsError = "SCENARIO_3D_EXTRA_PARAMS_JSON is not a JSON object";
    }
  }
  const cap = Number(env.SCENARIO_MAX_COST_PER_JOB);
  const cfg = {
    baseUrl: (env.SCENARIO_API_BASE_URL || DEFAULT_SCENARIO_BASE_URL).replace(/\/$/, ""),
    apiKey: (env.SCENARIO_API_KEY || "").trim(),
    apiSecret: (env.SCENARIO_API_SECRET || "").trim(),
    modelId: (env.SCENARIO_3D_MODEL_ID || "").trim(),
    imageParam: (env.SCENARIO_3D_IMAGE_PARAM || "").trim(),
    imageParamIsArray: env.SCENARIO_3D_IMAGE_PARAM_IS_ARRAY === "yes",
    uploadAsDataUrl: env.SCENARIO_ASSET_UPLOAD_DATA_URL === "yes",
    extraParams,
    successStatuses: list(env.SCENARIO_STATUS_SUCCESS),
    failureStatuses: list(env.SCENARIO_STATUS_FAILURE),
    maxCostPerJob: env.SCENARIO_MAX_COST_PER_JOB && Number.isFinite(cap) && cap > 0 ? cap : null,
    liveEnabled: env.SCENARIO_LIVE_GENERATION_ENABLED === "yes",
  };
  const missing = [];
  if (!cfg.apiKey) missing.push("SCENARIO_API_KEY");
  if (!cfg.apiSecret) missing.push("SCENARIO_API_SECRET");
  if (!cfg.modelId) missing.push("SCENARIO_3D_MODEL_ID");
  if (!cfg.imageParam) missing.push("SCENARIO_3D_IMAGE_PARAM");
  if (cfg.successStatuses.length === 0) missing.push("SCENARIO_STATUS_SUCCESS");
  if (cfg.failureStatuses.length === 0) missing.push("SCENARIO_STATUS_FAILURE");
  if (extraParamsError) missing.push("SCENARIO_3D_EXTRA_PARAMS_JSON (invalid)");
  cfg.missing = missing;
  cfg.credentialsConfigured = Boolean(cfg.apiKey && cfg.apiSecret);
  cfg.configured = missing.length === 0;
  return cfg;
}

/** Operator-safe report: names and non-secret values only. */
export function describeScenarioConfig(cfg) {
  return {
    provider: "scenario",
    configured: cfg.configured,
    missing: cfg.missing,
    modelId: cfg.modelId || null,
    liveGenerationEnabled: cfg.liveEnabled,
    maxCostPerJob: cfg.maxCostPerJob,
  };
}
