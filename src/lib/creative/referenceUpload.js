/**
 * Reference-image validation. Trusts the BYTES, not the declared type or the
 * file extension. The type comes from the signature; the file is then
 * inspected structurally (imageInspect.js). Only non-interlaced PNG is fully
 * decoded here — see `validation` on the result.
 */
import { createHash } from "node:crypto";
import { CreativeError, CREATIVE_ERROR } from "./errors.js";
import { inspectImage, sniffImageType, ImageInspectError } from "./imageInspect.js";

/**
 * Raw-byte ceiling. Vercel serverless functions refuse request bodies above
 * 4.5 MB; the reference travels as base64 inside JSON (x1.34), so 3 MB raw is
 * the largest that fits with headroom. Larger uploads need direct-to-storage
 * upload, which depends on the unresolved storage decision.
 */
export const MAX_REFERENCE_BYTES = 3 * 1024 * 1024;

export const ACCEPTED_REFERENCE_TYPES = ["image/png", "image/jpeg", "image/webp"];

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * @param {{ name?: unknown, contentType?: unknown, dataBase64?: unknown }} body
 * @param {{ maxBytes?: number }} [opts]
 * @returns {{ name: string, contentType: string, bytes: number, sha256: string, width: number, height: number, validation: "decoded"|"structure", buffer: Buffer }}
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
  const sig = sniffImageType(buffer);
  if (!sig) {
    throw new CreativeError(CREATIVE_ERROR.UNSUPPORTED_FILE_TYPE, "The reference must be a PNG, JPEG or WebP image.", { details: { accepted: ACCEPTED_REFERENCE_TYPES } });
  }
  if (body.contentType != null && body.contentType !== sig.type && !(body.contentType === "image/jpg" && sig.type === "image/jpeg")) {
    throw new CreativeError(CREATIVE_ERROR.UNSUPPORTED_FILE_TYPE, "The file's content does not match its declared type.", { details: { declared: String(body.contentType).slice(0, 64), detected: sig.type } });
  }
  let info;
  try {
    info = inspectImage(buffer, sig.type);
  } catch (err) {
    if (!(err instanceof ImageInspectError)) throw err;
    throw new CreativeError(CREATIVE_ERROR.INVALID_IMAGE, `The reference image cannot be used: ${err.reason}.`, { details: { detected: sig.type } });
  }
  return {
    name: safeName(body.name, sig.ext),
    width: info.width,
    height: info.height,
    validation: info.validation,
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
