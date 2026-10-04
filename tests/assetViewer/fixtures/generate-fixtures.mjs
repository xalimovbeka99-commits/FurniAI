#!/usr/bin/env node
/**
 * Procedurally generates the asset-viewer test fixtures (no downloads, no
 * paid APIs, no three.js exporter): hand-built glTF 2.0 JSON + binary
 * buffers, and a hand-encoded PNG (node:zlib only).
 *
 *   node tests/assetViewer/fixtures/generate-fixtures.mjs
 *
 * Outputs (next to this script):
 *   chair-textured.glb   chair made of 6 boxes, embedded PNG baseColor texture
 *   table-untextured.glb table made of 5 boxes, two baseColorFactor materials
 *   corrupt.glb          valid GLB magic/header, truncated garbage chunk
 *   empty-scene.gltf     valid glTF JSON whose scene has no nodes
 *   simulated-download-only.fbx
 *                        NOT an FBX: a labelled text placeholder used to exercise the
 *                        /api/creative "download-only" path (the viewer never parses it)
 *
 * Geometry is in arbitrary model units on purpose: generated models carry
 * no verified metric scale, and the viewer must not pretend they do.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const OUT = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- PNG ---
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
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** 64x64 RGB "wood" texture: warm stripes with a darker grain + a checker accent. */
export function makeWoodPng(size = 64) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const grain = Math.sin((x + Math.sin(y * 0.35) * 3) * 0.9) * 0.5 + 0.5;
      const ring = (Math.floor(y / 8) + Math.floor(x / 8)) % 2 === 0 ? 1 : 0.88;
      const r = Math.round((150 + grain * 60) * ring);
      const g = Math.round((95 + grain * 40) * ring);
      const b = Math.round((50 + grain * 20) * ring);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------- unit cube ---
