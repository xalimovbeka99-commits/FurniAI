/**
 * TEST-SIDE reference client for the Scenario 3D contract (§2.4–§2.5).
 * NOT product code: it encodes what the contract tells a UI to do, so the
 * acceptance suite and the browser TEST HARNESS can check the API against it.
 * Runs in Node and in the browser.
 *
 *  - a fresh idempotencyKey per Generate click (caller supplies the click);
 *  - the asset address is resolved from /api/creative?resource=asset EVERY
 *    time something is viewed or downloaded — never cached, never persisted;
 *  - if loading the resolved url fails, resolve again ONCE, then give up;
 *  - 410 ASSET_UNAVAILABLE / 409 ASSET_NOT_READY / 409 RECORD_INTEGRITY_FAILED
 *    are answers, not load failures: no re-call;
 *  - submission_unknown and failed are terminal: stop polling, never resubmit.
 */
export const TERMINAL = ["succeeded", "failed", "submission_unknown"];

export function createConceptClient({ apiUrl, authHeader, fetchApi = (...a) => fetch(...a), fetchAsset = (...a) => fetch(...a) }) {
  const stats = { resolve: 0, assetFetch: 0, submit: 0, poll: 0 };
  async function api(method, qs, body) {
    const r = await fetchApi(`${apiUrl}?${qs}`, { method, headers: { authorization: authHeader, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: r.status, body: json };
  }
  const client = {
    stats,
    api,
    upload: (name, dataBase64, contentType) => api("POST", "resource=references", { name, dataBase64, ...(contentType ? { contentType } : {}) }),
    submit(referenceId, idempotencyKey) { stats.submit++; return api("POST", "resource=jobs", { referenceId, idempotencyKey }); },
    poll(jobId) { stats.poll++; return api("GET", `resource=jobs&jobId=${encodeURIComponent(jobId)}`); },
    list: () => api("GET", "resource=jobs"),
    resolve(jobId, index = 0) { stats.resolve++; return api("GET", `resource=asset&jobId=${encodeURIComponent(jobId)}&index=${index}`); },
    /** @returns {Promise<{ ok: true, bytes: Uint8Array, contentType: string|null, asset: object, attempts: number } | { ok: false, code: string, status?: number, attempts: number }>} */
    async loadAssetBytes(jobId, index = 0) {
      let attempts = 0;
      for (;;) {
        attempts++;
        const r = await client.resolve(jobId, index);
        if (r.status !== 200) return { ok: false, code: r.body?.code ?? `HTTP_${r.status}`, status: r.status, attempts };
        let res = null;
        try { stats.assetFetch++; res = await fetchAsset(r.body.asset.url); } catch { res = null; }
        if (res && res.ok) {
          const bytes = new Uint8Array(await res.arrayBuffer());
          return { ok: true, bytes, contentType: res.headers.get("content-type"), asset: r.body.asset, attempts };
        }
        if (attempts >= 2) return { ok: false, code: "ASSET_LOAD_FAILED", status: res?.status, attempts };
      }
    },
  };
  return client;
}
