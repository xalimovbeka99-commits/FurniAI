/**
 * OPTIONAL /api/creative (Scenario-backed AI visual concept) adapter, as its
 * own browser bundle: esbuild IIFE, globalName "FurniAssetViewerCreative".
 * The core viewer bundle (entry.js) works with a plain URL / ArrayBuffer /
 * Blob or any object with resolve(jobId, index); it does not contain this
 * HTTP adapter. Errors thrown here are recognised by the viewer bundle
 * (isViewerError is duck-typed), so the two bundles can be loaded separately.
 */
export {
  createCreativeAssetSource,
  isRetryableResolveError,
  retryDelayForResolveError,
  RATE_LIMIT_RETRY_DELAY_MS,
  mapCreativeError,
  normalizeConcept,
  normalizeBilling,
  describeBillingOutcome,
  describeReferenceValidation,
  BILLING_OUTCOMES,
  DEFAULT_CONCEPT_NOTICE,
  VIEWABLE_FORMATS,
} from "./creativeAsset.js";
export const version = "asset-viewer-creative/3";
