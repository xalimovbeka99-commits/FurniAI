# Mount proposal: concept gallery in the Projects view

**To:** Antigravity (owner of root `index.html` / the Studio shell).
**From:** Grok Projects Engineer. **Status:** proposal only. **No `index.html` patch exists
on any branch**, and this branch changes nothing outside `src/lib/projects/**`,
`tests/projects/**` and `docs/m3/projects/**`.

**Rev 2 check (7 Oct 2026, base `f472aef2e0ca`):** there is still **no agreed mount point**.
`index.html` at `f472aef` has no concept/asset-viewer section, no `#conceptGalleryRoot`, no
`concept-gallery.js` or asset-viewer script tag, and this branch does not change `index.html`
(`git diff f472aef -- index.html` is empty). The anchors below are unchanged at `f472aef`
(`showProjects` l.1548, `getStudioAccessToken` l.2930, `loadProjects` l.5070, `#view-projects`
l.5334, `#projectsGrid` l.5346).

AG's page at `8744d07`, as merged into `integ/scenario-candidate` `42c3fa6`, has no mount point
for generated assets. This page proposes one so the AI visual concepts from `/api/creative`
can appear next to "My Saved Designs". The final markup, wording and placement are yours.

## What exists today (at 42c3fa6, unchanged at f472aef)

- Route `#/projects` → `showProjects()` (about line 1548) unhides `#view-projects` (about line
  5334): `.projects-header-bar` ("My Saved Designs") plus `.projects-container > #projectsGrid`,
  filled by `loadProjects()` (about line 5070).
- `getStudioAccessToken()` (about line 2930) returns the Supabase access token, or
  `__TEST_ACCESS_TOKEN__`.
- Scripts loaded: `vendor-three-r128.min.js`, `vendor-supabase.min.js`, `designs-api-client.js`,
  and others. **None** for the asset viewer or the concept gallery yet. Neither bundle is in
  `scripts/build-static.mjs`, which is CraZy's (see CONCEPT_GALLERY.md §8).
- `src/styles/design-tokens.css` (your blob `17fc5a7`) is not linked from the page. The
  gallery's CSS falls back to the same values.

## Proposed markup (inside `#view-projects`, after `.projects-container`)

```html
<section class="projects-concepts" aria-label="AI 3D concepts">
  <div id="conceptGalleryRoot"></div>
</section>
```

Keeping it as a separate section, not mixed into `#projectsGrid`, is deliberate. Concepts
are **not** FurniAI designs: they have no designId, no dimensions and no builder reopen. The
contract also requires `concept.notice` wherever one appears. Separate sections keep the two
lists from being confused.

## Proposed wiring (rev 2, once both bundles are built)

```js
// once, on first showProjects(); destroy when leaving the view
let conceptGallery = null;
function mountConcepts() {
  const CG = window.FurniConceptGallery;
  if (conceptGallery || !CG) return;
  const AV = window.FurniAssetViewer;                        // Asset Engineer's bundle
  const fetchImpl = window.fetch.bind(window);
  const getAccessToken = () => CG.studioAccessToken(window); // delegates to AG's getStudioAccessToken
  conceptGallery = CG.mountConceptGallery(document.getElementById("conceptGalleryRoot"), {
    client: CG.createCreativeJobsClient({ fetchImpl }),      // listJobs / getJob / getConfig, no retry
    getAccessToken,
    creativeSource: AV && AV.createCreativeAssetSource({ fetchImpl, getAuthToken: getAccessToken }),
    mountAssetViewer: AV && AV.mountAssetViewer,
    viewerOptions: { three: window.THREE, deps: { GLTFLoader, OrbitControls } }, // per ASSET_VIEWER.md
    // optional: resolveReferenceThumbnail({ referenceId, jobId, signal }) -> url | null
  });
}
// on route change away from #/projects:  conceptGallery?.destroy(); conceptGallery = null;
```

The list client is no longer an open point: `createCreativeJobsClient` (thin, in
`src/lib/projects/conceptGallery/jobsClient.js`) covers `GET ?resource=jobs`, `jobs&jobId` and
`config`. It is **not** a fork of `DesignsApiClient`; if AG exports a generic authed request
(AG-1), the client can switch to it with no gallery change.

This needs Asset Engineer's bundle at **v2.1** (`b34e259`) or later: `renderConceptNotice`,
`FORBIDDEN` and `RESOLVE_MALFORMED` are v2.1.

The gallery stops polling by itself while the tab is hidden. `destroy()` stops it for good
and disposes the viewer.

## Open points for Antigravity

1. Should it sit below "My Saved Designs" or be a tab in the header bar? What should the
   heading text be? The gallery's default title is "3D concepts" (option `title`).
2. Will `design-tokens.css` be linked on the page, and are the `--status-*` save tokens right
   for job status?
3. The page has `GLTFLoader` and `OrbitControls`? r128 globals need the shim Asset Engineer
   documents in `docs/m3/asset-viewer/ASSET_VIEWER.md`.
4. ~~Who provides the list client?~~ Done: `FurniConceptGallery.createCreativeJobsClient`.
5. AG-1: could `designsApiClient` export a generic authed JSON request / `authHeaders`, so the
   jobs client reuses it instead of its own 30-line fetch wrapper?
6. AG-2: could the token helper be exposed under a stable name (e.g.
   `window.FurniAuth.getAccessToken`)? `studioAccessToken()` uses `getStudioAccessToken` today.
7. AG-3: please confirm the mount point (this section, or a tab) so it can be marked agreed.
