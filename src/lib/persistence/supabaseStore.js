/**
 * Durable, server-side store for wardrobe designs and their revisions.
 * ---------------------------------------------------------------------
 * Backs the same interface as memoryStore.js against the `wardrobe_designs`
 * and `wardrobe_revisions` tables in supabase/schema.sql, over PostgREST.
 *
 * WHY THIS FILE EXISTS
 *
 * `memoryStore.js` keeps designs in a module-level `Map`. That is correct for
 * unit tests and a single local process, and wrong for the deployed pilot:
 * every Vercel serverless invocation may run in a different instance, each
 * with its own empty Map, and instances are recycled constantly. A design
 * saved by one request is simply absent from the next. Save/Reopen would pass
 * a local test and then fail in front of a customer, intermittently, with
 * "That design was not found." Durable means surviving the process.
 *
 * DEFENCE IN DEPTH — THIS IS THE IMPORTANT PART
 *
 * Every request here is made with the CALLER'S OWN access token, not a
 * service-role key. The row-level security policies in schema.sql therefore
 * apply to each query: Postgres itself refuses to return or write another
 * user's rows. The ownership check in designService.js remains the first line
 * of defence and still produces the correct 403/404; this is the second,
 * independent one. A bug in the service layer cannot, on its own, expose one
 * customer's designs to another.
 *
 * A service-role key would defeat exactly that property, so this file never
 * reads one, and no API key or Authorization value is ever written into a
 * design row.
 */

import { PersistenceError, PERSISTENCE_ERROR } from "./errors.js";

const DESIGNS = "wardrobe_designs";
const REVISIONS = "wardrobe_revisions";

