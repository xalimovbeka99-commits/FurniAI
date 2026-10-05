/**
 * Browser entry for the static Studio. Not wired into scripts/build-static.mjs
 * (CraZy Integration owns that); see docs/m3/projects/CONCEPT_GALLERY.md
 * §Bundle entry for the suggested IIFE lines (globalName "FurniConceptGallery").
 *
 * Imports no creative client: none ships with the backend at 7f42f956, and the
 * client is injected at mount time. Test/demo fakes are not part of the bundle.
 */
export * from "./index.js";
export const version = "concept-gallery/2";
