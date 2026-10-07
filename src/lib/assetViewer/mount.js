/**
 * Interim HOST interface (integration lead, 2026-10-07), until Antigravity
 * ships the real container. A thin wrapper over mountAssetViewer:
 *
 *   <script src="/vendor-three-r128.min.js"></script>        // window.THREE (r128), already on the site
 *   <script src="…/GLTFLoader.js"></script>                  // r128 examples global: THREE.GLTFLoader
 *   <script src="…/OrbitControls.js"></script>               // r128 examples global: THREE.OrbitControls
 *   <script src="/asset-viewer.js"></script>                 // window.FurniAssetViewer (this module, no three inside)
 *   const handle = FurniAssetViewer.mount(containerEl, { THREE: window.THREE, asset: { url } });
 *   …on navigation / unmount: handle.dispose();             // idempotent
 *
 * - `THREE` (required) is mapped to mountAssetViewer's `three`. The module
 *   never imports three and never reads a THREE global itself.
 * - GLTFLoader / OrbitControls / RoomEnvironment come from THREE.GLTFLoader /
 *   THREE.OrbitControls / THREE.RoomEnvironment (the r128 examples/js globals)
 *   unless the host passes `deps` or top-level classes explicitly.
 * - Defaults that differ from mountAssetViewer: `downloadButton: "always"` (the
 *   viewer's own Download button is offered whenever a valid asset is held).
 * - Safety nets stay on: `signal` (AbortSignal) and window "pagehide" dispose too.
 * Every other option is passed through (asset, creativeSource, onError, ui, …).
 */
import { mountAssetViewer } from "./mountAssetViewer.js";

const LOADER_KEYS = ["GLTFLoader", "OrbitControls", "RoomEnvironment"];

export function mount(containerEl, options = {}) {
  const { THREE, deps, ...rest } = options || {};
  if (!THREE || typeof THREE !== "object" || typeof THREE.Scene !== "function") {
    const e = new TypeError(
      "FurniAssetViewer.mount(containerEl, { THREE }): THREE is missing or is not a three.js namespace. Pass the page's global three.js (window.THREE, r128); the viewer never imports or bundles three.",
    );
    e.code = "MISSING_DEPENDENCY";
    throw e;
  }
  const picked = {};
  for (const k of LOADER_KEYS) {
    const cls = (deps && deps[k]) || rest[k] || THREE[k];
    if (typeof cls === "function") picked[k] = cls;
  }
  return mountAssetViewer(containerEl, { downloadButton: "always", ...rest, three: THREE, deps: picked });
}
