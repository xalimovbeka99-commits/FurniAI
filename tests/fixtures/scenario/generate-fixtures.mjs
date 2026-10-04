/**
 * Deterministic GLB fixtures for Scenario 3D acceptance tests (LOCAL, test-only).
 * Pure module: imported by tests/acceptance/scenario/api.acceptance.test.js, so it has
 * NO shebang and NO CLI code (a shebang + CRLF checkout breaks Vitest's loader). The CLI is
 *
 *   node tests/fixtures/scenario/generate-fixtures.cli.mjs          # (re)write the files
 *   node tests/fixtures/scenario/generate-fixtures.cli.mjs --check  # exit 1 if committed bytes differ
 *
 * No dependencies: a hand-written glTF 2.0 binary (GLB) writer and a PNG
 * encoder that uses STORED (uncompressed) deflate blocks, so the bytes do not
 * depend on the zlib version. Nothing here is a Scenario output — these are
 * stand-in files whose structure the test-side inspector checks.
 *
 * Files:
 *   textured-cube.glb      GOOD: 1 mesh (24 verts, 12 tris), POSITION min/max, 1 PNG texture
 *   truncated.glb          first 60% of the good file (declared length != actual)
 *   bad-magic.glb          good file with the magic changed to "GLTF"
 *   no-mesh.glb            valid GLB container, texture present, no meshes
 *   missing-texture.glb    texture points at image 0, but there are no images
 *   corrupt-texture.glb    image bytes do not start with a PNG/JPEG signature
 *   html-as.glb            an HTML error page saved with a .glb name (CDN expiry page)
 */

// ---------------------------------------------------------------- PNG ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function adler32(buf) {
  let a = 1, b = 0;
  for (const x of buf) { a = (a + x) % 65521; b = (b + a) % 65521; }
  return ((b << 16) | a) >>> 0;
}
function zlibStored(raw) {
  const parts = [Buffer.from([0x78, 0x01])];
  for (let off = 0; off < raw.length || off === 0; off += 65535) {
    const chunk = raw.subarray(off, off + 65535);
    const last = off + 65535 >= raw.length ? 1 : 0;
    const hdr = Buffer.alloc(5);
    hdr[0] = last;
    hdr.writeUInt16LE(chunk.length, 1);
    hdr.writeUInt16LE(~chunk.length & 0xffff, 3);
    parts.push(hdr, chunk);
    if (last) break;
  }
  const ad = Buffer.alloc(4);
  ad.writeUInt32BE(adler32(raw));
  parts.push(ad);
  return Buffer.concat(parts);
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA
  const rows = [];
  for (let y = 0; y < height; y++) rows.push(Buffer.from([0]), rgba.subarray(y * width * 4, (y + 1) * width * 4));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlibStored(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// --------------------------------------------------------------- cube ----
function cubeGeometry(size = 1) {
  const h = size / 2;
  // 6 faces × 4 verts: [normal, u-axis, v-axis]
  const faces = [
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  ];
  const pos = [], nor = [], uv = [], idx = [];
  faces.forEach(([n, u, v], f) => {
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [a, b] of corners) {
      pos.push(...[0, 1, 2].map((i) => (n[i] + a * u[i] + b * v[i]) * h));
      nor.push(...n);
      uv.push((a + 1) / 2, 1 - (b + 1) / 2);
    }
    const o = f * 4;
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), idx: new Uint16Array(idx) };
}

const pad4 = (n) => (n + 3) & ~3;
function padBuf(buf, fill) {
  const out = Buffer.alloc(pad4(buf.length), fill);
  buf.copy(out);
  return out;
}

export function assembleGlb(json, bin) {
  const jsonBuf = padBuf(Buffer.from(JSON.stringify(json), "utf8"), 0x20);
  const binBuf = bin ? padBuf(bin, 0x00) : null;
  const total = 12 + 8 + jsonBuf.length + (binBuf ? 8 + binBuf.length : 0);
  const header = Buffer.alloc(12);
  header.write("glTF", 0, "latin1");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(jsonBuf.length, 0);
  jh.writeUInt32LE(0x4e4f534a, 4); // JSON
  const parts = [header, jh, jsonBuf];
  if (binBuf) {
    const bh = Buffer.alloc(8);
    bh.writeUInt32LE(binBuf.length, 0);
    bh.writeUInt32LE(0x004e4942, 4); // BIN
    parts.push(bh, binBuf);
  }
  return Buffer.concat(parts);
}

function texturePixels() {
  // 4×4 checker, FurniAI-ish oak and walnut, opaque. Deterministic.
  const a = [196, 154, 108, 255], b = [92, 64, 51, 255];
  const px = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) px.push(...((x + y) % 2 ? b : a));
  return Buffer.from(px);
}

export function buildTexturedCube({ mesh = true, images = true, imageBytes } = {}) {
  const g = cubeGeometry(1);
  const png = imageBytes ?? encodePng(4, 4, texturePixels());
  const segs = [];
  let offset = 0;
  const views = [];
  const add = (buf, target) => {
    const padded = padBuf(Buffer.from(buf.buffer ? Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength) : buf), 0);
    views.push({ buffer: 0, byteOffset: offset, byteLength: buf.byteLength, ...(target ? { target } : {}) });
    segs.push(padded);
    offset += padded.length;
    return views.length - 1;
  };
  const vPos = add(g.pos, 34962), vNor = add(g.nor, 34962), vUv = add(g.uv, 34962), vIdx = add(g.idx, 34963), vImg = add(png);
  const bin = Buffer.concat(segs);
  const json = {
    asset: { version: "2.0", generator: "FurniAI scenario-acceptance fixture generator (deterministic, test-only)" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [mesh ? { name: "fixture-cube", mesh: 0 } : { name: "empty-node" }],
    ...(mesh ? {
      meshes: [{ name: "fixture-cube", primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    } : {}),
    materials: [{ name: "checker", pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 } }],
    samplers: [{ magFilter: 9728, minFilter: 9728 }],
    textures: [{ sampler: 0, source: 0 }],
    images: images ? [{ bufferView: vImg, mimeType: "image/png" }] : [],
    accessors: [
      { bufferView: vPos, componentType: 5126, count: 24, type: "VEC3", min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
      { bufferView: vNor, componentType: 5126, count: 24, type: "VEC3" },
      { bufferView: vUv, componentType: 5126, count: 24, type: "VEC2" },
      { bufferView: vIdx, componentType: 5123, count: 36, type: "SCALAR" },
    ],
    bufferViews: views,
    buffers: [{ byteLength: bin.length }],
  };
  return assembleGlb(json, bin);
}

export const HTML_EXPIRED_PAGE = Buffer.from(
  "<!DOCTYPE html><html><head><title>403 Forbidden</title></head><body><h1>Request has expired</h1><p>This is a test fixture, not a real CDN page.</p></body></html>\n",
  "utf8",
);

export function buildAllFixtures() {
  const good = buildTexturedCube();
  const badMagic = Buffer.from(good);
  badMagic.write("GLTF", 0, "latin1");
  const corruptPng = encodePng(4, 4, texturePixels());
  corruptPng.fill(0, 0, 8);
  return {
    "textured-cube.glb": good,
    "truncated.glb": good.subarray(0, Math.floor(good.length * 0.6)),
    "bad-magic.glb": badMagic,
    "no-mesh.glb": buildTexturedCube({ mesh: false }),
    "missing-texture.glb": buildTexturedCube({ images: false }),
    "corrupt-texture.glb": buildTexturedCube({ imageBytes: corruptPng }),
    "html-as.glb": HTML_EXPIRED_PAGE,
  };
}
