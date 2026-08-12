import { describe, expect, it } from "vitest";
import {
  ProviderError,
  PROVIDER_ERROR_CODES,
  AllProvidersUnavailableError,
  classifySdkError,
  isRetriableProviderFailure,
  toFslProviderError,
  redactErrorForLogging,
} from "./errors.js";
import { FslError, ERROR_CODES } from "../fsl/errors.js";

describe("ProviderError", () => {
  it("reports retriable for every provider-availability code", () => {
    for (const code of [
      PROVIDER_ERROR_CODES.MISSING_API_KEY,
      PROVIDER_ERROR_CODES.AUTH_ERROR,
      PROVIDER_ERROR_CODES.RATE_LIMITED,
      PROVIDER_ERROR_CODES.QUOTA_EXCEEDED,
      PROVIDER_ERROR_CODES.TIMEOUT,
      PROVIDER_ERROR_CODES.SERVER_ERROR,
      PROVIDER_ERROR_CODES.UNAVAILABLE,
    ]) {
      expect(new ProviderError(code, "x").retriable).toBe(true);
    }
  });

  it("reports UNKNOWN as not retriable", () => {
    expect(new ProviderError(PROVIDER_ERROR_CODES.UNKNOWN, "x").retriable).toBe(false);
  });

  it("falls back to UNKNOWN for an unrecognized code", () => {
    const err = new ProviderError("NOT_A_REAL_CODE", "x");
    expect(err.code).toBe(PROVIDER_ERROR_CODES.UNKNOWN);
  });
});

describe("classifySdkError", () => {
  it("maps AbortError to TIMEOUT", () => {
    const err = Object.assign(new Error("aborted"), { name: "AbortError" });
    const classified = classifySdkError(err, "anthropic");
    expect(classified.code).toBe("TIMEOUT");
    expect(classified.retriable).toBe(true);
    expect(classified.provider).toBe("anthropic");
  });

  it("maps HTTP 401/403 to AUTH_ERROR", () => {
    expect(classifySdkError({ status: 401 }, "openai").code).toBe("AUTH_ERROR");
    expect(classifySdkError({ status: 403 }, "openai").code).toBe("AUTH_ERROR");
  });

  it("maps HTTP 429 to RATE_LIMITED", () => {
    expect(classifySdkError({ status: 429 }, "openai").code).toBe("RATE_LIMITED");
  });

  it("maps HTTP 5xx to SERVER_ERROR", () => {
    expect(classifySdkError({ status: 500 }, "openai").code).toBe("SERVER_ERROR");
    expect(classifySdkError({ status: 529 }, "anthropic").code).toBe("SERVER_ERROR");
  });

  it("maps a connection-refused/DNS error to UNAVAILABLE", () => {
    expect(classifySdkError({ code: "ECONNREFUSED" }, "openai").code).toBe("UNAVAILABLE");
    expect(classifySdkError({ code: "ENOTFOUND" }, "openai").code).toBe("UNAVAILABLE");
    expect(classifySdkError({ name: "APIConnectionError" }, "anthropic").code).toBe("UNAVAILABLE");
  });

  it("maps anything else to UNKNOWN (not retriable) rather than guessing", () => {
    const classified = classifySdkError(new Error("some genuinely novel failure"), "openai");
    expect(classified.code).toBe("UNKNOWN");
    expect(classified.retriable).toBe(false);
  });

  it("never leaks the raw error message into the classified ProviderError", () => {
    const secret = "sk-ant-api03-super-secret-leak-me-not";
    const raw = new Error(`Request failed: Authorization: Bearer ${secret}`);
    const classified = classifySdkError(raw, "anthropic");
    expect(classified.message).not.toContain(secret);
    expect(classified.message).not.toContain("Bearer");
  });
});

