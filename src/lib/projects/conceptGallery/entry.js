/**
 * Browser entry for the static Studio. Not wired into scripts/build-static.mjs
 * (CraZy Integration owns that); see docs/m3/projects/CONCEPT_GALLERY.md
 * §Bundle entry for the suggested IIFE lines (globalName "FurniConceptGallery").
 *
 * Ships the thin creative-jobs list client (createCreativeJobsClient) and the
 * adapter to Antigravity's page token helper (studioAccessToken). Asset Engineer's
 * source and viewer stay injected. Test/demo fakes are not part of the bundle.
 */
export * from "./index.js";
export const version = "concept-gallery/3-rev2";
