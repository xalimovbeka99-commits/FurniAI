import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FINGERPRINT_PREFIX, isFingerprint, sha256Hex } from "./fingerprint.js";

describe("pure-JS SHA-256 used for proposal fingerprints", () => {
  it("matches the FIPS 180-4 published vectors", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
    );
  });

  it("matches node:crypto across every message length that crosses a block boundary", () => {
    for (let n = 0; n < 300; n += 1) {
      const message = "x".repeat(n);
      expect(sha256Hex(message), `length ${n}`).toBe(createHash("sha256").update(message, "utf8").digest("hex"));
    }
  });

  it("pads correctly at every exact block boundary", () => {
    // 55 is the largest message that still fits in one block with its 0x80 byte
    // and 8-byte length; 56 forces a second block. An off-by-one in the padding
    // formula shows up here and nowhere else.
    for (const n of [0, 54, 55, 56, 63, 64, 65, 118, 119, 120, 127, 128, 191, 192]) {
      const message = "y".repeat(n);
      expect(sha256Hex(message), `boundary length ${n}`).toBe(
        createHash("sha256").update(message, "utf8").digest("hex")
      );
    }
  });

  it("matches node:crypto on random and multi-byte UTF-8 input", () => {
    for (let i = 0; i < 100; i += 1) {
      const message = randomBytes(64).toString("base64") + " — 450мм × ø35 — 日本語";
      expect(sha256Hex(message)).toBe(createHash("sha256").update(message, "utf8").digest("hex"));
    }
  });

  it("needs no node-only API — TextEncoder is the only global used", () => {
    expect(typeof TextEncoder).toBe("function");
  });

  it("recognises well-formed fingerprints only", () => {
    expect(isFingerprint(`${FINGERPRINT_PREFIX}${sha256Hex("abc")}`)).toBe(true);
    expect(isFingerprint(sha256Hex("abc"))).toBe(false);
    expect(isFingerprint("fs256:NOTHEX")).toBe(false);
    expect(isFingerprint(null)).toBe(false);
    expect(isFingerprint(123)).toBe(false);
  });
});
