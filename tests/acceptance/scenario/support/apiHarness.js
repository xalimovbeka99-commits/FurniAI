/**
 * Drives the REAL /api/creative handler (api/creative.js → creativeService,
 * scenarioClient, memory store) over real HTTP on 127.0.0.1, with the provider
 * replaced at its HTTP boundary by a local stand-in. LOCAL / SIMULATED only:
 * every credential below is an obvious placeholder; no request can reach the
 * real Scenario API (SCENARIO_API_BASE_URL always points at 127.0.0.1).
 */
import http from "node:http";
import handler from "../../../../api/creative.js";
import { getSharedMemoryCreativeStore } from "../../../../src/lib/creative/memoryStore.js";

export const SIGNING_KEY_PLACEHOLDER = "test-hmac-secret-not-real";

export const ENV_KEYS = ["SCENARIO_API_KEY", "SCENARIO_API_SECRET", "SCENARIO_API_BASE_URL", "SCENARIO_3D_MODEL_ID", "SCENARIO_3D_IMAGE_PARAM", "SCENARIO_3D_IMAGE_PARAM_IS_ARRAY", "SCENARIO_3D_EXTRA_PARAMS_JSON", "SCENARIO_STATUS_SUCCESS", "SCENARIO_STATUS_FAILURE", "SCENARIO_LIVE_GENERATION_ENABLED", "SCENARIO_MAX_COST_PER_JOB", "SCENARIO_ASSET_UPLOAD_DATA_URL", "CREATIVE_RECORD_SIGNING_KEY", "FURNIAI_PERSISTENCE_TEST_AUTH", "VERCEL_ENV", "NODE_ENV", "SUPABASE_URL", "SUPABASE_ANON_KEY"];

export function fixtureEnv(providerBaseUrl, extra = {}) {
  if (!/^http:\/\/127\.0\.0\.1:\d+\/v1$/.test(providerBaseUrl)) throw new Error(`refusing non-local provider URL: ${providerBaseUrl}`);
  return {
    FURNIAI_PERSISTENCE_TEST_AUTH: "yes",
    SCENARIO_API_KEY: "fixture-key-not-real",
    SCENARIO_API_SECRET: "fixture-secret-not-real",
    SCENARIO_API_BASE_URL: providerBaseUrl,
    SCENARIO_3D_MODEL_ID: "model_fixture-img23d",
    SCENARIO_3D_IMAGE_PARAM: "image",
    SCENARIO_3D_IMAGE_PARAM_IS_ARRAY: "yes",
    SCENARIO_STATUS_SUCCESS: "sim-done",
    SCENARIO_STATUS_FAILURE: "sim-failed",
    SCENARIO_LIVE_GENERATION_ENABLED: "yes",
    SCENARIO_MAX_COST_PER_JOB: "20",
    CREATIVE_RECORD_SIGNING_KEY: SIGNING_KEY_PLACEHOLDER,
    ...extra,
  };
}

const saved = {};
export function applyEnv(env) {
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  Object.assign(process.env, env);
}
export function restoreEnv() {
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
}

export function store() {
  return getSharedMemoryCreativeStore();
}
export function resetStore() {
  const s = store();
  s._raw.references.clear();
  s._raw.jobs.clear();
}

export async function startApi() {
  const server = http.createServer((req, res) => handler(req, res));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/api/creative`;
  async function call(method, qs, { body, user = "user-a", auth = true, headers = {} } = {}) {
    const res = await fetch(`${url}?${qs}`, {
      method,
      headers: { ...(auth ? { authorization: `Bearer test:${user}` } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
      body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* keep text */ }
    return { status: res.status, body: json, text, headers: Object.fromEntries(res.headers) };
  }
  const api = {
    url,
    call,
    upload: (buf, opts = {}) => call("POST", "resource=references", { body: { name: opts.name ?? "wardrobe.png", ...(opts.contentType ? { contentType: opts.contentType } : {}), dataBase64: buf.toString("base64") }, ...opts }),
    submit: (referenceId, idempotencyKey = "click-00000001", opts = {}) => call("POST", "resource=jobs", { body: { referenceId, idempotencyKey, ...(opts.extraBody ?? {}) }, ...opts }),
    job: (jobId, opts = {}) => call("GET", `resource=jobs&jobId=${encodeURIComponent(jobId)}${opts.extraQs ?? ""}`, opts),
    list: (opts) => call("GET", "resource=jobs", opts),
    asset: (jobId, index = 0, opts = {}) => call("GET", `resource=asset&jobId=${encodeURIComponent(jobId)}&index=${index}`, opts),
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
  };
  return api;
}

// ------------------------------------------------------- reference bytes
export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);
export const PNG2 = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 9)]);
export const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 3)]);
export const WEBP = Buffer.concat([Buffer.from("RIFF", "latin1"), Buffer.from([0x40, 0, 0, 0]), Buffer.from("WEBPVP8 ", "latin1"), Buffer.alloc(56, 1)]);
export const GIF = Buffer.concat([Buffer.from("GIF89a", "latin1"), Buffer.alloc(64, 1)]);
export const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="10" height="10"/></svg>');
export const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n", "latin1"), Buffer.alloc(64, 2)]);
export const HTML = Buffer.from("<!DOCTYPE html><html><body>not an image</body></html>");
export const BMP = Buffer.concat([Buffer.from("BM", "latin1"), Buffer.alloc(64, 4)]);
export const HEIC = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic", "latin1"), Buffer.alloc(52, 5)]);

/** Jump the service's clock (vi.useFakeTimers({ toFake: ["Date"] }) must be on). */
export function makeClock(vi) {
  return {
    on() { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-04T08:00:00.000Z")); },
    off() { vi.useRealTimers(); },
    advance(ms) { vi.setSystemTime(new Date(Date.now() + ms)); },
  };
}
export const POLL_GAP_MS = 2_100; // server throttle is 2 s per job (creativeService.js MIN_POLL_INTERVAL_MS)
