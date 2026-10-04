/**
 * /api/creative — AI visual-concept generation (Scenario image → 3D).
 *
 * ONE serverless function for the whole surface (the project is close to the
 * Hobby-plan function limit), dispatched on ?resource=:
 *
 *   GET  ?resource=config                       feature availability (no secrets)
 *   POST ?resource=references                   upload a reference image
 *   POST ?resource=jobs                         submit a generation
 *   GET  ?resource=jobs                         list the caller's jobs
 *   GET  ?resource=jobs&jobId=<id>              job status / result
 *   GET  ?resource=asset&jobId=<id>[&index=0]   current download address
 *
 * Contract: docs/creative/SCENARIO_3D_API_CONTRACT.md. Provider credentials
 * are read from the server environment and never returned.
 */
import { readJson } from "../src/lib/persistence/http.js";
import { withCreative, sendJson } from "../src/lib/creative/http.js";
import { CreativeError, CREATIVE_ERROR } from "../src/lib/creative/errors.js";
import { readScenarioConfig, describeScenarioConfig } from "../src/lib/creative/scenarioConfig.js";
import { ACCEPTED_REFERENCE_TYPES, MAX_REFERENCE_BYTES } from "../src/lib/creative/referenceUpload.js";

async function body(req) {
  let parsed;
  try {
    parsed = req.body !== undefined ? req.body : await readJson(req);
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CreativeError(CREATIVE_ERROR.BAD_REQUEST, "Request body must be a JSON object.");
  }
  return parsed;
}

function query(req) {
  if (req.query && typeof req.query === "object") return req.query;
  return Object.fromEntries(new URL(req.url, "http://local").searchParams);
}

export default async function handler(req, res) {
  const q = query(req);
  const resource = q.resource;
  const route = `${req.method} ${resource}`;

  switch (route) {
    case "GET config":
      return withCreative(req, res, async () => {
        const cfg = readScenarioConfig();
        sendJson(res, 200, { ok: true, ...describeScenarioConfig(cfg), reference: { acceptedTypes: ACCEPTED_REFERENCE_TYPES, maxBytes: MAX_REFERENCE_BYTES } });
      });
    case "POST references":
      return withCreative(req, res, async ({ userId, service }) => {
        const out = await service.createReference({ userId, body: await body(req) });
        sendJson(res, out.reused ? 200 : 201, { ok: true, ...out });
      });
    case "POST jobs":
      return withCreative(req, res, async ({ userId, service }) => {
        const { httpStatus, ...out } = await service.submitJob({ userId, body: await body(req) });
        sendJson(res, httpStatus, { ok: true, ...out });
      });
    case "GET jobs":
      return withCreative(req, res, async ({ userId, service }) => {
        const out = q.jobId ? await service.getJob({ userId, jobId: String(q.jobId) }) : await service.listJobs({ userId });
        sendJson(res, 200, { ok: true, ...out });
      });
    case "GET asset":
      return withCreative(req, res, async ({ userId, service }) => {
        const index = q.index === undefined ? 0 : Number(q.index);
        if (!q.jobId || !Number.isInteger(index) || index < 0) throw new CreativeError(CREATIVE_ERROR.BAD_REQUEST, "jobId is required; index must be a non-negative integer.");
        sendJson(res, 200, { ok: true, asset: await service.getAssetLink({ userId, jobId: String(q.jobId), index }) });
      });
    default:
      if (["config", "references", "jobs", "asset"].includes(resource)) {
        res.setHeader("allow", resource === "jobs" ? "GET, POST" : resource === "references" ? "POST" : "GET");
        return sendJson(res, 405, { ok: false, code: "METHOD_NOT_ALLOWED", error: "Method not allowed." });
      }
      return sendJson(res, 404, { ok: false, code: "NOT_FOUND", error: "Unknown creative resource." });
  }
}
