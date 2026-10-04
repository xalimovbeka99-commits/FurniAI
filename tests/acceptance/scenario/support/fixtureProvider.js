/**
 * MOCKED Scenario provider + MOCKED asset CDN for acceptance tests (LOCAL only).
 *
 * Protocol-compatible with Claude's src/lib/creative/scenarioStandIn.js (same
 * /v1 paths, same response shapes, same default status words
 * sim-running / sim-done / sim-failed) — those words and shapes are test
 * PARAMETERS, not claims about the real Scenario API. It adds the knobs the
 * acceptance suite needs that the stand-in does not have:
 *
 *   - a CDN that actually serves bytes (the fixture GLBs) behind signed,
 *     single-issue URLs, so the download leg can be inspected;
 *   - per-call delays (deterministic interleaving of concurrent polls);
 *   - CDN expiry / failure injection (to prove "re-call once, never cache");
 *   - provider failure modes on the paid call (5xx, dropped connection,
 *     no job id, held open) and on the asset lookup (404 / 410 / 5xx).
 *
 * The provider hands out https://cdn.fixture.invalid/... URLs (the product's
 * client requires https). `.invalid` can never resolve, so nothing can leave
 * the machine: tests map that host to this server's /cdn/ route explicitly
 * (cdnLocalUrl in Node; page.route in the browser).
 */
import http from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

export const CDN_HOST = "https://cdn.fixture.invalid";
const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../fixtures/scenario");

export function loadFixture(name) {
  return readFileSync(join(FIXTURE_DIR, name));
}

const VARIANT_FILES = {
  cube: "textured-cube.glb",
  truncated: "truncated.glb",
  "bad-magic": "bad-magic.glb",
  "no-mesh": "no-mesh.glb",
  "missing-texture": "missing-texture.glb",
  "corrupt-texture": "corrupt-texture.glb",
  html: "html-as.glb",
};

export function freshProviderState(overrides = {}) {
  return {
    statusWords: { running: "sim-running", success: "sim-done", failure: "sim-failed" },
    cost: 12,
    costField: "billing",
    pollsUntilDone: 1,
    outcome: "success", // success | failure | success-no-assets
    generateMode: "ok", // ok | http500 | drop | nojobid | http402 | http429 | hold
    generateDelayMs: 0,
    jobDelaysMs: [], // delay for the Nth /jobs call (0-based), e.g. [400, 0]
    jobMode: "ok", // ok | http500
    assetMode: "ok", // ok | gone404 | gone410 | http500
    assetExtension: "glb",
    assetMimeType: null, // the provider asset record's mimeType (stand-in sends none)
    cdnVariant: "cube",
    cdnContentType: null, // override; default by variant
    cdnCors: true,
    cdnFailNext: 0, // next N CDN fetches answer 403 "expired"
    cdnRevokeIssued: false, // every URL issued so far is expired
    calls: { upload: 0, dryRun: 0, generate: 0, job: 0, asset: 0, model: 0, cdn: 0, cdnOk: 0 },
    issuedUrls: [],
    held: [],
    ...overrides,
  };
}

