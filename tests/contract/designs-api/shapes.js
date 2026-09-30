/**
 * Response key sets the My Designs module relies on, as returned by the real
 * api/designs/* handlers (src/lib/persistence/designService.js + errors.js).
 * Pinned by designsApi.contract.test.js; the module's fake client is checked
 * against the same constants in src/lib/designs/myDesigns/mountMyDesigns.test.js.
 * Sorted, so tests can compare with Object.keys(x).sort().
 */
export const LIST_BODY_KEYS = ["designs", "ok"];
export const DESIGN_LIST_ITEM_KEYS = ["createdAt", "designId", "name", "ownerUserId", "updatedAt"];
export const GET_DESIGN_BODY_KEYS = ["design", "latestRevision", "ok"];
export const DESIGN_SUMMARY_KEYS = ["createdAt", "designId", "name", "ownerUserId", "updatedAt"];
export const LATEST_REVISION_KEYS = ["createdAt", "fingerprint", "revision", "specId", "validationStatus"];
export const REVISION_BODY_KEYS = [
  "createdAt",
  "designId",
  "fingerprint",
  "furniSpec",
  "ok",
  "origins",
  "partGraph",
  "revision",
  "validationStatus",
];
export const ERROR_BODY_KEYS = ["code", "error", "ok"];
export const ERROR_BODY_KEYS_WITH_DETAILS = ["code", "details", "error", "ok"];