describe("isRetriableProviderFailure", () => {
  it("is true for a retriable ProviderError", () => {
    expect(isRetriableProviderFailure(new ProviderError(PROVIDER_ERROR_CODES.RATE_LIMITED, "x"))).toBe(true);
  });

  it("is false for a non-retriable ProviderError (UNKNOWN)", () => {
    expect(isRetriableProviderFailure(new ProviderError(PROVIDER_ERROR_CODES.UNKNOWN, "x"))).toBe(false);
  });

  it("is true for FslError AI_PROVIDER_ERROR / AI_PROVIDER_TIMEOUT", () => {
    expect(isRetriableProviderFailure(new FslError(ERROR_CODES.AI_PROVIDER_ERROR, "x"))).toBe(true);
    expect(isRetriableProviderFailure(new FslError(ERROR_CODES.AI_PROVIDER_TIMEOUT, "x"))).toBe(true);
  });

  it("is false for FSL business-logic / deterministic errors — never fails over on a real FurniAI error", () => {
    expect(isRetriableProviderFailure(new FslError(ERROR_CODES.INVALID_FSL, "x"))).toBe(false);
    expect(isRetriableProviderFailure(new FslError(ERROR_CODES.INVALID_DIMENSION, "x"))).toBe(false);
    expect(isRetriableProviderFailure(new FslError(ERROR_CODES.STRUCTURED_OUTPUT_ERROR, "x"))).toBe(false);
    expect(isRetriableProviderFailure(new FslError(ERROR_CODES.UNSUPPORTED_FURNITURE_TYPE, "x"))).toBe(false);
  });

  it("is false for a plain application bug (not a provider/FSL error at all)", () => {
    expect(isRetriableProviderFailure(new TypeError("cannot read properties of undefined"))).toBe(false);
    expect(isRetriableProviderFailure(new Error("deterministic wardrobe kernel bug"))).toBe(false);
  });

  it("recognizes runWardrobeAgent's own AgentTimeoutError as retriable", () => {
    const err = Object.assign(new Error("timeout"), { name: "AgentTimeoutError" });
    expect(isRetriableProviderFailure(err)).toBe(true);
  });

  it("classifies an unwrapped raw SDK error (e.g. from the Anthropic chat client passthrough) via its HTTP status", () => {
    expect(isRetriableProviderFailure({ status: 500, message: "server error" })).toBe(true);
    expect(isRetriableProviderFailure({ status: 429, message: "rate limited" })).toBe(true);
  });
});

describe("AllProvidersUnavailableError", () => {
  it("carries the AI_PROVIDER_UNAVAILABLE code and the attempt list", () => {
    const err = new AllProvidersUnavailableError("none available", { attempted: [{ provider: "anthropic", outcome: "failed_retriable" }] });
    expect(err.code).toBe("AI_PROVIDER_UNAVAILABLE");
    expect(err.attempted).toHaveLength(1);
  });
});

describe("toFslProviderError — Codex finding #1 fix: retriable vs non-retriable extraction failures", () => {
  it("maps a timeout to AI_PROVIDER_TIMEOUT", () => {
    const err = Object.assign(new Error("aborted"), { name: "AbortError" });
    expect(toFslProviderError(err, "anthropic")).toMatchObject({ name: "FslError", code: "AI_PROVIDER_TIMEOUT" });
  });

  it("maps a retriable provider-availability failure (5xx, 429, auth, network) to the retriable AI_PROVIDER_ERROR", () => {
    for (const raw of [{ status: 500 }, { status: 429 }, { status: 401 }, { code: "ECONNREFUSED" }]) {
      expect(toFslProviderError(raw, "openai")).toMatchObject({ name: "FslError", code: "AI_PROVIDER_ERROR" });
    }
  });

  it("maps a client-error-shaped failure (HTTP 400) to the NON-retriable AI_PROVIDER_REQUEST_ERROR — the bug Codex flagged", () => {
    const err = toFslProviderError({ status: 400, message: "bad request" }, "anthropic");
    expect(err.code).toBe("AI_PROVIDER_REQUEST_ERROR");
    expect(isRetriableProviderFailure(err)).toBe(false);
  });

  it("maps a genuinely unrecognized failure to the NON-retriable AI_PROVIDER_REQUEST_ERROR rather than guessing it's retriable", () => {
    const err = toFslProviderError(new Error("something neither SDK ever throws"), "openai");
    expect(err.code).toBe("AI_PROVIDER_REQUEST_ERROR");
    expect(isRetriableProviderFailure(err)).toBe(false);
  });

  it("never includes the raw error's message in the returned FslError", () => {
    const secret = "sk-ant-leak-test-should-not-appear";
    const err = toFslProviderError(new Error(`failed with key ${secret} in the request`), "anthropic");
    expect(err.message).not.toContain(secret);
  });
});

