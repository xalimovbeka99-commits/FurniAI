/**
 * Shared JSON helpers for /api/designs* serverless handlers.
 */

import { resolveCaller } from "./auth.js";
import { createDesignService } from "./designService.js";
import { getSharedMemoryStore } from "./memoryStore.js";
import { createSupabaseDesignStore, supabasePersistenceConfigured } from "./supabaseStore.js";
import { PersistenceError, PERSISTENCE_ERROR, toErrorBody } from "./errors.js";

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new PersistenceError("BAD_REQUEST", "Request body must be JSON.", { status: 400 });
  }
}

/** True on anything Vercel runs — Production AND Preview. */
function isDeployed(env = process.env) {
  return Boolean(env.VERCEL_ENV) || env.NODE_ENV === "production";
}

/**
 * Choose the store for THIS request.
 *
 * `getSharedMemoryStore()` is a module-level Map. On Vercel it is per-instance
 * and per-lifetime: a design saved by one invocation is absent from the next,
 * intermittently, depending on which instance answers. Serving a deployed
 * environment from it would make "durable save/reopen" a claim the system
 * cannot keep, and would fail in the least explicable way possible — a design
 * that existed a minute ago reported as "not found".
 *
 * So a deployed environment without Supabase configured FAILS CLOSED with a
 * configuration error rather than quietly pretending to persist. The in-memory
 * store remains the default for local runs and tests only.
 *
 * @param {{ accessToken: string|null }} caller
 */
export function getService(caller = { accessToken: null }) {
  if (supabasePersistenceConfigured() && caller.accessToken) {
    return createDesignService({
      store: createSupabaseDesignStore({
        url: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY,
        accessToken: caller.accessToken,
      }),
    });
  }

  if (isDeployed()) {
    throw new PersistenceError(
      PERSISTENCE_ERROR.BAD_REQUEST,
      "Design saving is not configured on this deployment. Nothing was saved.",
      { status: 503 }
    );
  }

  return createDesignService({ store: getSharedMemoryStore() });
}

export async function withAuth(req, res, fn) {
  try {
    const caller = await resolveCaller(req);
    const { userId } = caller;
    const service = getService(caller);
    await fn({ userId, service, req, res });
  } catch (err) {
    const body = toErrorBody(err);
    const status = err instanceof PersistenceError ? err.status : 500;
    json(res, status, body);
  }
}

export function methodNotAllowed(res, allow) {
  res.setHeader("allow", allow);
  json(res, 405, { ok: false, code: "METHOD_NOT_ALLOWED", error: "Method not allowed." });
}
