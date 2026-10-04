/**
 * Collector so the root `npx vitest run` (whose include list is
 * Integration-owned and does not cover tests/projects/**) runs the
 * concept-gallery suites. Same pattern as src/lib/assetViewer/assetViewer.collect.test.js.
 * The suites can also run alone:
 *
 *   npx vitest run --config tests/projects/vitest.config.js
 *
 * DELETE THIS FILE if "tests/projects/**\/*.test.js" is ever added to the
 * root vitest.config.js include list, or every suite would run twice.
 */
import "../../../../tests/projects/state.test.js";
import "../../../../tests/projects/gallery.test.js";
import "../../../../tests/projects/polling.test.js";
import "../../../../tests/projects/assets.test.js";
import "../../../../tests/projects/fixtureShape.test.js";
