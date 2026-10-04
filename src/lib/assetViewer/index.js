/**
 * Generated-model asset viewer (framework-free). See
 * docs/m3/asset-viewer/ASSET_VIEWER.md. Nothing here imports "three".
 */
export { mountAssetViewer, STATUS, EVENTS, KNOWN_UNSUPPORTED_EXTENSIONS } from "./mountAssetViewer.js";
export { mountAssetViewer as createAssetViewer } from "./mountAssetViewer.js";
export { ERROR_CODE, ERROR_MESSAGE, AssetViewerError, toErrorRecord } from "./errors.js";
export { createAdapterRegistry, validateAdapter } from "./adapters/registry.js";
export { glbAdapter, gltfJsonAdapter, DEFAULT_ADAPTERS, isGlbBytes, isGltfJsonBytes } from "./adapters/gltf.js";
export { normalizeAsset, downloadFilename, filenameFromUrl, extensionOf } from "./descriptor.js";
export { computeFit, DEFAULT_VIEW_DIRECTION } from "./fit.js";
export { describeScale, relativeProportions, RELATIVE_SCALE_LABEL } from "./scale.js";
export { disposeObject3D, collectResources } from "./dispose.js";
export { markTextureSRGB, isTextureSRGB, configureRendererOutput, SRGB_TEXTURE_SLOTS } from "./colorSpace.js";
export { DEFAULT_MAX_BYTES } from "./fetchBytes.js";
