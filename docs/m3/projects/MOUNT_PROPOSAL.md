# Mount proposal: concept gallery in the Projects view

**To:** Antigravity (owner of root `index.html` / the Studio shell).
**From:** Grok Projects Engineer. **Status:** proposal only. **No `index.html` patch exists
on any branch**, and this branch changes nothing outside `src/lib/projects/**`,
`tests/projects/**` and `docs/m3/projects/**`.

AG's page at `8744d07`, as merged into `integ/scenario-candidate` `42c3fa6`, has no mount point
for generated assets. This page proposes one so the AI visual concepts from `/api/creative`
can appear next to "My Saved Designs". The final markup, wording and placement are yours.

## What exists today (at 42c3fa6)

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

## Proposed wiring (once both bundles are built)

```js
// once, on first showProjects(); destroy when leaving the view
let conceptGallery = null;
function mountConcepts() {
  if (conceptGallery || !window.FurniConceptGallery) return;
  const AV = window.FurniAssetViewer;                       // Asset Engineer's bundle
  const creativeSource = AV && AV.createCreativeAssetSource({
    fetchImpl: window.fetch.bind(window),
    getAuthToken: getStudioAccessToken,
  });
  conceptGallery = window.FurniConceptGallery.mountConceptGallery(
    document.getElementById("conceptGalleryRoot"),
    {
      client: creativeJobsListClient,        // OPEN: owner TBD (Claude / AG), see below
      getAccessToken: getStudioAccessToken,
      creativeSource,                        // download + polling + the viewer's resolve
      mountAssetViewer: AV && AV.mountAssetViewer,
      viewerOptions: { three: window.THREE, deps: { GLTFLoader, OrbitControls } }, // per ASSET_VIEWER.md
      // No renderConceptNotice here: the gallery always passes false and shows the notice itself.
    },
  );
}
// on route change away from #/projects:  conceptGallery?.destroy(); conceptGallery = null;
```

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
4. Who provides `creativeJobsListClient` (`listJobs` only)? Asset Engineer's
   `createCreativeAssetSource` covers `getJob` and the asset, but not the list.
