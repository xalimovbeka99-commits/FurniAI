/**
 * Structural inspection of an uploaded reference image, with no native
 * dependency (this runs inside a serverless function).
 *
 * WHAT EACH LEVEL PROVES — reported to the caller as `validation`:
 *
 *   "decoded"    PNG, non-interlaced: every chunk CRC verified, the IDAT stream
 *                inflated in full, its length equal to what the header's
 *                dimensions require, and every scanline filter byte legal.
 *                The pixel data is complete and readable.
 *   "structure"  JPEG, WebP, interlaced PNG: the container is well-formed, the
 *                dimensions were read from it and the end marker is present.
 *                The compressed pixel data was NOT decoded, so a file whose
 *                entropy-coded data is corrupt can still pass. The generation
 *                provider is the final decoder for these.
 *
 * Neither level says anything about what the picture shows.
 */
import { crc32, inflateSync } from "node:zlib";

export const MIN_IMAGE_SIDE = 16;
export const MAX_IMAGE_SIDE = 8192;
export const MAX_IMAGE_PIXELS = 40_000_000;

export class ImageInspectError extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}
const bad = (reason) => { throw new ImageInspectError(reason); };

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const PNG_DEPTHS = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };

/** @returns {{ type: "image/png"|"image/jpeg"|"image/webp", ext: string } | null} */
export function sniffImageType(b) {
  if (b.length >= 8 && b.subarray(0, 8).equals(PNG_SIG)) return { type: "image/png", ext: "png" };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (b.length >= 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return { type: "image/webp", ext: "webp" };
  return null;
}

/** @returns {{ width: number, height: number, validation: "decoded"|"structure" }} */
export function inspectImage(b, type) {
  const out = type === "image/png" ? inspectPng(b) : type === "image/jpeg" ? inspectJpeg(b) : inspectWebp(b);
  const { width, height } = out;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) bad("the image has no readable dimensions");
  if (width < MIN_IMAGE_SIDE || height < MIN_IMAGE_SIDE) bad(`the image is smaller than ${MIN_IMAGE_SIDE}×${MIN_IMAGE_SIDE} pixels`);
  if (width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE || width * height > MAX_IMAGE_PIXELS) bad(`the image is larger than ${MAX_IMAGE_SIDE} pixels on a side or ${MAX_IMAGE_PIXELS} pixels in total`);
  return out;
}

function inspectPng(b) {
  let off = 8;
  let ihdr = null;
  const idat = [];
  let sawEnd = false;
  while (off < b.length) {
    if (off + 12 > b.length) bad("the PNG is truncated");
    const len = b.readUInt32BE(off);
    const type = b.toString("latin1", off + 4, off + 8);
    const end = off + 12 + len;
    if (end > b.length) bad("the PNG is truncated");
    if (crc32(b.subarray(off + 4, off + 8 + len)) !== b.readUInt32BE(off + 8 + len)) bad(`the PNG is corrupt (${type} chunk checksum)`);
    const data = b.subarray(off + 8, off + 8 + len);
    if (!ihdr) {
      if (type !== "IHDR" || len !== 13) bad("the PNG has no header");
      ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], color: data[9], interlace: data[12] };
      if (!PNG_DEPTHS[ihdr.color]?.includes(ihdr.depth) || data[10] !== 0 || data[11] !== 0 || ihdr.interlace > 1) bad("the PNG header is invalid");
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      sawEnd = true;
      off = end;
      break;
    }
    off = end;
  }
  if (!ihdr) bad("the PNG has no header");
  if (!sawEnd) bad("the PNG is truncated (no end marker)");
  if (off !== b.length) bad("the file has data after the end of the PNG");
  if (idat.length === 0) bad("the PNG has no image data");
  const { width, height } = ihdr;
  if (width < 1 || height < 1 || width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE || width * height > MAX_IMAGE_PIXELS) return { width, height, validation: "structure" }; // rejected by the caller's bounds
  const rowBytes = Math.ceil((width * PNG_CHANNELS[ihdr.color] * ihdr.depth) / 8);
  const expected = height * (rowBytes + 1);
  let raw;
  try {
    raw = inflateSync(Buffer.concat(idat), { maxOutputLength: ihdr.interlace ? MAX_IMAGE_PIXELS * 8 + MAX_IMAGE_SIDE * 16 : expected + 1 });
  } catch {
    bad("the PNG image data cannot be decompressed");
  }
  if (ihdr.interlace) return { width, height, validation: "structure" };
  if (raw.length !== expected) bad("the PNG image data does not match its dimensions");
  for (let y = 0; y < height; y++) if (raw[y * (rowBytes + 1)] > 4) bad("the PNG image data is corrupt");
  return { width, height, validation: "decoded" };
}

function inspectJpeg(b) {
  let off = 2;
  let dims = null;
  let sos = -1;
  while (off + 4 <= b.length) {
    if (b[off] !== 0xff) bad("the JPEG is corrupt");
    let marker = b[off + 1];
    while (marker === 0xff && off + 2 < b.length) { off++; marker = b[off + 1]; }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { off += 2; continue; }
    if (marker === 0xd9) break;
    const len = b.readUInt16BE(off + 2);
    if (len < 2 || off + 2 + len > b.length) bad("the JPEG is truncated");
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (len < 8) bad("the JPEG is corrupt");
      dims = { height: b.readUInt16BE(off + 5), width: b.readUInt16BE(off + 7) };
    }
    if (marker === 0xda) { sos = off; break; }
    off += 2 + len;
  }
  if (!dims) bad("the JPEG has no frame header");
  if (sos < 0) bad("the JPEG has no image data");
  const eoi = b.lastIndexOf(Buffer.from([0xff, 0xd9]));
  if (eoi < sos) bad("the JPEG is truncated (no end marker)");
  return { ...dims, validation: "structure" };
}

function inspectWebp(b) {
  if (b.length < 30) bad("the WebP is truncated");
  const riff = b.readUInt32LE(4);
  if (riff + 8 > b.length) bad("the WebP is truncated");
  const chunk = b.toString("latin1", 12, 16);
  const size = b.readUInt32LE(16);
  if (20 + size > b.length) bad("the WebP is truncated");
  if (chunk === "VP8X") {
    return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3), validation: "structure" };
  }
  if (chunk === "VP8L") {
    if (b[20] !== 0x2f) bad("the WebP is corrupt");
    const bits = b.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff), validation: "structure" };
  }
  if (chunk === "VP8 ") {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) bad("the WebP is corrupt");
    return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff, validation: "structure" };
  }
  bad("the WebP has no image");
}
