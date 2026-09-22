/**
 * Resolve the calling user for design persistence.
 * Fail closed. Never log tokens or Authorization headers.
 */

import { PersistenceError, PERSISTENCE_ERROR } from "./errors.js";

/**
 * @param {{ headers?: Record<string, string|string[]|undefined> }} req
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<string>} user id
 */
export async function resolveUserId(req, opts = {}) {
  return (await resolveCaller(req, opts)).userId;
}

/**
 * Resolve the caller AND keep their access token, so the store can query
 * Postgres as that user and row-level security applies to every read and
 * write. The token is passed to the store and nowhere else: it is never
 * logged, never returned in a response body, and never written into a design.
 *
 * For the local test bypass there is no real token, so `accessToken` is null
 * and store selection falls back to the in-memory store.
 *
 * @param {{ headers?: Record<string, string|string[]|undefined> }} req
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<{ userId: string, accessToken: string|null }>}
 */
export async function resolveCaller(req, opts = {}) {
  const headers = req?.headers || {};
  const raw = header(headers, "authorization") || header(headers, "Authorization");
  if (!raw || typeof raw !== "string" || !raw.startsWith("Bearer ")) {
    throw new PersistenceError(
      PERSISTENCE_ERROR.MISSING_AUTH,
      "Sign in is required to save or open a design.",
      { status: 401 }
    );
  }
  const token = raw.slice("Bearer ".length).trim();
  if (!token) {
    throw new PersistenceError(
      PERSISTENCE_ERROR.MISSING_AUTH,
      "Sign in is required to save or open a design.",
      { status: 401 }
    );
  }

  // Test-only bypass. "Never enable in production" was a COMMENT, and a
  // comment does not stop a deploy: with FURNIAI_PERSISTENCE_TEST_AUTH=yes
  // set in a Vercel environment, `Authorization: Bearer test:<anyUserId>`
  // makes any caller any user and hands them that user's saved designs.
  // One mis-set environment variable was the entire distance between the
  // pilot and a cross-customer data breach.
  //
  // It is now structurally impossible to reach in a deployed environment,
  // whatever the flag says, so the flag can only ever widen access on a
  // developer's own machine. See testAuthBypassAllowed() below.
  if (testAuthBypassAllowed() && token.startsWith("test:")) {
    const userId = token.slice("test:".length).trim();
    if (!userId) {
      throw new PersistenceError(PERSISTENCE_ERROR.MISSING_AUTH, "Sign in is required to save or open a design.");
    }
    return { userId, accessToken: null };
  }

  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anon = process.env.SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !anon) {
    throw new PersistenceError(
      PERSISTENCE_ERROR.MISSING_AUTH,
      "Sign in is required to save or open a design.",
      { status: 401 }
    );
  }

  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new PersistenceError(PERSISTENCE_ERROR.MISSING_AUTH, "Sign in is required to save or open a design.");
  }

  let res;
  try {
    res = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new PersistenceError(PERSISTENCE_ERROR.MISSING_AUTH, "Sign in is required to save or open a design.");
  }

  if (!res.ok) {
    throw new PersistenceError(PERSISTENCE_ERROR.UNAUTHORIZED, "You cannot access this design.", { status: 403 });
  }

  let body;
  try {
    body = await res.json();
  } catch {
    throw new PersistenceError(PERSISTENCE_ERROR.UNAUTHORIZED, "You cannot access this design.", { status: 403 });
  }

  const userId = typeof body?.id === "string" ? body.id.trim() : "";
  if (!userId) {
    throw new PersistenceError(PERSISTENCE_ERROR.UNAUTHORIZED, "You cannot access this design.", { status: 403 });
  }
  return { userId, accessToken: token };
}

/**
 * Whether the `test:<userId>` bypass may be honoured at all.
 *
 * Three independent conditions, ALL required. Any one of them being wrong on
 * a deployed environment is enough to keep the bypass off:
 *
 *   1. NODE_ENV must not be "production" — Vercel sets this on every
 *      deployment, Preview included.
 *   2. VERCEL_ENV must be absent — it is set to production/preview/development
 *      on anything Vercel runs, so its mere presence means "deployed".
 *   3. The opt-in flag must be explicitly "yes".
 *
 * A real deployment fails 1 and 2 regardless of how 3 is configured, so the
 * flag cannot re-open the hole from the Vercel dashboard.
 *
 * @param {Record<string, string|undefined>} [env]
 */
export function testAuthBypassAllowed(env = process.env) {
  if (env.FURNIAI_PERSISTENCE_TEST_AUTH !== "yes") return false;
  if (env.NODE_ENV === "production") return false;
  if (env.VERCEL_ENV) return false;
  return true;
}

function header(headers, name) {
  const v = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0];
  return v;
}
