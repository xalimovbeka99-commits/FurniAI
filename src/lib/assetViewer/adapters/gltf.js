/**
 * glTF 2.0 adapters (binary .glb and JSON .gltf with embedded/data-URI or
 * resourcePath-relative buffers). Both use the INJECTED GLTFLoader class:
 * three/examples/jsm (r15x+) or an r128-compatible build supplied by the
 * page (e.g. three-stdlib's GLTFLoader). Nothing is imported from three.
 */
const GLB_MAGIC = [0x67, 0x6c, 0x54, 0x46]; // "glTF"

export function isGlbBytes(bytes) {
  return bytes && bytes.length >= 12 && GLB_MAGIC.every((b, i) => bytes[i] === b);
}

export function isGltfJsonBytes(bytes) {
  if (!bytes || bytes.length < 2) return false;
  let i = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) i = 3; // UTF-8 BOM
  while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x0a || bytes[i] === 0x0d || bytes[i] === 0x09)) i++;
  if (bytes[i] !== 0x7b) return false; // "{"
  const head = new TextDecoder().decode(bytes.subarray(i, Math.min(bytes.length, i + 8192)));
  return /"asset"\s*:/.test(head);
}

function parseWithGltfLoader(arrayBuffer, { deps, resourcePath }) {
  const Loader = deps && deps.GLTFLoader;
  return new Promise((resolve, reject) => {
    let loader;
    try {
      loader = new Loader();
    } catch (e) {
      reject(e);
      return;
    }
    try {
      loader.parse(
        arrayBuffer,
        resourcePath || "",
        (gltf) => {
          const root = (gltf && (gltf.scene || (gltf.scenes && gltf.scenes[0]))) || null;
          resolve({
            root,
            info: { animations: gltf && gltf.animations ? gltf.animations.length : 0 },
          });
        },
        (err) => reject(err instanceof Error ? err : new Error(String(err && err.message ? err.message : err))),
      );
    } catch (e) {
      reject(e);
    }
  });
}

export const glbAdapter = Object.freeze({
  id: "glb",
  label: "glTF 2.0 binary (GLB)",
  mime: "model/gltf-binary",
  mimes: ["model/gltf-binary", "model/glb"],
  extensions: ["glb"],
  requires: ["GLTFLoader"],
  sniff: isGlbBytes,
  load: parseWithGltfLoader,
});

export const gltfJsonAdapter = Object.freeze({
  id: "gltf",
  label: "glTF 2.0 JSON",
  mime: "model/gltf+json",
  mimes: ["model/gltf+json"],
  extensions: ["gltf"],
  requires: ["GLTFLoader"],
  sniff: isGltfJsonBytes,
  load: parseWithGltfLoader,
});

export const DEFAULT_ADAPTERS = Object.freeze([glbAdapter, gltfJsonAdapter]);
