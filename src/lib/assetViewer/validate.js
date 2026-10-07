/**
 * v3: names WHY a file is invalid, for an honest message (error.reason).
 * Only called after the loader already refused the bytes; it never decides
 * on its own that a file is bad. Byte checks only, no parsing.
 */
const GLB_MAGIC = 0x46546c67; // "glTF" little-endian

/** "html" | "bad-magic" | "truncated" | null */
export function invalidFileReason(bytes, adapterId) {
  if (!bytes || !bytes.byteLength) return "truncated";
  const u8 = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 512));
  let i = 0;
  if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) i = 3; // UTF-8 BOM
  while (i < u8.length && (u8[i] === 0x20 || u8[i] === 0x09 || u8[i] === 0x0a || u8[i] === 0x0d)) i++;
  if (u8[i] === 0x3c /* "<" */) return "html";
  if (adapterId !== "glb") return null;
  if (bytes.byteLength < 12) return "truncated";
  const v = new DataView(bytes, 0, 12);
  if (v.getUint32(0, true) !== GLB_MAGIC) return "bad-magic";
  const declared = v.getUint32(8, true);
  if (declared > bytes.byteLength) return "truncated";
  if (bytes.byteLength >= 20) {
    const chunk0 = new DataView(bytes, 12, 8).getUint32(0, true);
    if (20 + chunk0 > bytes.byteLength) return "truncated";
  }
  return null;
}
