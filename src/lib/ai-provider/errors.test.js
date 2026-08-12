import { describe, expect, it } from "vitest";
import { ProviderError, PROVIDER_ERROR_CODES, AllProvidersUnavailableError, classifySdkError, isRetriableProviderFailure } from "./errors.js";
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
