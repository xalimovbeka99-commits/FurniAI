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

function skipMissingImages(parser) {
  return {
    name: "FURNI_skip_missing_images",
    loadTexture(i) {
      const j = parser.json;
      const t = j.textures && j.textures[i];
      return t && !t.extensions && !(j.images && j.images[t.source]) ? Promise.resolve(null) : null;
    },
  };
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
    // A texture whose image is absent (dangling "source") would make GLTFLoader throw
    // and lose the whole model; resolve it to "no texture" so the mesh still shows
    // and the viewer's TEXTURES_NOT_LOADED note tells the user honestly.
    if (loader.register) loader.register(skipMissingImages);
    try {
      loader.parse(
        arrayBuffer,
        resourcePath || "",
        (gltf) => {
          const root = (gltf && (gltf.scene || (gltf.scenes && gltf.scenes[0]))) || null;
          const extras = (gltf && gltf.userData) || {};
          const generator = (gltf && gltf.asset && gltf.asset.generator) || "";
          resolve({
            root,
            info: {
              animations: gltf && gltf.animations ? gltf.animations.length : 0,
              // GLTFLoader only console.errors a texture it cannot decode and returns
              // the model without it; the viewer turns this into a visible warning.
              declaredTextures: (gltf && gltf.parser && gltf.parser.json && gltf.parser.json.textures && gltf.parser.json.textures.length) || 0,
              // A file that labels itself synthetic (root extras.synthetic or asset.generator),
              // e.g. docs/creative/fixtures/SYNTHETIC-box-not-scenario-generated.glb.
              synthetic: extras.synthetic === true || /\bsynthetic\b/i.test(String(generator)),
            },
          });
        },
        (err) => reject(err instanceof Error ? err : new Error(String(err && err.message ? err.message : err))),
      );
    } catch (e) {
      reject(e);
    }
  });
}

export const glbAdapter = /* @__PURE__ */ Object.freeze({
  id: "glb",
  label: "glTF 2.0 binary (GLB)",
  mime: "model/gltf-binary",
  mimes: ["model/gltf-binary", "model/glb"],
  extensions: ["glb"],
  requires: ["GLTFLoader"],
  sniff: isGlbBytes,
  load: parseWithGltfLoader,
});

export const gltfJsonAdapter = /* @__PURE__ */ Object.freeze({
  id: "gltf",
  label: "glTF 2.0 JSON",
  mime: "model/gltf+json",
  mimes: ["model/gltf+json"],
  extensions: ["gltf"],
  requires: ["GLTFLoader"],
  sniff: isGltfJsonBytes,
  load: parseWithGltfLoader,
});

export const DEFAULT_ADAPTERS = /* @__PURE__ */ Object.freeze([glbAdapter, gltfJsonAdapter]);
