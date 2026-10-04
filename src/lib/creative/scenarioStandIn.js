/**
 * SIMULATED Scenario service for tests — a local HTTP server speaking the
 * documented endpoint paths. It proves FurniAI's behaviour against a stated
 * provider behaviour; it is NOT evidence of what the real Scenario API does.
 * The status words and response shapes it uses are parameters, not claims.
 */
import http from "node:http";

export async function startScenarioStandIn(options = {}) {
  const state = {
    statusWords: { running: "sim-running", success: "sim-done", failure: "sim-failed" },
    cost: 12,
    costField: "billing", // "billing" | "none"
    pollsUntilDone: 1,
    outcome: "success",
    assetExtension: "glb",
    onGenerate: null, // (req,res) => true when it handled the response itself
    assetGone: false,
    authOk: true,
    calls: { upload: 0, dryRun: 0, generate: 0, job: 0, asset: 0, model: 0 },
    lastGenerateBody: null,
    lastUploadBody: null,
    lastAuth: null,
    jobs: new Map(),
    ...options,
  };
  const send = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : null;
    state.lastAuth = req.headers.authorization || null;
    if (!state.authOk) return send(res, 401, { message: "Unauthorized" });
    const p = url.pathname;

    if (req.method === "POST" && p === "/v1/assets") {
      state.calls.upload++;
      state.lastUploadBody = body;
      return send(res, 200, { asset: { id: `asset_ref_${state.calls.upload}` } });
    }
    if (req.method === "GET" && p.startsWith("/v1/models/")) {
      state.calls.model++;
      return send(res, 200, { model: { id: p.split("/").pop(), capabilities: ["img23d"] } });
    }
    if (req.method === "POST" && p.startsWith("/v1/generate/custom/")) {
      if (url.searchParams.get("dryRun") === "true") {
        state.calls.dryRun++;
        return send(res, 200, state.costField === "billing" ? { billing: { cost: state.cost } } : { ok: true });
      }
      state.calls.generate++;
      state.lastGenerateBody = body;
      if (state.onGenerate && (await state.onGenerate(req, res, state))) return;
      const jobId = `job_sim_${state.calls.generate}`;
      state.jobs.set(jobId, { polls: 0 });
      return send(res, 200, { job: { jobId, status: state.statusWords.running } });
    }
    if (req.method === "GET" && p.startsWith("/v1/jobs/")) {
      state.calls.job++;
      const jobId = p.split("/").pop();
      const j = state.jobs.get(jobId);
      if (!j) return send(res, 404, { message: "job not found" });
      j.polls++;
      if (j.polls < state.pollsUntilDone) return send(res, 200, { job: { jobId, status: state.statusWords.running, progress: 0.5 } });
      if (state.outcome === "failure") return send(res, 200, { job: { jobId, status: state.statusWords.failure, error: "simulated generation failure" } });
      return send(res, 200, { job: { jobId, status: state.statusWords.success, metadata: { assetIds: [`asset_out_${jobId}`] }, billing: { cost: state.cost } } });
    }
    if (req.method === "GET" && p.startsWith("/v1/assets/")) {
      state.calls.asset++;
      if (state.assetGone) return send(res, 404, { message: "asset not found" });
      const id = p.split("/").pop();
      return send(res, 200, { asset: { id, url: `https://cdn.sim.invalid/${id}.${state.assetExtension}?n=${state.calls.asset}` } });
    }
    return send(res, 404, { message: "no such route" });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    state,
    baseUrl: `http://127.0.0.1:${server.address().port}/v1`,
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
  };
}
