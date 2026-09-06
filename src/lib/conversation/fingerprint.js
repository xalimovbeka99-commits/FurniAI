/**
 * FurniAI — Proposal Fingerprint (Gate G4 / AI-Alpha R1)
 * ---------------------------------------------------------------------
 * ALGORITHM (documented, deterministic, runtime-independent)
 *
 *   fingerprint = "fs256:" + SHA-256( UTF-8( serializeCanonicalJson(spec) ) )
 *
 * 1. `serializeCanonicalJson` (src/lib/furnispec/normalize.js) recursively
 *    sorts every object key alphabetically and normalises every number to
 *    exact 0.1mm precision, then emits `JSON.stringify(x, null, 2)`. Key
 *    order and number formatting are therefore not implementation-dependent.
 * 2. That string is UTF-8 encoded with `TextEncoder`.
 * 3. SHA-256 (FIPS 180-4) is computed by the pure-JavaScript implementation
 *    below and rendered as lower-case hex, prefixed `fs256:`.
 *
 * WHY A PURE-JS SHA-256 AND NOT `node:crypto`
 * The fingerprint is computed on both sides of the approval boundary and
 * must produce the identical value wherever the pipeline runs — the Node
 * demo, the Vitest suite, a serverless API route, and (later) a browser
 * bundle that shows a customer the proposal they are approving. Importing
 * `node:crypto` would break the browser case and make the boundary
 * runtime-dependent. This implementation has no imports beyond TextEncoder,
 * which exists in Node >= 11 and in every modern browser.
 *
 * `fingerprint.test.js` verifies this implementation against `node:crypto`
 * over the FIPS test vectors, the golden proposal, and random inputs.
 */

const K = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;

/**
 * SHA-256 (FIPS 180-4) over a UTF-8 string. Returns lower-case hex.
 * @param {string} message
 * @returns {string}
 */
export function sha256Hex(message) {
  if (typeof message !== "string") throw new TypeError("sha256Hex expects a string.");
  const input = new TextEncoder().encode(message);

  // Padding: 0x80, then zeros, then the 64-bit big-endian bit length.
  const bitLength = input.length * 8;
  // Minimal multiple of 64 that holds the message, the 0x80 byte and the
  // 8-byte length: 64 * ceil((len + 9) / 64) === ((len + 72) >> 6) << 6.
  const paddedLength = ((input.length + 72) >> 6) << 6;
  const buffer = new Uint8Array(paddedLength);
  buffer.set(input);
  buffer[input.length] = 0x80;
  // JS numbers hold the bit length exactly for any string we can allocate.
  const view = new DataView(buffer.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i += 1) {
      const s0 = (rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)) >>> 0;
      const s1 = (rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let i = 0; i < 64; i += 1) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;

      h = g; g = f; f = e;
      e = (d + temp1) >>> 0;
      d = c; c = b; b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => x.toString(16).padStart(8, "0")).join("");
}

export const FINGERPRINT_ALGORITHM = "fs256:sha256(serializeCanonicalJson(furnispec))";
export const FINGERPRINT_PREFIX = "fs256:";

export function isFingerprint(value) {
  return typeof value === "string" && /^fs256:[0-9a-f]{64}$/.test(value);
}
