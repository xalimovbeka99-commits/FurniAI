/** HTTP client for --real-db. Never logs tokens. NOT production code. */
import { redactSecrets } from "./env.js";

export function createHttpClient({ testUrl, tokenA, tokenB, designPrefix }) {
  const tokens = { A: tokenA, B: tokenB };
  const tracked = [];

  async function request(user, method, path, body) {
    const token = tokens[user];
    if (!token) throw new Error(`No token for user ${user}`);
    let res;
    try {
      res = await fetch(`${testUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      return { ok: false, status: 0, code: "NETWORK", message: redactSecrets(e.message || String(e)) };
    }
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: redactSecrets(text.slice(0, 200)) };
    }
    return {
      ok: res.ok && json?.ok !== false,
      status: res.status,
      code: json?.code,
      body: json,
      message: json?.error || json?.message,
      idempotentReplay: json?.idempotentReplay === true,
    };
  }

  return {
    mode: "real-db",
    label: "REAL-DB",
    tracked,
    async createDesign(user, name) {
      const out = await request(user, "POST", "/api/designs", {
        name: `${designPrefix || "harness-db-"}${name}`,
      });
      if (out.body?.designId) tracked.push(out.body.designId);
      return out;
    },
    listDesigns: (user) => request(user, "GET", "/api/designs"),
    getDesign: (user, id) => request(user, "GET", `/api/designs/${id}`),
    listRevisions: (user, id) => request(user, "GET", `/api/designs/${id}/revisions`),
    getRevision: (user, id, rev) => request(user, "GET", `/api/designs/${id}/revisions/${rev}`),
    saveRevision: (user, id, payload) => request(user, "POST", `/api/designs/${id}/revisions`, payload),
    async cleanup() {
      tracked.length = 0;
    },
  };
}