export async function startFixtureProvider(overrides = {}, { port = 0 } = {}) {
  let state = freshProviderState(overrides);
  const jobs = new Map();
  const issued = new Set();
  const revoked = new Set();
  const send = (res, code, obj, extra = {}) => { res.writeHead(code, { "content-type": "application/json", ...extra }); res.end(JSON.stringify(obj)); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8");
    let body = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
    const p = url.pathname;
    const s = state;

    // ---------------------------------------------------------------- CDN
    if (p.startsWith("/cdn/")) {
      s.calls.cdn++;
      const cors = s.cdnCors ? { "access-control-allow-origin": "*" } : {};
      if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
      const token = url.searchParams.get("sig");
      const expired = !token || !issued.has(token) || revoked.has(token) || s.cdnRevokeIssued;
      if (s.cdnFailNext > 0 || expired) {
        if (s.cdnFailNext > 0) s.cdnFailNext--;
        res.writeHead(403, { "content-type": "text/html; charset=utf-8", ...cors });
        return res.end(loadFixture("html-as.glb"));
      }
      const variant = s.cdnVariant;
      const bytes = loadFixture(VARIANT_FILES[variant]);
      const type = s.cdnContentType ?? (variant === "html" ? "text/html; charset=utf-8" : "model/gltf-binary");
      s.calls.cdnOk++;
      res.writeHead(200, { "content-type": type, "content-length": bytes.length, "cache-control": "private, max-age=0", ...cors });
      return res.end(bytes);
    }

    // ---------------------------------------------------- provider (/v1)
    if (req.method === "POST" && p === "/v1/assets") {
      s.calls.upload++;
      return send(res, 200, { asset: { id: `asset_ref_${s.calls.upload}` } });
    }
    if (req.method === "GET" && p.startsWith("/v1/models/")) {
      s.calls.model++;
      return send(res, 200, { model: { id: p.split("/").pop() } });
    }
    if (req.method === "POST" && p.startsWith("/v1/generate/custom/")) {
      if (url.searchParams.get("dryRun") === "true") {
        s.calls.dryRun++;
        return send(res, 200, s.costField === "billing" ? { billing: { cost: s.cost } } : { ok: true });
      }
      s.calls.generate++;
      if (s.generateDelayMs) await sleep(s.generateDelayMs);
      switch (s.generateMode) {
        case "http500": return send(res, 500, { message: "simulated upstream failure" });
        case "http402": return send(res, 402, { message: "simulated: not enough credits" });
        case "http429": return send(res, 429, { message: "simulated rate limit" });
        case "drop": return req.socket.destroy();
        case "nojobid": return send(res, 200, { accepted: true });
        case "hold": s.held.push({ req, res }); return undefined;
        default: break;
      }
      const jobId = `job_fx_${s.calls.generate}`;
      jobs.set(jobId, { polls: 0 });
      return send(res, 200, { job: { jobId, status: s.statusWords.running } });
    }
    if (req.method === "GET" && p.startsWith("/v1/jobs/")) {
      const n = s.calls.job++;
      const delay = s.jobDelaysMs[n] ?? 0;
      const jobId = decodeURIComponent(p.split("/").pop());
      const j = jobs.get(jobId);
      // decide the answer at ARRIVAL, deliver it after the delay
      let answer;
      if (s.jobMode === "http500") answer = [500, { message: "simulated status outage" }];
      else if (!j) answer = [404, { message: "job not found" }];
      else {
        j.polls++;
        if (j.polls < s.pollsUntilDone) answer = [200, { job: { jobId, status: s.statusWords.running, progress: 0.5 } }];
        else if (s.outcome === "failure") answer = [200, { job: { jobId, status: s.statusWords.failure, error: "simulated generation failure" } }];
        else if (s.outcome === "success-no-assets") answer = [200, { job: { jobId, status: s.statusWords.success, metadata: { assetIds: [] } } }];
        else answer = [200, { job: { jobId, status: s.statusWords.success, metadata: { assetIds: [`asset_out_${jobId}`] }, billing: { cost: s.cost } } }];
      }
      if (delay) await sleep(delay);
      return send(res, answer[0], answer[1]);
    }
    if (req.method === "GET" && p.startsWith("/v1/assets/")) {
      s.calls.asset++;
      if (s.assetMode === "gone404") return send(res, 404, { message: "asset not found" });
      if (s.assetMode === "gone410") return send(res, 410, { message: "asset gone" });
      if (s.assetMode === "http500") return send(res, 500, { message: "simulated asset lookup outage" });
      const id = decodeURIComponent(p.split("/").pop());
      const token = createHash("sha256").update(`${id}:${s.calls.asset}:${Date.now()}:${Math.random()}`).digest("hex").slice(0, 24);
      issued.add(token);
      const assetUrl = `${CDN_HOST}/assets/${id}.${s.assetExtension}?sig=${token}&n=${s.calls.asset}`;
      s.issuedUrls.push(assetUrl);
      return send(res, 200, { asset: { id, url: assetUrl, ...(s.assetMimeType ? { mimeType: s.assetMimeType } : {}) } });
    }
    return send(res, 404, { message: "no such route" });
  });
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    get state() { return state; },
    reset(o = {}) {
      for (const h of state.held) try { h.req.socket.destroy(); } catch { /* ignore */ }
      state = freshProviderState(o);
      jobs.clear();
      issued.clear();
      revoked.clear();
    },
    /** answer every held paid call, then stop holding */
    releaseHeld(mode = "ok") {
      const held = state.held.splice(0);
      for (const { req, res } of held) {
        if (mode === "drop") { req.socket.destroy(); continue; }
        const jobId = `job_fx_held_${Math.random().toString(16).slice(2, 8)}`;
        jobs.set(jobId, { polls: 0 });
        send(res, 200, { job: { jobId, status: state.statusWords.running } });
      }
      return held.length;
    },
    revokeIssued() { for (const t of issued) revoked.add(t); },
    origin,
    baseUrl: `${origin}/v1`,
    /** Map a provider-issued https://cdn.fixture.invalid URL to this server. */
    cdnLocalUrl: (u) => u.replace(CDN_HOST, `${origin}/cdn`),
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
  };
}
