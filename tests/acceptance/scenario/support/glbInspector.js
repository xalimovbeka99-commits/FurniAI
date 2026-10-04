/**
 * Test-side GLB (glTF 2.0 binary) inspector — LOCAL, test-only, no deps.
 * Runs in Node and in the browser (Uint8Array/DataView/TextDecoder only).
 *
 * The point is to check the FILE that the download leg produced, not that a
 * button was clicked. A file passes only if ALL of these hold:
 *   header magic "glTF", version 2, declared length == actual length,
 *   chunk 0 is JSON and parses, chunk 1 is BIN and lies inside the file,
 *   asset.version "2.0", >= 1 mesh with a POSITION accessor (VEC3 float,
 *   count > 0) whose min/max bounding box exists AND matches the vertex data,
 *   >= 1 texture whose source image exists and whose bytes start with a PNG
 *   or JPEG signature.
 *
 * @param {Uint8Array|ArrayBuffer} input
 * @returns {{ ok: boolean, errors: string[], info: object }}
 */
export function inspectGlb(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const errors = [];
  const info = { byteLength: bytes.length };
  const fail = (code) => { errors.push(code); return { ok: false, errors, info }; };
  if (bytes.length < 12) return fail("TOO_SHORT");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  info.magic = magic;
  if (magic !== "glTF") {
    const head = new TextDecoder().decode(bytes.subarray(0, 64)).trimStart().toLowerCase();
    if (head.startsWith("<!doctype html") || head.startsWith("<html") || head.startsWith("<")) errors.push("LOOKS_LIKE_HTML");
    return fail("BAD_MAGIC");
  }
  info.version = dv.getUint32(4, true);
  if (info.version !== 2) return fail("BAD_VERSION");
  info.declaredLength = dv.getUint32(8, true);
  if (info.declaredLength !== bytes.length) return fail("LENGTH_MISMATCH");
  if (bytes.length < 20) return fail("NO_JSON_CHUNK");
  const jsonLen = dv.getUint32(12, true);
  const jsonType = dv.getUint32(16, true);
  if (jsonType !== 0x4e4f534a || 20 + jsonLen > bytes.length) return fail("JSON_CHUNK_INVALID");
  let json;
  try {
    json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLen)));
  } catch {
    return fail("JSON_CHUNK_UNPARSEABLE");
  }
  const binHeader = 20 + jsonLen;
  if (binHeader + 8 > bytes.length) return fail("NO_BIN_CHUNK");
  const binLen = dv.getUint32(binHeader, true);
  const binType = dv.getUint32(binHeader + 4, true);
  if (binType !== 0x004e4942) return fail("NO_BIN_CHUNK");
  if (binHeader + 8 + binLen > bytes.length) return fail("BIN_CHUNK_OUT_OF_RANGE");
  const bin = bytes.subarray(binHeader + 8, binHeader + 8 + binLen);
  info.binLength = binLen;
  if (json?.asset?.version !== "2.0") errors.push("ASSET_VERSION_NOT_2_0");

  const viewBytes = (viewIndex) => {
    const v = json.bufferViews?.[viewIndex];
    if (!v || (v.buffer ?? 0) !== 0) return null;
    const off = v.byteOffset ?? 0;
    if (off + v.byteLength > bin.length) return null;
    return bin.subarray(off, off + v.byteLength);
  };

  // --- mesh + bounding box
  const meshes = Array.isArray(json.meshes) ? json.meshes : [];
  info.meshCount = meshes.length;
  if (meshes.length === 0) errors.push("NO_MESH");
  let positionAccessor = null;
  for (const m of meshes) for (const p of m.primitives ?? []) if (positionAccessor === null && p.attributes?.POSITION !== undefined) positionAccessor = p.attributes.POSITION;
  if (meshes.length && positionAccessor === null) errors.push("NO_POSITION_ATTRIBUTE");
  if (positionAccessor !== null) {
    const acc = json.accessors?.[positionAccessor];
    if (!acc || !(acc.count > 0)) errors.push("POSITION_COUNT_ZERO");
    else if (acc.type !== "VEC3" || acc.componentType !== 5126) errors.push("POSITION_NOT_VEC3_FLOAT");
    else if (!Array.isArray(acc.min) || !Array.isArray(acc.max) || acc.min.length !== 3 || acc.max.length !== 3) errors.push("NO_BOUNDING_BOX");
    else {
      info.positionCount = acc.count;
      info.bbox = { min: acc.min, max: acc.max };
      const raw = viewBytes(acc.bufferView);
      const stride = json.bufferViews[acc.bufferView]?.byteStride ?? 12;
      const start = acc.byteOffset ?? 0;
      if (!raw || start + (acc.count - 1) * stride + 12 > raw.length) errors.push("POSITION_DATA_OUT_OF_RANGE");
      else {
        const pdv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
        const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < acc.count; i++) for (let c = 0; c < 3; c++) {
          const x = pdv.getFloat32(start + i * stride + c * 4, true);
          if (x < mn[c]) mn[c] = x;
          if (x > mx[c]) mx[c] = x;
        }
        const eps = 1e-5;
        if (mn.some((x, c) => Math.abs(x - acc.min[c]) > eps) || mx.some((x, c) => Math.abs(x - acc.max[c]) > eps)) errors.push("BOUNDING_BOX_MISMATCH");
        info.measuredBbox = { min: mn, max: mx };
        if (mx.some((x, c) => !(x - mn[c] > 0))) errors.push("DEGENERATE_BOUNDING_BOX");
      }
    }
  }

  // --- texture + image
  const textures = Array.isArray(json.textures) ? json.textures : [];
  const images = Array.isArray(json.images) ? json.images : [];
  info.textureCount = textures.length;
  info.imageCount = images.length;
  if (textures.length === 0) errors.push("NO_TEXTURE");
  if (images.length === 0) errors.push("NO_IMAGE");
  info.images = [];
  for (const t of textures) {
    const img = images[t.source];
    if (!img) { errors.push("TEXTURE_SOURCE_MISSING"); continue; }
    let data = null;
    if (img.bufferView !== undefined) data = viewBytes(img.bufferView);
    else if (typeof img.uri === "string" && img.uri.startsWith("data:")) {
      try { data = Uint8Array.from(atob(img.uri.split(",")[1] ?? ""), (ch) => ch.charCodeAt(0)); } catch { data = null; }
    } else { errors.push("IMAGE_EXTERNAL_UNSUPPORTED"); continue; }
    if (!data) { errors.push("IMAGE_DATA_OUT_OF_RANGE"); continue; }
    const isPng = data.length > 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => data[i] === b);
    const isJpeg = data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
    info.images.push({ mimeType: img.mimeType ?? null, detected: isPng ? "image/png" : isJpeg ? "image/jpeg" : null, bytes: data.length });
    if (!isPng && !isJpeg) errors.push("IMAGE_BAD_MAGIC");
  }
  return { ok: errors.length === 0, errors, info };
}
