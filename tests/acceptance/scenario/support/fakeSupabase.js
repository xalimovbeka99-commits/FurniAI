/**
 * MOCKED Supabase (auth + PostgREST) for the creative tables — LOCAL, test-only.
 * NOT a database and NOT evidence about Postgres. It models exactly what the
 * unapplied migration supabase/migrations/2026-10-04_creative_generation.sql
 * declares, so the tampering threat can be shown end-to-end with an ordinary
 * signed-in user's own token:
 *
 *   - RLS: select / insert / update only where owner_user_id = auth.uid()
 *     (migration lines 30-33 and 67-75). No delete policy.
 *   - unique (owner_user_id, sha256) on creative_references;
 *   - primary keys; unique (owner_user_id, idempotency_key);
 *     partial unique (owner_user_id, reference_id, model_id) where status in
 *     ('submitting','processing')  — a violation answers 409 like PostgREST.
 *   - the status CHECK constraint.
 *
 * Tokens are placeholders: "fixture-token:<uuid>".
 */
import http from "node:http";

const ACTIVE = ["submitting", "processing"];
const STATUSES = ["submitting", "processing", "succeeded", "failed", "submission_unknown"];

function parseFilters(sp) {
  const f = [];
  for (const [k, v] of sp.entries()) {
    if (["select", "order", "limit", "offset"].includes(k)) continue;
    let m;
    if ((m = /^eq\.(.*)$/.exec(v))) f.push((r) => String(r[k]) === m[1]);
    else if ((m = /^in\.\((.*)\)$/.exec(v))) { const set = m[1].split(","); f.push((r) => set.includes(String(r[k]))); }
    else f.push(() => false);
  }
  return (r) => f.every((fn) => fn(r));
}

export async function startFakeSupabase() {
  const tables = { creative_references: [], creative_jobs: [] };
  const calls = [];
  const userOf = (req) => {
    const t = (req.headers.authorization || "").replace(/^Bearer /, "");
    return t.startsWith("fixture-token:") ? t.slice("fixture-token:".length) : null;
  };
  const send = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(obj === undefined ? "" : JSON.stringify(obj)); };

  function violates(table, row, ignore) {
    const rows = tables[table].filter((r) => r !== ignore);
    if (rows.some((r) => r.id === row.id)) return true;
    if (table === "creative_references") return rows.some((r) => r.owner_user_id === row.owner_user_id && r.sha256 === row.sha256);
    if (rows.some((r) => r.owner_user_id === row.owner_user_id && r.idempotency_key === row.idempotency_key)) return true;
    if (ACTIVE.includes(row.status) && rows.some((r) => r.owner_user_id === row.owner_user_id && r.reference_id === row.reference_id && r.model_id === row.model_id && ACTIVE.includes(r.status))) return true;
    return false;
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8");
    const body = raw ? JSON.parse(raw) : null;
    const uid = userOf(req);
    calls.push({ method: req.method, path: url.pathname + url.search, uid });
    if (url.pathname === "/auth/v1/user") return uid ? send(res, 200, { id: uid }) : send(res, 401, { message: "invalid token" });
    const m = /^\/rest\/v1\/(creative_references|creative_jobs)$/.exec(url.pathname);
    if (!m) return send(res, 404, { message: "no route" });
    if (!uid) return send(res, 401, { message: "JWT required" });
    const table = m[1];
    const visible = tables[table].filter((r) => r.owner_user_id === uid); // RLS select
    const match = parseFilters(url.searchParams);
    if (req.method === "GET") {
      let rows = visible.filter(match);
      const order = url.searchParams.get("order");
      if (order) { const [col, dir] = order.split("."); rows = [...rows].sort((a, b) => (a[col] < b[col] ? -1 : 1) * (dir === "desc" ? -1 : 1)); }
      const limit = Number(url.searchParams.get("limit") || 0);
      return send(res, 200, (limit ? rows.slice(0, limit) : rows).map((r) => structuredClone(r)));
    }
    if (req.method === "POST") {
      const row = { ...body };
      if (row.owner_user_id !== uid) return send(res, 403, { message: "new row violates row-level security policy" });
      if (table === "creative_jobs") {
        if (!STATUSES.includes(row.status)) return send(res, 400, { message: "check constraint" });
        row.outputs ??= [];
        if (!tables.creative_references.some((r) => r.id === row.reference_id)) return send(res, 409, { message: "foreign key violation" });
      }
      if (violates(table, row)) return send(res, 409, { message: "duplicate key value violates unique constraint" });
      tables[table].push(row);
      return send(res, 201, [structuredClone(row)]);
    }
    if (req.method === "PATCH") {
      if (table === "creative_references") return send(res, 403, { message: "permission denied (no update policy)" });
      const targets = visible.filter(match);
      for (const t of targets) {
        const next = { ...t, ...body };
        if (next.owner_user_id !== uid) return send(res, 403, { message: "new row violates row-level security policy" });
        if (!STATUSES.includes(next.status)) return send(res, 400, { message: "check constraint" });
        if (violates(table, next, t)) return send(res, 409, { message: "duplicate key value violates unique constraint" });
      }
      for (const t of targets) Object.assign(t, body);
      return send(res, 200, targets.map((r) => structuredClone(r)));
    }
    return send(res, 405, { message: "method not allowed" });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  /** What any signed-in user can do with their own token and the public anon key. */
  async function rest(token, method, path, body) {
    const r = await fetch(`${origin}/rest/v1/${path}`, { method, headers: { apikey: "fixture-anon-not-real", authorization: `Bearer ${token}`, "content-type": "application/json", prefer: "return=representation" }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    return { status: r.status, body: text ? JSON.parse(text) : null };
  }
  return { origin, tables, calls, rest, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }) };
}
