/**
 * Provider failure classification.
 *
 * Every provider failure used to reach the operator as one word: "unavailable".
 * The most common real cause — a credential the provider actively rejected —
 * was described identically to a genuine outage, which sends someone to check
 * a service that is up and answering. These tests pin the distinctions that
 * actually change what an operator does next, and pin that none of it reaches
 * the customer.
 */
import { describe, it, expect } from "vitest";
import { classifyUnavailable } from "../../../api/design/propose.js";

describe("classifyUnavailable", () => {
  it("names a missing configuration when no provider was even attempted", () => {
    const c = classifyUnavailable([
      { provider: "anthropic", outcome: "skipped_unconfigured" },
      { provider: "openai", outcome: "skipped_unconfigured" },
    ]);
    expect(c.code).toBe("AI_PROVIDER_NOT_CONFIGURED");
    expect(c.operatorNote).toMatch(/not an outage/i);
  });

  it("treats an empty attempt list as not configured", () => {
    expect(classifyUnavailable([]).code).toBe("AI_PROVIDER_NOT_CONFIGURED");
    expect(classifyUnavailable(undefined).code).toBe("AI_PROVIDER_NOT_CONFIGURED");
  });

  it("names a rejected credential, and says explicitly that it is not an outage", () => {
    const c = classifyUnavailable([
      { provider: "anthropic", outcome: "failed_fatal", errorCode: "AUTH_ERROR" },
    ]);
    expect(c.code).toBe("AI_PROVIDER_AUTH_REJECTED");
    expect(c.operatorNote).toMatch(/not an outage/i);
    expect(c.operatorNote).toMatch(/replace the api key/i);
  });

  it("does not let a rejected key implicate the model id", () => {
    // A 401 is decided before the model id is considered, so it is no evidence
    // about the model. Changing a model default on the strength of an auth
    // failure is how a valid configuration gets "fixed" into a broken one.
    const c = classifyUnavailable([
      { provider: "anthropic", outcome: "failed_fatal", errorCode: "AUTH_ERROR" },
    ]);
    expect(c.operatorNote).toMatch(/says nothing about whether the configured model id is valid/i);
  });

  it("treats a mix of auth failures across providers as an auth problem", () => {
    const c = classifyUnavailable([
      { provider: "anthropic", outcome: "failed_fatal", errorCode: "AUTH_ERROR" },
      { provider: "openai", outcome: "failed_fatal", errorCode: "MISSING_API_KEY" },
    ]);
    expect(c.code).toBe("AI_PROVIDER_AUTH_REJECTED");
  });

  it("does not call it an auth problem when one provider failed for another reason", () => {
    const c = classifyUnavailable([
      { provider: "anthropic", outcome: "failed_fatal", errorCode: "AUTH_ERROR" },
      { provider: "openai", outcome: "failed_retriable", errorCode: "SERVER_ERROR" },
    ]);
    expect(c.code).not.toBe("AI_PROVIDER_AUTH_REJECTED");
  });

  it("separates quota from rate limiting, because only one is worth retrying", () => {
    const quota = classifyUnavailable([{ outcome: "failed_fatal", errorCode: "QUOTA_EXCEEDED" }]);
    expect(quota.code).toBe("AI_PROVIDER_QUOTA");
    expect(quota.operatorNote).toMatch(/retrying will not help/i);

    const rate = classifyUnavailable([{ outcome: "failed_retriable", errorCode: "RATE_LIMITED" }]);
    expect(rate.code).toBe("AI_PROVIDER_RATE_LIMITED");
    expect(rate.operatorNote).toMatch(/transient/i);
    expect(rate.customerError).toMatch(/try again/i);
  });

  it("reports a timeout as a timeout, with the 504 status", () => {
    const c = classifyUnavailable([{ outcome: "failed_retriable", errorCode: "TIMEOUT" }]);
    expect(c.code).toBe("AI_PROVIDER_TIMEOUT");
    expect(c.status).toBe(504);
  });

  it("keeps a genuine outage classified as an outage", () => {
    const c = classifyUnavailable([
      { provider: "anthropic", outcome: "failed_retriable", errorCode: "UNAVAILABLE" },
    ]);
    expect(c.code).toBe("AI_PROVIDER_UNAVAILABLE");
    expect(c.operatorNote).toMatch(/genuine outage/i);
  });

  it("ignores skipped providers when classifying real failures", () => {
    const c = classifyUnavailable([
      { provider: "openai", outcome: "skipped_unconfigured" },
      { provider: "anthropic", outcome: "failed_fatal", errorCode: "AUTH_ERROR" },
    ]);
    expect(c.code).toBe("AI_PROVIDER_AUTH_REJECTED");
  });

  it("never leaks provider names, error codes or credentials to the customer", () => {
    const cases = [
      [],
      [{ outcome: "failed_fatal", errorCode: "AUTH_ERROR", provider: "anthropic" }],
      [{ outcome: "failed_fatal", errorCode: "QUOTA_EXCEEDED", provider: "openai" }],
      [{ outcome: "failed_retriable", errorCode: "UNAVAILABLE", provider: "anthropic" }],
      [{ outcome: "failed_fatal", errorCode: "UNKNOWN", provider: "openai" }],
    ];
    for (const attempted of cases) {
      const { customerError } = classifyUnavailable(attempted);
      expect(customerError).not.toMatch(/anthropic|openai|api[_ ]?key|auth|quota|token|sk-/i);
      // Every customer-facing message must say the design survived.
      expect(customerError).toMatch(/unchanged/i);
    }
  });

  it("always returns a usable status and a customer message", () => {
    for (const code of ["AUTH_ERROR", "QUOTA_EXCEEDED", "RATE_LIMITED", "TIMEOUT", "UNAVAILABLE", "SERVER_ERROR", "UNKNOWN"]) {
      const c = classifyUnavailable([{ outcome: "failed_fatal", errorCode: code }]);
      expect([503, 504]).toContain(c.status);
      expect(c.customerError.length).toBeGreaterThan(10);
      expect(c.operatorNote.length).toBeGreaterThan(10);
    }
  });
});