describe("redactErrorForLogging — Codex finding #2 fix: never let a raw error/cause reach console.error", () => {
  it("reduces a ProviderError down to {name, code, message} — no cause", () => {
    const err = new ProviderError(PROVIDER_ERROR_CODES.AUTH_ERROR, "The AI provider rejected the request credentials.", {
      provider: "anthropic",
      cause: new Error("Authorization: Bearer sk-ant-real-secret-value"),
    });
    const redacted = redactErrorForLogging(err);
    expect(redacted).toEqual({ name: "ProviderError", code: "AUTH_ERROR", message: "The AI provider rejected the request credentials." });
    expect(JSON.stringify(redacted)).not.toContain("sk-ant-real-secret-value");
  });

  it("reduces an FslError down to {name, code, message}", () => {
    const err = new FslError(ERROR_CODES.AI_PROVIDER_ERROR, "The AI provider request failed.");
    expect(redactErrorForLogging(err)).toEqual({ name: "FslError", code: "AI_PROVIDER_ERROR", message: "The AI provider request failed." });
  });

  it("handles a plain error with no .code gracefully", () => {
    const err = new TypeError("cannot read properties of undefined");
    expect(redactErrorForLogging(err)).toEqual({ name: "TypeError", code: null, message: "cannot read properties of undefined" });
  });

  it("ProviderError's own .cause is non-enumerable and excluded from JSON.stringify/spread — defense in depth alongside redactErrorForLogging", () => {
    const err = new ProviderError(PROVIDER_ERROR_CODES.UNKNOWN, "x", { cause: new Error("SECRET_IN_CAUSE") });
    expect(JSON.stringify(err)).not.toContain("SECRET_IN_CAUSE");
    expect(JSON.stringify({ ...err })).not.toContain("SECRET_IN_CAUSE");
    expect(Object.keys(err)).not.toContain("cause"); // for-in / Object.keys don't see it
    expect(err.cause).toBeInstanceOf(Error); // but it's still there for a debugger that asks for it by name
  });

  it("REGRESSION (Codex finding #2): documents why redaction is required — the raw error object still carries .cause with the secret reachable", () => {
    // Node's console.error prints an Error's .cause unconditionally, even
    // when non-enumerable (verified empirically; not something this test
    // suite can portably re-assert against console's internal formatting).
    // What this test guards is the actual risk surface: as long as the raw
    // error object carries the secret-bearing cause, passing IT (instead of
    // redactErrorForLogging's output) to console.error is unsafe. If a
    // future change ever logs `err` directly instead of the redacted form,
    // this is the reachable data that would leak.
    const err = new ProviderError(PROVIDER_ERROR_CODES.UNKNOWN, "safe message", { cause: new Error("RAW_SDK_SECRET_XYZ") });
    expect(err.cause.message).toContain("RAW_SDK_SECRET_XYZ");
    // ...which is exactly why every call site logs redactErrorForLogging(err), not err:
    expect(JSON.stringify(redactErrorForLogging(err))).not.toContain("RAW_SDK_SECRET_XYZ");
  });
});
