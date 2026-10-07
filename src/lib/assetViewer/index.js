/**
 * Generated-model asset viewer (framework-free). See
 * docs/m3/asset-viewer/ASSET_VIEWER.md. Nothing here imports "three".
 */
export { mountAssetViewer, STATUS, EVENTS, KNOWN_UNSUPPORTED_EXTENSIONS, defaultCreateRenderer } from "./mountAssetViewer.js";
export { mountAssetViewer as createAssetViewer } from "./mountAssetViewer.js";
export { mount } from "./mount.js";
export { ERROR_CODE, ERROR_MESSAGE, FETCH_FAILED_MESSAGE, INVALID_FILE_MESSAGE, AssetViewerError, isViewerError, toErrorRecord } from "./errors.js";
export { invalidFileReason } from "./validate.js";
export { createAdapterRegistry, validateAdapter } from "./adapters/registry.js";
export { glbAdapter, gltfJsonAdapter, DEFAULT_ADAPTERS, isGlbBytes, isGltfJsonBytes } from "./adapters/gltf.js";
export { normalizeAsset, downloadFilename, filenameFromUrl, extensionOf } from "./descriptor.js";
export { computeFit, DEFAULT_VIEW_DIRECTION } from "./fit.js";
export { describeScale, relativeProportions, RELATIVE_SCALE_LABEL } from "./scale.js";
export { disposeObject3D, collectResources } from "./dispose.js";
export { markTextureSRGB, isTextureSRGB, configureRendererOutput, SRGB_TEXTURE_SLOTS } from "./colorSpace.js";
export { DEFAULT_MAX_BYTES } from "./fetchBytes.js";
export {
  createCreativeAssetSource,
  mapCreativeError,
  isRetryableResolveError,
  normalizeConcept,
  normalizeCreativeFormat,
  isViewableFormat,
  creativeFilename,
  safeJobMessage,
  redactUrls,
  CREATIVE_FORMATS,
  VIEWABLE_FORMATS,
  MIME_BY_FORMAT,
  DEFAULT_CONCEPT_NOTICE,
  DEFAULT_CREATIVE_BASE_URL,
  BILLING_OUTCOMES,
  describeBillingOutcome,
  normalizeBilling,
  describeReferenceValidation,
  retryDelayForResolveError,
  RATE_LIMIT_RETRY_DELAY_MS,
} from "./creativeAsset.js";
export { downloadOnlyText, VISUAL_CONCEPT_LABEL, DEMO_ASSET_LABEL, KEYBOARD_HELP, VIEW_CONTROLS } from "./overlay.js";
export { TOKENS, SCENE } from "./tokens.js";
