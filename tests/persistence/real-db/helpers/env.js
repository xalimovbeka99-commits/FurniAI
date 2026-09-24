/** Env gating — hard-refuse production. NOT production code. */

function looksLikeProdUrl(url) {
  if (!url) return false;
  const u = String(url).toLowerCase();
  if (u.includes("localhost") || u.includes("127.0.0.1")) return false;
  if (process.env.VERCEL_ENV === "production") return true;
  if (u.includes("preview") || u.includes("staging") || u.includes("supabase.co")) return false;
  if (u.includes("prod") && !u.includes("non-prod") && !u.includes("nonprod")) return true;
  if (/furniai\.(com|app)$/i.test(u)) return true;
  return false;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const i = argv.indexOf("--report");
  return {
    mode: argv.includes("--real-db") ? "real-db" : "simulated",
    reportPath: i >= 0 ? argv[i + 1] : null,
  };
}

export function gateRealDb() {
  const missing = [];
  const refuse = [];
  if (process.env.VERCEL_ENV === "production") refuse.push("VERCEL_ENV=production");
  if (process.env.PERSISTENCE_REAL_DB !== "1") missing.push("PERSISTENCE_REAL_DB=1");
  const testUrl = process.env.FURNIAI_TEST_URL || "";
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const anon = process.env.SUPABASE_ANON_KEY || "";
  const tokenA = process.env.TOKEN_A || process.env.PERSISTENCE_TOKEN_A || "";
  const tokenB = process.env.TOKEN_B || process.env.PERSISTENCE_TOKEN_B || "";
  if (!testUrl) missing.push("FURNIAI_TEST_URL");
  if (!supabaseUrl) missing.push("SUPABASE_URL");
  if (!anon) missing.push("SUPABASE_ANON_KEY");
  if (!tokenA) missing.push("TOKEN_A");
  if (!tokenB) missing.push("TOKEN_B");
  if (looksLikeProdUrl(testUrl)) refuse.push(`FURNIAI_TEST_URL looks like production: ${redactUrl(testUrl)}`);
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    refuse.push("SUPABASE_SERVICE_ROLE_KEY set — forbids service-role (bypasses RLS)");
  }
  if (refuse.length) return { ok: false, reason: "REFUSED: " + refuse.join("; "), missing: [], refuse };
  if (missing.length) return { ok: false, reason: "BLOCKED: missing env", missing, refuse: [] };
  return {
    ok: true,
    config: {
      testUrl: testUrl.replace(/\/$/, ""),
      supabaseUrl: supabaseUrl.replace(/\/$/, ""),
      anonKey: anon,
      tokenA,
      tokenB,
      designPrefix: process.env.PERSISTENCE_TEST_PREFIX || "harness-db-",
    },
  };
}

export function redactUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/…`;
  } catch {
    return "[invalid-url]";
  }
}

export function redactSecrets(text) {
  return String(text ?? "")
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [REDACTED]")
    .replace(/eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g, "[REDACTED_JWT]");
}
