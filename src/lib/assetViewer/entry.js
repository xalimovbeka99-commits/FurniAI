/**
 * Browser entry for the static Studio, mirroring src/lib/designs/myDesigns/entry.js:
 * an esbuild IIFE with globalName "FurniAssetViewer" would expose
 * window.FurniAssetViewer.mountAssetViewer(...). NOT wired into
 * scripts/build-static.mjs (Integration-owned); see ASSET_VIEWER.md §Bundling.
 *
 * The bundle contains NO three.js: THREE, GLTFLoader and OrbitControls are
 * injected by the page at mount time.
 */
export { mountAssetViewer, STATUS, EVENTS } from "./mountAssetViewer.js";
export { ERROR_CODE, ERROR_MESSAGE } from "./errors.js";
export { createAdapterRegistry } from "./adapters/registry.js";
export { glbAdapter, gltfJsonAdapter, DEFAULT_ADAPTERS } from "./adapters/gltf.js";
export { RELATIVE_SCALE_LABEL } from "./scale.js";
export const version = "asset-viewer-module/1";
