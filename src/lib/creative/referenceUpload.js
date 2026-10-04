/**
 * Reference-image validation. Trusts the BYTES, not the declared type or the
 * file extension: the magic number decides.
 */
import { createHash } from "node:crypto";
import { CreativeError, CREATIVE_ERROR } from "./errors.js";

/**
 * Raw-byte ceiling. Vercel serverless functions refuse request bodies above
 * 4.5 MB; the reference travels as base64 inside JSON (x1.34), so 3 MB raw is
 * the largest that fits with headroom. Larger uploads need direct-to-storage
 * upload, which depends on the unresolved storage decision.
 */
export const MAX_REFERENCE_BYTES = 3 * 1024 * 1024;

const SIGNATURES = [
  { type: "image/png", ext: "png", test: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: "image/jpeg", ext: "jpg", test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/webp", ext: "webp", test: (b) => b.length > 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP" },
];

export const ACCEPTED_REFERENCE_TYPES = SIGNATURES.map((s) => s.type);

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * @param {{ name?: unknown, contentType?: unknown, dataBase64?: unknown }} body
 * @param {{ maxBytes?: number }} [opts]
 * @returns {{ name: string, contentType: string, bytes: number, sha256: string, buffer: Buffer }}
 */
export function validateReferenceUpload(body, opts = {}) {
  const maxBytes = opts.maxBytes ?? MAX_REFERENCE_BYTES;
  const raw = body?.dataBase64;
  if (typeof raw !== "string" || raw.length === 0) {
    throw new CreativeError(CREATIVE_ERROR.BAD_REQUEST, "dataBase64 is required.");
  }
  // Reject on encoded length BEFORE decoding, so an oversized body is not
  // decoded into memory just to be measured.
  if (raw.length > Math.ceil(maxBytes / 3) * 4 + 4) {
    throw new CreativeError(CREATIVE_ERROR.FILE_TOO_LARGE, `The reference image must be ${maxBytes} bytes or smaller.`, { details: { maxBytes } });
  }
  if (raw.length % 4 !== 0 || !BASE64_RE.test(raw)) {
    throw new CreativeError(CREATIVE_ERROR.BAD_REQUEST, "dataBase64 must be plain base64 (no data: prefix, no whitespace).");
  }
  const buffer = Buffer.from(raw, "base64");
  if (buffer.length === 0) throw new CreativeError(CREATIVE_ERROR.BAD_REQUEST, "The reference image is empty.");
  if (buffer.length > maxBytes) {
    throw new CreativeError(CREATIVE_ERROR.FILE_TOO_LARGE, `The reference image must be ${maxBytes} bytes or smaller.`, { details: { maxBytes, bytes: buffer.length } });
  }
  const sig = SIGNATURES.find((s) => s.test(buffer));
  if (!sig) {
    throw new CreativeError(CREATIVE_ERROR.UNSUPPORTED_FILE_TYPE, "The reference must be a PNG, JPEG or WebP image.", { details: { accepted: ACCEPTED_REFERENCE_TYPES } });
  }
  if (body.contentType != null && body.contentType !== sig.type && !(body.contentType === "image/jpg" && sig.type === "image/jpeg")) {
    throw new CreativeError(CREATIVE_ERROR.UNSUPPORTED_FILE_TYPE, "The file's content does not match its declared type.", { details: { declared: String(body.contentType).slice(0, 64), detected: sig.type } });
  }
  return {
    name: safeName(body.name, sig.ext),
    contentType: sig.type,
    bytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    buffer,
  };
}

function safeName(name, ext) {
  const base = (typeof name === "string" ? name : "")
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]*$/, "")
    .replace(/[^A-Za-z0-9 _-]/g, "")
    .trim()
    .slice(0, 80);
  return `${base || "reference"}.${ext}`;
}
