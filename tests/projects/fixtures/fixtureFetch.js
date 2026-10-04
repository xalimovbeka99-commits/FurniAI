/**
 * FIXTURE fetch for /api/creative: answers ?resource=jobs&jobId= and
 * ?resource=asset from scripted handlers with contract-shaped bodies. No
 * network. It is what the REAL createCreativeAssetSource (Asset Engineer's,
 * imported by tests only) talks to, so its error mapping is exercised as-is.
 *
 * A handler returns an ok:true body, or throws:
 *   - a client error { status, code, message?, details? } -> that HTTP answer
 *   - a TypeError                                         -> fetch rejects (network)
 * Every request is recorded in `calls` as { method: "getJob"|"getAssetUrl", args }.
 */
export function createFixtureFetch({ getJob, getAssetUrl } = {}, calls = []) {
  return async function fixtureFetch(input, init = {}) {
    const url = new URL(typeof input === "string" ? input : input.url, "http://fixture.invalid");
    const auth = (init.headers && (init.headers.Authorization || init.headers.authorization)) || "";
    const accessToken = auth.replace(/^Bearer\s+/i, "");
    const resource = url.searchParams.get("resource");
    const jobId = url.searchParams.get("jobId");
    let method;
    let handler;
    let args;
    if (resource === "jobs" && jobId) {
      method = "getJob";
      handler = getJob;
      args = { jobId, accessToken };
    } else if (resource === "asset") {
      method = "getAssetUrl";
      handler = getAssetUrl;
      args = { jobId, index: Number(url.searchParams.get("index")), accessToken };
    } else {
      throw new Error(`fixture fetch: unexpected request ${url.search}`);
    }
    calls.push({ method, args });
    if (typeof handler !== "function") throw new Error(`fixture fetch: no ${method} handler`);
    let body;
    try {
      body = await handler(args);
    } catch (e) {
      if (e instanceof TypeError) throw e;
      const errBody = { ok: false, code: e.code, error: e.message || "error", ...(e.details ? { details: e.details } : {}) };
      return response(e.status || 500, errBody);
    }
    return response(200, body);
  };
}

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => "application/json" }, json: async () => body };
}
