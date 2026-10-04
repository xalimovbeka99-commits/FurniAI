/**
 * DEMO-ONLY: builds an ES module exporting GLTFLoader / OrbitControls /
 * RoomEnvironment from three-stdlib (already in node_modules as a
 * transitive dependency of @react-three/drei) with every `import ... from
 * "three"` rewired to the page's existing window.THREE (r128 from
 * vendor-three-r128.min.js). This proves the viewer core works when the
 * static Studio supplies r128-compatible loader classes. Two r128 gaps in
 * three-stdlib 2.36.1 had to be shimmed (LoaderUtils.resolveURL and
 * Texture.userData), which is exactly why the real page should load
 * loaders built FOR r128 (three@0.128.0 examples/js) instead. It is NOT a
 * proposal to ship this exact file: which r128-compatible GLTFLoader /
 * OrbitControls the page loads is an open question for Antigravity /
 * Integration (see ASSET_VIEWER.md).
 */
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function buildR128Compat() {
  const entry = `
    export { GLTFLoader } from "./node_modules/three-stdlib/loaders/GLTFLoader.js";
    export { OrbitControls } from "./node_modules/three-stdlib/controls/OrbitControls.js";
    export { RoomEnvironment } from "./node_modules/three-stdlib/environments/RoomEnvironment.js";
  `;
  const out = await build({
    stdin: { contents: entry, resolveDir: process.cwd(), loader: "js" },
    bundle: true,
    format: "esm",
    write: false,
    logLevel: "silent",
    plugins: [
      {
        name: "three-from-window",
        setup(b) {
          b.onResolve({ filter: /^three$/ }, () => ({ path: "three", namespace: "window-three" }));
          b.onLoad({ filter: /.*/, namespace: "window-three" }, () => ({
            // three-stdlib 2.36's GLTFLoader calls LoaderUtils.resolveURL, added in
            // three r130; r128 lacks it, so embedded textures fail without this
            // polyfill (see ASSET_VIEWER.md). window.THREE itself is NOT modified.
            contents: `
              const T = window.THREE;
              const resolveURL = (url, path) => {
                if (typeof url !== "string" || url === "") return "";
                if (/^https?:\\/\\//i.test(path) && /^\\//.test(url)) path = path.replace(/(^https?:\\/\\/[^\\/]+).*/i, "$1");
                if (/^(https?:)?\\/\\//i.test(url)) return url;
                if (/^data:.*,.*$/i.test(url)) return url;
                if (/^blob:.*$/i.test(url)) return url;
                return path + url;
              };
              const LoaderUtils = { decodeText: T.LoaderUtils.decodeText, extractUrlBase: T.LoaderUtils.extractUrlBase, resolveURL: T.LoaderUtils.resolveURL || resolveURL };
              // r128 Texture has no .userData (added ~r134); three-stdlib's GLTFLoader writes
              // texture.userData.mimeType. A subclass visible ONLY to these loaders fixes it.
              class Texture extends T.Texture {
                constructor(...args) {
                  super(...args);
                  if (!this.userData) this.userData = {};
                }
              }
              module.exports = Object.assign({}, T, { LoaderUtils, Texture });
            `,
            loader: "js",
          }));
        },
      },
    ],
  });
  return out.outputFiles[0].text;
}

export const threeStdlibVersion = JSON.parse(readFileSync(join(process.cwd(), "node_modules/three-stdlib/package.json"), "utf8")).version;
