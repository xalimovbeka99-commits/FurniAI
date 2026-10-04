/**
 * Wiring for /api/creative: the SAME caller resolution as /api/designs
 * (persistence/auth.js) and the same fail-closed store choice.
 */
import { resolveCaller } from "../persistence/auth.js";
import { PersistenceError, toErrorBody } from "../persistence/errors.js";
import { supabasePersistenceConfigured } from "../persistence/supabaseStore.js";
import { CreativeError, CREATIVE_ERROR, toCreativeErrorBody } from "./errors.js";
import { readScenarioConfig } from "./scenarioConfig.js";
import { createScenarioClient } from "./scenarioClient.js";
import { createCreativeService } from "./creativeService.js";
import { getSharedMemoryCreativeStore } from "./memoryStore.js";
import { createSupabaseCreativeStore } from "./supabaseStore.js";

const isDeployed = (env = process.env) => Boolean(env.VERCEL_ENV) || env.NODE_ENV === "production";

export function getCreativeService(caller, env = process.env) {
  const config = readScenarioConfig(env);
  const client = createScenarioClient(config);
  const signingKey = (env.CREATIVE_RECORD_SIGNING_KEY || "").trim();
  if (supabasePersistenceConfigured() && caller.accessToken) {
    if (signingKey.length < 32) {
      throw new CreativeError(CREATIVE_ERROR.CREATIVE_NOT_CONFIGURED, "3D concept generation is not configured on this deployment.", { details: { missing: ["CREATIVE_RECORD_SIGNING_KEY"] } });
    }
    return createCreativeService({ config, client, signingKey, store: createSupabaseCreativeStore({ url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY, accessToken: caller.accessToken }) });
  }
  if (isDeployed(env)) {
    throw new CreativeError(CREATIVE_ERROR.CREATIVE_STORE_NOT_CONFIGURED, "3D concept generation has nowhere durable to record jobs on this deployment. Nothing was submitted.");
  }
  return createCreativeService({ config, client, signingKey: signingKey || undefined, store: getSharedMemoryCreativeStore() });
}

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

export function errorResponse(err) {
  if (err instanceof CreativeError) return { status: err.status, body: toCreativeErrorBody(err) };
  if (err instanceof PersistenceError) return { status: err.status, body: toErrorBody(err) };
  return { status: 500, body: toCreativeErrorBody(err) };
}

export async function withCreative(req, res, fn) {
  try {
    const caller = await resolveCaller(req);
    await fn({ userId: caller.userId, service: getCreativeService(caller) });
  } catch (err) {
    const { status, body } = errorResponse(err);
    sendJson(res, status, body);
  }
}
