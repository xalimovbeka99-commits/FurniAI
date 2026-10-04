/**
 * Mounts the real viewer core against real three.js (node_modules, 0.166)
 * scene-graph classes + the real GLTFLoader, with only the GPU (renderer)
 * and pointer-driven OrbitControls replaced by honest fakes.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mountAssetViewer } from "../../../src/lib/assetViewer/index.js";
import { createFakeDocument } from "./fakeDom.js";
import { createFakeOrbitControlsClass, createFakeRenderer } from "./fakeRenderer.js";

export { THREE, GLTFLoader };

export function mountForTest(opts = {}) {
  const { doc, win, container } = createFakeDocument({ width: opts.width, height: opts.height, raf: opts.raf });
  const OrbitControls = createFakeOrbitControlsClass(THREE);
  let renderer = null;
  const errors = [];
  const states = [];
  const viewer = mountAssetViewer(container, {
    three: opts.three || THREE,
    deps: opts.deps || { GLTFLoader, OrbitControls },
    createRenderer: opts.createRenderer || (() => (renderer = createFakeRenderer(doc))),
    onError: (e) => errors.push(e),
    ...(opts.options || {}),
  });
  viewer.on("statechange", (s) => states.push(s));
  return {
    viewer,
    doc,
    win,
    container,
    get renderer() {
      return renderer;
    },
    OrbitControls,
    errors,
    states,
    render() {
      const d = viewer._debug();
      if (d.renderer) d.renderer.render(d.scene, d.camera);
      return d.renderer ? d.renderer.info.memory : null;
    },
  };
}
