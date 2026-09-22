/**
 * Shared JSON helpers for /api/designs* serverless handlers.
 */

import { resolveUserId } from "./auth.js";
import { createDesignService } from "./designService.js";
import { getSharedMemoryStore } from "./memoryStore.js";
import { PersistenceError, toErrorBody } from "./errors.js";

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

export function getService() {
  return createDesignService({ store: getSharedMemoryStore() });
}

export async function withAuth(req, res, fn) {
  try {
    const userId = await resolveUserId(req);
    const service = getService();
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
