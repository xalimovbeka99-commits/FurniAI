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

  // Test-only bypass — never enable in production.
  if (process.env.FURNIAI_PERSISTENCE_TEST_AUTH === "yes" && token.startsWith("test:")) {
    const userId = token.slice("test:".length).trim();
    if (!userId) {
      throw new PersistenceError(PERSISTENCE_ERROR.MISSING_AUTH, "Sign in is required to save or open a design.");
    }
    return userId;
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
  return userId;
}

function header(headers, name) {
  const v = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0];
  return v;
}