/** Row shapes differ between Postgres (snake_case) and the service (camelCase). */
function toDesign(row) {
  if (!row) return null;
  return {
    designId: row.id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRevision(row) {
  if (!row) return null;
  return {
    designId: row.design_id,
    revision: row.revision,
    fingerprint: row.fingerprint,
    furniSpec: row.furnispec,
    partGraph: row.part_graph,
    origins: row.origins ?? null,
    validationStatus: row.validation_status ?? null,
    createdAt: row.created_at,
  };
}

/**
 * @param {{
 *   url: string,
 *   anonKey: string,
 *   accessToken: string,
 *   fetchImpl?: typeof fetch,
 * }} config
 */
export function createSupabaseDesignStore({ url, anonKey, accessToken, fetchImpl } = {}) {
  const base = String(url || "").replace(/\/$/, "");
  const doFetch = fetchImpl || globalThis.fetch;

  if (!base || !anonKey || !accessToken) {
    throw new PersistenceError(
      PERSISTENCE_ERROR.MISSING_AUTH,
      "Sign in is required to save or open a design.",
      { status: 401 }
    );
  }
  if (typeof doFetch !== "function") {
    throw new PersistenceError(
      PERSISTENCE_ERROR.BAD_REQUEST,
      "The design store is not reachable from this server."
    );
  }

  /**
   * One PostgREST call. Never logs or returns the token, the anon key, or a
   * raw provider body — a Postgres error string can quote row contents.
   */
  async function rest(path, { method = "GET", body, prefer } = {}) {
    let res;
    try {
      res = await doFetch(`${base}/rest/v1/${path}`, {
        method,
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          accept: "application/json",
          ...(prefer ? { Prefer: prefer } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new PersistenceError(
        PERSISTENCE_ERROR.BAD_REQUEST,
        "The design store could not be reached. Your design was not saved.",
        { status: 503 }
      );
    }

    if (res.status === 401 || res.status === 403) {
      // RLS refused. Deliberately indistinguishable from "not found" at the
      // service boundary; see requireOwnedDesign in designService.js.
      throw new PersistenceError(
        PERSISTENCE_ERROR.UNAUTHORIZED,
        "You cannot access this design.",
        { status: 403 }
      );
    }
    if (res.status === 409) {
      // unique (design_id, revision) — an immutable revision already exists.
      throw new PersistenceError(
        PERSISTENCE_ERROR.CONFLICT_REVISION,
        "That revision already exists and cannot be overwritten.",
        { status: 409 }
      );
    }
    if (!res.ok) {
      throw new PersistenceError(
        PERSISTENCE_ERROR.BAD_REQUEST,
        "The design store rejected the request. Your design was not saved.",
        { status: 502 }
      );
    }
    if (res.status === 204) return null;
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  const store = {
    kind: "supabase",

    async createDesign({ ownerUserId, name, designId }) {
      const payload = {
        owner_user_id: ownerUserId,
        name: name || "Untitled wardrobe",
        ...(designId ? { id: designId } : {}),
      };
      const rows = await rest(DESIGNS, {
        method: "POST",
        body: payload,
        prefer: "return=representation",
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) {
        throw new PersistenceError(
          PERSISTENCE_ERROR.BAD_REQUEST,
          "The design could not be created."
        );
      }
      return toDesign(row);
    },

    async getDesign(designId) {
      const rows = await rest(
        `${DESIGNS}?id=eq.${encodeURIComponent(designId)}&select=*&limit=1`
      );
      return toDesign(Array.isArray(rows) ? rows[0] : null);
    },

    async listDesigns(ownerUserId) {
      const rows = await rest(
        `${DESIGNS}?owner_user_id=eq.${encodeURIComponent(ownerUserId)}&select=*&order=updated_at.desc`
      );
      return (Array.isArray(rows) ? rows : []).map(toDesign);
    },

    async listRevisions(designId) {
      const rows = await rest(
        `${REVISIONS}?design_id=eq.${encodeURIComponent(designId)}&select=*&order=revision.asc`
      );
      return (Array.isArray(rows) ? rows : []).map(toRevision);
    },

    async getRevision(designId, revision) {
      const rows = await rest(
        `${REVISIONS}?design_id=eq.${encodeURIComponent(designId)}&revision=eq.${encodeURIComponent(revision)}&select=*&limit=1`
      );
      return toRevision(Array.isArray(rows) ? rows[0] : null);
    },

    async getLatestRevision(designId) {
      const rows = await rest(
        `${REVISIONS}?design_id=eq.${encodeURIComponent(designId)}&select=*&order=revision.desc&limit=1`
      );
      return toRevision(Array.isArray(rows) ? rows[0] : null);
    },

    /**
     * Append an immutable revision.
     *
     * The service layer checks for an existing revision first, but two
     * concurrent saves can both pass that check. `unique (design_id, revision)`
     * in schema.sql is what actually makes a revision immutable and
     * addressable; the 409 it raises is translated above. The check and the
     * constraint are not redundant — the check gives a good message, the
     * constraint gives the guarantee.
     */
    async appendRevision(row) {
      const inserted = await rest(REVISIONS, {
        method: "POST",
        body: {
          design_id: row.designId,
          revision: row.revision,
          fingerprint: row.fingerprint,
          furnispec: row.furniSpec,
          part_graph: row.partGraph,
          origins: row.origins ?? null,
          validation_status: row.validationStatus ?? null,
          ...(row.createdAt ? { created_at: row.createdAt } : {}),
        },
        prefer: "return=representation",
      });
      const saved = Array.isArray(inserted) ? inserted[0] : inserted;
      if (!saved) {
        throw new PersistenceError(
          PERSISTENCE_ERROR.BAD_REQUEST,
          "The revision could not be saved."
        );
      }
      // Touch the parent so listDesigns' ordering reflects real activity.
      // Best-effort: the revision is already durably committed, and failing
      // the save because a timestamp did not update would be worse.
      try {
        await rest(`${DESIGNS}?id=eq.${encodeURIComponent(row.designId)}`, {
          method: "PATCH",
          body: { updated_at: new Date().toISOString() },
          prefer: "return=minimal",
        });
      } catch {
        /* ignore — ordering only */
      }
      return toRevision(saved);
    },
  };

  return store;
}

/** True when the environment carries enough configuration to be durable. */
export function supabasePersistenceConfigured(env = process.env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
}