/** 24-vertex unit cube centred at the origin with per-face normals and UVs. */
function unitCube() {
  const faces = [
    { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
    { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
  ];
  const pos = [];
  const nrm = [];
  const uv = [];
  const idx = [];
  faces.forEach((f, i) => {
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    for (const [a, b] of corners) {
      pos.push(
        0.5 * (f.n[0] + a * f.u[0] + b * f.v[0]),
        0.5 * (f.n[1] + a * f.u[1] + b * f.v[1]),
        0.5 * (f.n[2] + a * f.u[2] + b * f.v[2]),
      );
      nrm.push(...f.n);
      uv.push((a + 1) / 2, 1 - (b + 1) / 2);
    }
    const o = i * 4;
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  return {
    positions: new Float32Array(pos),
    normals: new Float32Array(nrm),
    uvs: new Float32Array(uv),
    indices: new Uint16Array(idx),
  };
}

const pad4 = (n) => (n + 3) & ~3;

/**
 * Builds a GLB from a list of boxes {name, t:[x,y,z], s:[x,y,z], material}.
 * All boxes share one cube mesh per material.
 */
function buildBoxGlb({ boxes, materials, png, generator }) {
  const cube = unitCube();
  const parts = [];
  let offset = 0;
  const bufferViews = [];
  const addView = (bytes, target) => {
    const start = pad4(offset);
    if (start > offset) parts.push(Buffer.alloc(start - offset));
    parts.push(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    const view = { buffer: 0, byteOffset: start, byteLength: bytes.byteLength };
    if (target) view.target = target;
    bufferViews.push(view);
    offset = start + bytes.byteLength;
    return bufferViews.length - 1;
  };
  const vPos = addView(cube.positions, 34962);
  const vNrm = addView(cube.normals, 34962);
  const vUv = addView(cube.uvs, 34962);
  const vIdx = addView(cube.indices, 34963);
  const vImg = png ? addView(png) : null;
  const total = pad4(offset);
  if (total > offset) parts.push(Buffer.alloc(total - offset));
  const bin = Buffer.concat(parts);

  const accessors = [
    { bufferView: vPos, componentType: 5126, count: 24, type: "VEC3", min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
    { bufferView: vNrm, componentType: 5126, count: 24, type: "VEC3" },
    { bufferView: vUv, componentType: 5126, count: 24, type: "VEC2" },
    { bufferView: vIdx, componentType: 5123, count: 36, type: "SCALAR" },
  ];
  const meshes = materials.map((m, i) => ({
    name: `cube_${m.name}`,
    primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: i }],
  }));
  const nodes = boxes.map((b) => ({
    name: b.name,
    mesh: materials.findIndex((m) => m.name === b.material),
    translation: b.t,
    scale: b.s,
  }));
  nodes.push({ name: "root", children: boxes.map((_, i) => i) });
  const gltf = {
    asset: { version: "2.0", generator },
    scene: 0,
    scenes: [{ name: "Scene", nodes: [nodes.length - 1] }],
    nodes,
    meshes,
    materials: materials.map((m) => m.def),
    accessors,
    bufferViews,
    buffers: [{ byteLength: bin.length }],
  };
  if (png) {
    gltf.images = [{ bufferView: vImg, mimeType: "image/png", name: "wood" }];
    gltf.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
    gltf.textures = [{ sampler: 0, source: 0 }];
  }
  return encodeGlb(gltf, bin);
}

export function encodeGlb(gltf, bin) {
  let json = Buffer.from(JSON.stringify(gltf), "utf8");
  const jsonPad = pad4(json.length) - json.length;
  json = Buffer.concat([json, Buffer.alloc(jsonPad, 0x20)]);
  const chunks = [chunkHeader(json.length, 0x4e4f534a), json];
  if (bin) chunks.push(chunkHeader(bin.length, 0x004e4942), bin);
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // "glTF"
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + body.length, 8);
  return Buffer.concat([header, body]);
}
function chunkHeader(length, type) {
  const h = Buffer.alloc(8);
  h.writeUInt32LE(length, 0);
  h.writeUInt32LE(type, 4);
  return h;
}

// ------------------------------------------------------------ models ---
const GEN = "FurniAI asset-viewer fixture generator (procedural, not a real product)";

export function chairTexturedGlb() {
  const leg = (name, x, z) => ({ name, t: [x, 0.225, z], s: [0.05, 0.45, 0.05], material: "wood" });
  return buildBoxGlb({
    generator: GEN,
    png: makeWoodPng(),
    materials: [
      {
        name: "wood",
        def: {
          name: "wood",
          pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.7 },
        },
      },
    ],
    boxes: [
      leg("leg_fl", -0.2, 0.2),
      leg("leg_fr", 0.2, 0.2),
      leg("leg_bl", -0.2, -0.2),
      leg("leg_br", 0.2, -0.2),
      { name: "seat", t: [0, 0.47, 0], s: [0.46, 0.04, 0.46], material: "wood" },
      { name: "back", t: [0, 0.75, -0.21], s: [0.46, 0.52, 0.04], material: "wood" },
    ],
  });
}

export function tableUntexturedGlb() {
  const leg = (name, x, z) => ({ name, t: [x, 0.36, z], s: [0.06, 0.72, 0.06], material: "frame" });
  return buildBoxGlb({
    generator: GEN,
    png: null,
    materials: [
      { name: "top", def: { name: "top", pbrMetallicRoughness: { baseColorFactor: [0.85, 0.82, 0.76, 1], metallicFactor: 0, roughnessFactor: 0.5 } } },
      { name: "frame", def: { name: "frame", pbrMetallicRoughness: { baseColorFactor: [0.12, 0.12, 0.13, 1], metallicFactor: 0.6, roughnessFactor: 0.4 } } },
    ],
    boxes: [
      leg("leg_fl", -0.55, 0.3),
      leg("leg_fr", 0.55, 0.3),
      leg("leg_bl", -0.55, -0.3),
      leg("leg_br", 0.55, -0.3),
      { name: "top", t: [0, 0.74, 0], s: [1.3, 0.04, 0.72], material: "top" },
    ],
  });
}

export function corruptGlb() {
  // Plausible header ("glTF", v2, wrong length) followed by a JSON chunk header
  // that claims more bytes than exist and a non-JSON payload.
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(4096, 8);
  header.writeUInt32LE(2048, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([header, Buffer.from("{\"asset\":{\"version\":\"2.0\"},\"scenes\":[{\"nod\u0000\u0001\u0002garbage", "utf8")]);
}

export function emptySceneGltf() {
  return Buffer.from(
    JSON.stringify({ asset: { version: "2.0", generator: GEN }, scene: 0, scenes: [{ name: "Empty", nodes: [] }] }, null, 2) + "\n",
    "utf8",
  );
}

export function simulatedDownloadOnlyFbx() {
  return Buffer.from(
    "; SIMULATED FIXTURE - not a real FBX file and not a Scenario output.\n" +
      "; FurniAI asset-viewer test placeholder for the download-only path (formats other than glb/gltf).\n",
    "utf8",
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const outputs = {
    "chair-textured.glb": chairTexturedGlb(),
    "table-untextured.glb": tableUntexturedGlb(),
    "corrupt.glb": corruptGlb(),
    "empty-scene.gltf": emptySceneGltf(),
    "simulated-download-only.fbx": simulatedDownloadOnlyFbx(),
  };
  for (const [name, bytes] of Object.entries(outputs)) {
    writeFileSync(join(OUT, name), bytes);
    console.log(`${name}\t${bytes.length} bytes`);
  }
}
