/**
 * Collector so the root `npx vitest run` (whose include list is
 * Integration-owned and does not cover tests/projects/**) runs the
 * concept-gallery suites. Same pattern as src/lib/assetViewer/assetViewer.collect.test.js.
 * The suites can also run alone:
 *
 *   npx vitest run --config tests/projects/vitest.config.js
 *
 * Every hook in these files is scoped inside a describe(), so fake timers and
 * the contract test's fetch stub don't leak across suites here.
 *
 * DELETE THIS FILE in the same integration commit that adds
 *   "tests/projects/**\/*.test.js",
 * to the root vitest.config.js include list, or every suite would run twice
 * (see docs/m3/projects/CONCEPT_GALLERY.md, "Running the tests").
 */
import "../../../../tests/projects/state.test.js";
import "../../../../tests/projects/gallery.test.js";
import "../../../../tests/projects/polling.test.js";
import "../../../../tests/projects/assets.test.js";
import "../../../../tests/projects/viewer.test.js";
import "../../../../tests/projects/assetFailures.test.js";
import "../../../../tests/projects/fixtureShape.test.js";
import "../../../../tests/projects/creativeContract.test.js";
