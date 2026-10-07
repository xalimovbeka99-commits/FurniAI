/**
 * A deliberately pedantic fake of the PostgREST surface `supabaseStore.js` uses.
 * TEST SUPPORT ONLY — never imported by any runtime path.
 * ---------------------------------------------------------------------
 * WHY THIS EXISTS, AND WHAT IT IS NOT
 *
 * A stub that answers whatever the test wants proves nothing about
 * concurrency. This one enforces the parts of `supabase/schema.sql` that the
 * correctness argument actually leans on:
 *
 *   - `unique (design_id, revision)` — a second insert of the same pair is
 *     rejected with 409, exactly as Postgres would.
 *   - Row-level security as PostgREST really surfaces it, which is the detail
 *     most likely to be got wrong from memory:
 *       * SELECT of rows you cannot see returns **200 with an empty array**,
 *         NOT 403. Postgres filters them; it does not announce them.
 *       * INSERT violating a WITH CHECK policy returns **403**.
 *     Code that assumes a 403 on cross-tenant reads will look correct against
 *     a naive stub and behave differently in production.
 *   - No UPDATE or DELETE policy on `wardrobe_revisions`, so any attempt to
 *     modify a saved revision is refused.
 *
 * It also lets a test interleave two in-flight writers deterministically,
 * which is the only way to demonstrate a check-then-act race rather than
 * assert one.
 *
 * WHAT IT STILL DOES NOT PROVE: this is a single-process JavaScript fake. It
 * cannot prove Postgres transaction isolation, real lock behaviour, or that
 * the deployed policies are the ones in schema.sql. Those need the real
 * database — see docs/m3/PERSISTENCE_DB_TEST_PROCEDURE.md. Nothing in this
 * file may be cited as evidence of production durability.
 */

/** Parse the tiny slice of PostgREST query syntax the store emits. */
function parseQuery(path) {
  const [table, qs = ""] = path.split("?");
  const params = new URLSearchParams(qs);
  const filters = {};
  for (const [key, value] of params.entries()) {
    if (["select", "order", "limit", "offset"].includes(key)) continue;
    const m = /^eq\.(.*)$/.exec(value);
    if (m) filters[key] = decodeURIComponent(m[1]);
  }
  return {
    table,
    filters,
    order: params.get("order"),
    limit: params.get("limit") ? Number(params.get("limit")) : null,
  };
}

function matches(row, filters) {
  return Object.entries(filters).every(([k, v]) => String(row[k]) === String(v));
}

function sortRows(rows, order) {
  if (!order) return rows;
  const [col, dir = "asc"] = order.split(".");
  return [...rows].sort((a, b) => {
    const av = a[col];
    const bv = b[col];
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return dir === "desc" ? -cmp : cmp;
  });
}

/**
 * @param {{ visibleTo?: (row: string, table: string) => boolean }} [opts]
 *   `rlsOwner` decides which owner_user_id the connected token may see. This
 *   models "the caller's own token", which is what supabaseStore.js sends.
 */
export function createFakePostgrest({ rlsOwner = null } = {}) {
  const tables = {
    wardrobe_designs: [],
    wardrobe_revisions: [],
  };
  const calls = [];
  /** Hooks a test can use to interleave two writers. */
  const hooks = { beforeInsert: null };

  function ownerOfDesign(designId) {
    const d = tables.wardrobe_designs.find((r) => r.id === designId);
    return d ? d.owner_user_id : null;
  }

  /** Mirrors the schema's SELECT policies. */
  function selectVisible(table, row) {
    if (rlsOwner === null) return true; // RLS disabled for this fixture
    if (table === "wardrobe_designs") return row.owner_user_id === rlsOwner;
    return ownerOfDesign(row.design_id) === rlsOwner;
  }

  /** Mirrors the schema's WITH CHECK policies. */
  function insertAllowed(table, row) {
    if (rlsOwner === null) return true;
    if (table === "wardrobe_designs") return row.owner_user_id === rlsOwner;
    return ownerOfDesign(row.design_id) === rlsOwner;
  }

  const json = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

  async function fetchImpl(url, init = {}) {
    const method = init.method || "GET";
    const path = String(url).split("/rest/v1/")[1];
    const { table, filters, order, limit } = parseQuery(path);
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, table, headers: init.headers || {}, body });

    if (!tables[table]) return json(404, { message: "no such table" });

    if (method === "GET") {
      let rows = tables[table].filter((r) => matches(r, filters) && selectVisible(table, r));
      rows = sortRows(rows, order);
      if (limit) rows = rows.slice(0, limit);
      // PostgREST hides invisible rows; it does not 403 a SELECT.
      return json(200, rows);
    }

    if (method === "POST") {
      if (hooks.beforeInsert) await hooks.beforeInsert({ table, body });
      if (!insertAllowed(table, body)) {
        return json(403, { code: "42501", message: "new row violates row-level security policy" });
      }
      if (table === "wardrobe_revisions") {
        const clash = tables.wardrobe_revisions.some(
          (r) => r.design_id === body.design_id && r.revision === body.revision
        );
        if (clash) {
          return json(409, {
            code: "23505",
            message: 'duplicate key value violates unique constraint "wardrobe_revisions_design_id_revision_key"',
          });
        }
      }
      if (table === "wardrobe_designs") {
        if (body.id && tables.wardrobe_designs.some((r) => r.id === body.id)) {
          return json(409, {
            code: "23505",
            message: 'duplicate key value violates unique constraint "wardrobe_designs_pkey"',
          });
        }
      }
      const now = new Date().toISOString();
      const row = {
        id: body.id || `row-${table}-${tables[table].length + 1}`,
        created_at: body.created_at || now,
        updated_at: now,
        ...body,
      };
      tables[table].push(row);
      return json(201, [row]);
    }

    if (method === "PATCH") {
      const targets = tables[table].filter((r) => matches(r, filters) && selectVisible(table, r));
      if (table === "wardrobe_revisions") {
        // No UPDATE policy exists on revisions.
        return json(403, { code: "42501", message: "no update policy" });
      }
      for (const t of targets) Object.assign(t, body);
      return json(200, targets);
    }

    if (method === "DELETE") {
      if (table === "wardrobe_revisions") {
        return json(403, { code: "42501", message: "no delete policy" });
      }
      return json(200, []);
    }

    return json(405, { message: "method not allowed" });
  }

  return { fetchImpl, tables, calls, hooks };
}
