/**
 * GET /api/design/health — operator-only configuration report for the AI
 * designer and design persistence. NO provider call, nothing billed, no
 * credential value in the response (see providerConfigReport.js).
 *
 * Answers only on Preview and local runs. On Production it is a 404
 * indistinguishable from a missing route, so it discloses nothing there: the
 * production surface keeps its neutral "AI" labelling.
 */
import { describeProviderConfig } from "../../src/lib/ai-provider/providerConfigReport.js";

export function healthEndpointEnabled(env = process.env) {
  return env.VERCEL_ENV !== "production";
}

export default async function handler(req, res) {
  const send = (status, body) => {
    res.statusCode = status;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify(body));
  };
  if (!healthEndpointEnabled()) return send(404, { ok: false, code: "NOT_FOUND" });
  if (req.method !== "GET") {
    res.setHeader("allow", "GET");
    return send(405, { ok: false, code: "METHOD_NOT_ALLOWED" });
  }
  return send(200, { ok: true, ...describeProviderConfig(process.env) });
}
