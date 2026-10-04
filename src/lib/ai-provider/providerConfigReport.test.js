/**
 * The configuration report must (1) tell "absent" from "empty" — the router
 * cannot — (2) mirror the router's own decision exactly, (3) never contain a
 * credential, and (4) be unreachable on Production.
 *
 * No provider is contacted by anything in this file.
 */
import { describe, it, expect, afterEach } from "vitest";
import { describeProviderConfig } from "./providerConfigReport.js";
import healthHandler from "../../../api/design/health.js";

const FAKE_ANTHROPIC = "sk-ant-api03-THIS-IS-A-TEST-VALUE-NOT-A-KEY-0000000000000000000000";
const FAKE_OPENAI = "sk-proj-THIS-IS-A-TEST-VALUE-NOT-A-KEY-000000000000";

describe("absent and empty are different faults", () => {
  it("absent everywhere -> NOT_CONFIGURED_ABSENT", () => {
    const r = describeProviderConfig({ VERCEL_ENV: "preview" });
    expect(r.verdict).toBe("NOT_CONFIGURED_ABSENT");
    expect(r.providers.anthropic.state).toBe("absent");
    expect(r.wouldAttempt).toEqual([]);
  });

  it("present but empty -> NOT_CONFIGURED_EMPTY_VALUE (the router sees the same false)", () => {
    const r = describeProviderConfig({ ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "" });
    expect(r.verdict).toBe("NOT_CONFIGURED_EMPTY_VALUE");
    expect(r.providers.anthropic.state).toBe("empty");
    expect(r.providers.openai.state).toBe("empty");
  });

  it("whitespace-only is NOT empty to the router: it is attempted (and would be rejected) — named, not hidden", () => {
    const r = describeProviderConfig({ OPENAI_API_KEY: "   " });
    expect(r.providers.openai.state).toBe("whitespace-only");
    expect(r.wouldAttempt).toEqual(["openai"]);
    expect(r.verdict).toBe("CONFIGURED_UNVERIFIED");
  });

  it("configured is only ever 'unverified' — presence is not validity", () => {
    const r = describeProviderConfig({ ANTHROPIC_API_KEY: FAKE_ANTHROPIC });
    expect(r.verdict).toBe("CONFIGURED_UNVERIFIED");
    expect(r.liveCallMade).toBe(false);
  });
});

describe("mirrors the router", () => {
  it("wouldAttempt follows AI_PROVIDER_ORDER and Boolean(key), exactly as callWithFailover does", () => {
    const r = describeProviderConfig({ ANTHROPIC_API_KEY: FAKE_ANTHROPIC, OPENAI_API_KEY: FAKE_OPENAI, AI_PROVIDER_ORDER: "openai,anthropic" });
    expect(r.order).toEqual(["openai", "anthropic"]);
    expect(r.wouldAttempt).toEqual(["openai", "anthropic"]);
  });

  it("a whitespace-padded key is attempted by the router, and flagged here", () => {
    const r = describeProviderConfig({ ANTHROPIC_API_KEY: ` ${FAKE_ANTHROPIC}\n` });
    expect(r.wouldAttempt).toEqual(["anthropic"]);
    expect(r.providers.anthropic.shape).toBe("has-surrounding-whitespace");
  });

  it("flags a quoted value, which the provider would reject", () => {
    const r = describeProviderConfig({ ANTHROPIC_API_KEY: `"${FAKE_ANTHROPIC}"` });
    expect(r.providers.anthropic.shape).toBe("wrapped-in-quotes");
  });
});

describe("never carries a credential", () => {
  it("no fragment of either key appears in the report", () => {
    const text = JSON.stringify(describeProviderConfig({ ANTHROPIC_API_KEY: FAKE_ANTHROPIC, OPENAI_API_KEY: FAKE_OPENAI, SUPABASE_ANON_KEY: "anon-VALUE-123456" }));
    for (const secret of [FAKE_ANTHROPIC, FAKE_OPENAI, "anon-VALUE-123456"]) {
      for (let i = 0; i + 12 <= secret.length; i += 6) expect(text).not.toContain(secret.slice(i, i + 12));
    }
  });

  it("names the Supabase prefix trap without reading values", () => {
    const r = describeProviderConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" });
    expect(r.persistence.configured).toBe(false);
    expect(r.persistence.prefixedOnly).toBe(true);
  });
});

describe("GET /api/design/health", () => {
  const ENV = { ...process.env };
  afterEach(() => { process.env = { ...ENV }; });
  const res = () => ({ statusCode: 0, headers: {}, body: "", setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } });

  it("is a plain 404 on Production", async () => {
    process.env = { ...ENV, VERCEL_ENV: "production", ANTHROPIC_API_KEY: FAKE_ANTHROPIC };
    const r = res();
    await healthHandler({ method: "GET" }, r);
    expect(r.statusCode).toBe(404);
    expect(r.body).not.toMatch(/anthropic|openai|provider/i);
  });

  it("reports on Preview, with no value in it", async () => {
    process.env = { ...ENV, VERCEL_ENV: "preview", ANTHROPIC_API_KEY: "" };
    const r = res();
    await healthHandler({ method: "GET" }, r);
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body);
    expect(body.verdict).toBe("NOT_CONFIGURED_EMPTY_VALUE");
    expect(body.runtime.vercelEnv).toBe("preview");
    expect(r.headers["cache-control"]).toBe("no-store");
  });
});

describe("persistence: does this deployment accept the Studio's sign-in tokens?", () => {
  it("reports the project ref (public), never the anon key, and whether it matches the Studio's auth project", async () => {
    const { describeProviderConfig, STUDIO_AUTH_PROJECT_REF } = await import("./providerConfigReport.js");
    const same = describeProviderConfig({ SUPABASE_URL: `https://${STUDIO_AUTH_PROJECT_REF}.supabase.co`, SUPABASE_ANON_KEY: "eyJsecret.anon.key" });
    expect(same.persistence).toMatchObject({ configured: true, projectRef: STUDIO_AUTH_PROJECT_REF, acceptsStudioSignIn: true });
    expect(JSON.stringify(same)).not.toContain("eyJsecret");

    const other = describeProviderConfig({ SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co", SUPABASE_ANON_KEY: "k" });
    expect(other.persistence).toMatchObject({ projectRef: "abcdefghijklmnopqrst", acceptsStudioSignIn: false });

    const overridden = describeProviderConfig({
      SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co", SUPABASE_ANON_KEY: "k",
      FURNIAI_FRONTEND_AUTH_PROJECT_REF: "abcdefghijklmnopqrst",
    });
    expect(overridden.persistence.acceptsStudioSignIn).toBe(true);

    expect(describeProviderConfig({}).persistence).toMatchObject({ projectRef: null, acceptsStudioSignIn: null });
  });
});

