/**
 * Browser entry for the static Studio (pilot route: root index.html).
 *
 * Bundled as an IIFE with `globalName: "FurniMyDesigns"`, exactly like
 * partgraph-runtime-bridge.js / ai-designer-transport.js, so the page gets
 * `window.FurniMyDesigns.mountMyDesigns(...)`. See docs/m3/MY_DESIGNS_MODULE.md
 * §Bundling for the build-static.mjs lines (owned by CraZy Integration).
 *
 * Deliberately does NOT import a designs client: the client is Antigravity's
 * (src/lib/persistence/designsApiClient.js) and is injected at mount time.
 * The fake client used by tests and the demo is not part of this bundle.
 */
export { mountMyDesigns } from "./mountMyDesigns.js";
export { ERROR_KIND, LIST_STATUS, OPEN_STATUS } from "./state.js";
export const version = "my-designs-module/1";
