/**
 * Browser entry for the static Studio, mirroring src/lib/designs/myDesigns/entry.js:
 * an esbuild IIFE with globalName "FurniAssetViewer" would expose
 * window.FurniAssetViewer.mountAssetViewer(...). NOT wired into
 * scripts/build-static.mjs (Integration-owned); see ASSET_VIEWER.md §Bundling.
 *
 * The bundle contains NO three.js: THREE, GLTFLoader and OrbitControls are
 * injected by the page at mount time.
 *
 * v3: `mount(containerEl, { THREE, ...opts })` is the interim host interface
 * (mount.js). The /api/creative HTTP adapter (createCreativeAssetSource) is an
 * OPTIONAL separate bundle, entry.creative.js -> window.FurniAssetViewerCreative,
 * so a page that shows plain URLs carries no Scenario code. ES-module hosts
 * import everything from index.js.
 */
export { mount } from "./mount.js";
export { mountAssetViewer, STATUS, EVENTS } from "./mountAssetViewer.js";
export { ERROR_CODE, ERROR_MESSAGE } from "./errors.js";
export { createAdapterRegistry } from "./adapters/registry.js";
export { glbAdapter, gltfJsonAdapter, DEFAULT_ADAPTERS } from "./adapters/gltf.js";
export { RELATIVE_SCALE_LABEL } from "./scale.js";
export { isRetryableResolveError, normalizeConcept, VIEWABLE_FORMATS, DEFAULT_CONCEPT_NOTICE } from "./creativeAsset.js";
export { VISUAL_CONCEPT_LABEL, DEMO_ASSET_LABEL } from "./overlay.js";
export const version = "asset-viewer-module/3";
