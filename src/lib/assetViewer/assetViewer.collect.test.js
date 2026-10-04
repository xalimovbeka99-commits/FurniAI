/**
 * Collector so the root `npx vitest run` (whose include list is
 * Integration-owned and does not cover tests/assetViewer/**) executes the
 * asset-viewer suites. The suites themselves live in tests/assetViewer/ and
 * can also be run alone:
 *
 *   npx vitest run --config tests/assetViewer/vitest.config.js
 *
 * DELETE THIS FILE if "tests/assetViewer/**\/*.test.js" is ever added to the
 * root vitest.config.js include list, or every suite would run twice.
 */
import "../../../tests/assetViewer/state.test.js";
import "../../../tests/assetViewer/errors.test.js";
import "../../../tests/assetViewer/supersede.test.js";
import "../../../tests/assetViewer/dispose.test.js";
import "../../../tests/assetViewer/fit.test.js";
import "../../../tests/assetViewer/scale.test.js";
import "../../../tests/assetViewer/download.test.js";
import "../../../tests/assetViewer/registry.test.js";
import "../../../tests/assetViewer/r128.test.js";
import "../../../tests/assetViewer/noBundledThree.test.js";
