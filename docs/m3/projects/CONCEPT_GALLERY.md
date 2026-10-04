# Concept gallery (Projects → 3D concepts)

**Owner:** Grok Projects Engineer. **Branch:** `grok/projects-assets`. It was rebased from `a29f47b`
onto `integ/scenario-candidate` `6d3f204`, then **merged** with `42c3fa6` (asset viewer v2).
**Code:** `src/lib/projects/conceptGallery/`. **Tests:** `tests/projects/`.
**Demo:** `docs/m3/projects/demo/` (FIXTURE DATA). **Mount proposal for AG:** [MOUNT_PROPOSAL.md](MOUNT_PROPOSAL.md).

The gallery lists the signed-in user's AI visual concepts from `GET /api/creative?resource=jobs`.
Each one shows its job id, a status badge with text, the created and updated dates, and
`concept.notice`. Asset addresses are resolved fresh on every open and download. The module is
framework-free and renders without `innerHTML`.

## 1. Contract used

The contract is `docs/creative/SCENARIO_3D_API_CONTRACT.md`, **status PROPOSED**. The box copy
`/workspace/scenario-review/SCENARIO_3D_API_CONTRACT.md` and the PC copy
`C:\Users\xalim\FurniAI-Grok-ScenarioReview-inputs\SCENARIO_3D_API_CONTRACT.md` are
**byte-identical** (SHA-256 `125d9892…5d39`, 14 315 bytes), and both match the file at
`7f42f956`. The handler on this branch's base, `api/creative.js` plus `src/lib/creative/*`, is
identical to Claude's `7f42f956`.

Fields the gallery reads (§2.4 job view): `jobId`, `status`, `provider`, `model`,
`sourceReferenceId`, `outputs[{index, format, mimeType}]`, `error{code, message}`, `createdAt`,
`updatedAt` and `concept`.

The gallery does not show anything the contract doesn't provide:
- no thumbnails (it shows a neutral placeholder tile instead)
- no prompt (the job view has none)
- no reference image (only `sourceReferenceId`, shown as an id)
- no dimensions
- no `designId` or design link

`providerProgress` is never rendered, and `providerStatus` is never rendered or branched on.
Both stay in `getState()` for diagnostics only.

## 2. What is injected

Asset Engineer's viewer v2 (`src/lib/assetViewer/` at `42c3fa6`) already does the asset and
job-status work, so the gallery **injects** it and does not reimplement it. The gallery module
imports nothing from `src/lib/assetViewer/`. Only tests and the demo import
`createCreativeAssetSource`.

```js
mountConceptGallery(root, {
  client,              // { listJobs({ accessToken, signal }) -> { ok, jobs } }   the one call v2 doesn't cover
  getAccessToken,      // () => token | null, for client (same bearer rules as /api/designs)
  creativeSource,      // createCreativeAssetSource({ fetchImpl, getAuthToken })  (alias: assetResolver)
                       //   .resolve(jobId, index, { signal }) -> fresh { url, format, filename, concept, … } per call
                       //   .getJob(jobId, { signal })         -> { job, refresh }   used for polling
  mountAssetViewer,    // Asset Engineer's mountAssetViewer, bound by the host
  viewerOptions,       // e.g. { three, deps } handed to mountAssetViewer
  onOpenConcept,       // optional: ({ jobId, index, format, mimeType, notice, resolveUrl }) — a resolver, never a URL
  pollIntervalMs: 4000 // clamped to 3000–5000
  // also optional: formatDate(iso), startDownload({ url, filename, … }), title
}) // -> { refresh, destroy, getState }
```

- **Open** mounts the injected viewer once inside a gallery panel with
  `{ ...viewerOptions, creativeSource }`, then calls
  `viewer.load({ jobId, index, format, mimeType, concept })`. That is a job-output reference,
  never a URL. v2 resolves the address and, on `FETCH_FAILED`, `PARSE_FAILED` or
  `UNSUPPORTED_FORMAT`, re-resolves once and retries once, then reports
  `ASSET_DISPLAY_FAILED`. The gallery adds no retry of its own here. Close and `destroy()` call
  `viewer.dispose()`.
- **Download** calls `creativeSource.resolve()` on every click, then `startDownload` with the
  source's filename `furniai-concept-<job>-<i>.<fmt|bin>`. On a transient failure it calls
  `resolve()` once more. `viewer.download()` is not used, because it only works for the item the
  viewer is currently showing.
- **Polling** uses `creativeSource.getJob()`. Without a source it falls back to `client.getJob`,
  and Open/Download are not offered. The gallery builds no URL resolver of its own.
- Errors come from v2 as `AssetViewerError` objects carrying `serverCode` and `status`. The
  gallery classifies them by `serverCode` first, then by the viewer code (`SIGN_IN_REQUIRED`,
  `CONCEPTS_NOT_CONFIGURED`, `CONCEPT_NOT_FOUND`, …), and never by message text.

## 3. States

| State | Trigger | UI |
|---|---|---|
| loading | first list or Refresh | `aria-busy`, skeleton, screen-reader text |
| empty | `jobs: []` | "No 3D concepts yet…" |
| list | `jobs` non-empty | cards in server order (newest first) |
| polling | any `submitting`/`processing` | spinner and text badge; polite live region "Checking N concepts for updates…" |
| failed job | `status: failed` | the server's `error.message` as one safe line (dropped if it contains an address), no retry |
| submission_unknown | `status: submission_unknown` | "**May have been charged.** … It has not been retried, and FurniAI will not retry it automatically." No retry control |
| signed out | no token, `401 MISSING_AUTH`, or v2 `SIGN_IN_REQUIRED` | "Sign in to see your 3D concepts." Polling stops |
| network | rejection without status | message + Try again |
| 5xx | `≥ 500` | message + Try again (server text is not shown) |
| not configured | `503 *_NOT_CONFIGURED` / v2 `CONCEPTS_NOT_CONFIGURED` | "3D concepts aren't available on this deployment yet." |
| asset: not ready | `409 ASSET_NOT_READY` | message; the job is re-checked once |
| asset: unavailable | `410 ASSET_UNAVAILABLE` | "no longer available … no stored copy" |
| integrity | `409 RECORD_INTEGRITY_FAILED` | message; on `getJob` the badge becomes "Integrity check failed" and that job stops polling |
| job gone | `404 MISSING_JOB` while polling | "This concept no longer exists." It stops polling |
| viewer | `ASSET_DISPLAY_FAILED` or a viewer start failure | "couldn't show this file. Downloading it may still work." Download stays available |

Accessibility: the region is a `section` labelled by its heading, and each card is an `article`.
Badges carry text, so colour is never the only signal. There is a `role=status` live region and
one `role=alert` announcer. Buttons take `disabled` and `aria-busy` and change their text while
busy. Focus is restored after re-renders and moves to the viewer heading on Open. Reduced motion
is honoured.

## 4. Polling rules

- **The list never refreshes from Scenario**: `listJobs` reads the store only (checked). So the
  gallery polls `getJob` for each non-terminal job every `pollIntervalMs` (3–5 s). The server
  throttles provider checks to one per 2 s per job.
- Terminal statuses are never polled. Polling stops when none are left, on `destroy()`, while
  `document.hidden` is set (and resumes immediately when the page is visible again), on
  signed-out, and on a list error.
- `refresh:{ok:false}` keeps polling at the normal interval and adds a "status check didn't go
  through" note. A round with any network or 5xx failure backs off: interval × 2ⁿ, capped at
  30 s.
- Stale guards: the gallery ignores list answers superseded by a later `refresh()`, poll rounds
  that span a refresh, job views older (by `updatedAt`) than the one it holds, viewer results
  after Close or a newer Open, and everything after `destroy()`.

## 5. URL rules

- Each Open (through the viewer) and each Download calls `?resource=asset`. The URL is never put
  in gallery state or the DOM, apart from a temporary `<a download>` that is removed straight
  away.
- Retry once: Download retries one transient failure. Open relies on v2's single re-resolve.
  `ASSET_NOT_READY`, `ASSET_UNAVAILABLE`, `RECORD_INTEGRITY_FAILED`, `MISSING_JOB`, 400 and 401
  are not retried.
- Only `glb`/`gltf` get "Open 3D view". Every other format, and `null`, is download-only.

## 6. Viewer alignment (Asset Engineer, v2 at 42c3fa6)

Alignment was checked against `src/lib/assetViewer/mountAssetViewer.js` and `creativeAsset.js`,
without editing them. The gallery uses `mountAssetViewer(el, { creativeSource, ... })`,
`load({ jobId, index, format, mimeType, concept })`, `dispose()`,
`createCreativeAssetSource().resolve()` and `.getJob()`, and `AssetViewerError` `code`,
`serverCode` and `status`. `tests/projects/viewer.test.js` fakes only the viewer handle (the
real one needs THREE and WebGL). `tests/projects/assets.test.js` and the contract test run the
**real** `createCreativeAssetSource`.

Mismatches between v2 and the contract or the gallery are listed as open questions Q9–Q13 below.

## 7. Design tokens (Antigravity)

**Source:** `src/styles/design-tokens.css`, blob `17fc5a7`, on the base (AG `8744d07`; it was
`68bf15f` at `refs/review/ag-e06377b`). In 8744d07 `--brass` maps to the deep-green BEK accent
`#1B4D3E`. The file is not linked from `index.html`. Every `var()` in `styles.js` carries the
`17fc5a7` value as its fallback.

Tokens used: `--paper`, `--paper-2`, `--paper-3`, `--ink`, `--ink-soft`, `--ink-faint`, `--brass`,
`--line`, `--line-soft`, `--r`, `--r-sm`, `--font-sans`, `--font-mono`, `--space-sm`, `--space-md`,
`--space-lg`, `--space-xl`, and `--status-{saved,saving,unsaved,error}-{bg,text,border}`. The
badges map onto them as follows: succeeded → saved, submitting/processing → saving,
submission_unknown → unsaved, failed or integrity → error. The list is exported as
`CONCEPT_GALLERY_TOKENS`. All selectors are under `.fcg`.

## 8. Bundle entry (for CraZy)

`src/lib/projects/conceptGallery/entry.js` is ready and **not** wired, because
`scripts/build-static.mjs` is CraZy's. Suggested entry:

```js
{ entryPoints: [resolve(root, "src/lib/projects/conceptGallery/entry.js")], bundle: true, format: "iife",
  globalName: "FurniConceptGallery", outfile: resolve(root, "concept-gallery.js") }   // + add to the copied files
```

The bundle imports no client, no viewer and no fixtures. Mounting needs the asset viewer bundle
(`FurniAssetViewer`, Asset Engineer's entry) too; see MOUNT_PROPOSAL.md.

## 9. Tests and evidence

- `npx vitest run --config tests/projects/vitest.config.js` runs 7 files and 73 tests. The root
  `npx vitest run` collects them through `conceptGallery.collect.test.js`. All hooks are scoped
  inside `describe()`, so fake timers and stubs don't leak.
- `fixtureShape.test.js` pins the fixtures to the contract and does not depend on the handler.
- **`creativeContract.test.js` (committed)** runs the real `api/creative.js` on this branch
  in-process, with fake req/res objects, the memory store, and an in-memory provider stand-in in
  place of `globalThis.fetch`. That stand-in **throws for any host but
  `scenario.stand-in.invalid`**, and each test asserts nothing was blocked.
  `SCENARIO_API_BASE_URL` always points at the stand-in. There are no Scenario network calls, no
  paid calls, and `scenario:discover` is never run. It checks:
  - the list, processing, succeeded, failed, submission_unknown and asset views against the
    fixture key sets and types
  - `409 ASSET_NOT_READY`, `410 ASSET_UNAVAILABLE`, `409 RECORD_INTEGRITY_FAILED` (asset and
    `getJob`, with the row dropped from the list), `401 MISSING_AUTH` and `404 MISSING_JOB`
  - that the list does not refresh from the provider
  - the gallery end-to-end with the real `createCreativeAssetSource`: list → poll to succeeded →
    a new URL per download → 410 mapped → 401 signed-out → 503 `PERSISTENCE_NOT_CONFIGURED`
    mapped to not-configured
- Demo: `node docs/m3/projects/demo/serve.mjs`, then open `/docs/m3/projects/demo/?state=list`.
  It uses **fixture data only**, with the real source over a fixture fetch and no viewer mounted.
  `node docs/m3/projects/demo/capture.mjs [--update]` writes 13 states plus a 390 px view to
  `docs/m3/projects/artifacts/`.

## 10. Open questions

**Claude (backend):**
1. Who owns the browser list client (`listJobs`)? v2's source covers only `getJob` and the asset.
2. Could `GET ?resource=jobs` refresh non-terminal jobs, or give a hint? Today polling 50 jobs
   means 50 `getJob` calls per round.
3. There is no prompt or reference preview in the job view. Is a reference thumbnail planned?
4. Failed jobs carry `error.code: PROVIDER_GENERATION_FAILED`, which is not in `CREATIVE_ERROR`.
   Their `error.message` is the provider's text verbatim. Is it customer-safe? The gallery shows
   one sanitised line.
5. What is the `providerProgress` scale (the stand-in sends 0.5)? It stays unrendered until then.
6. Asset URL CORS and expiry (U7), and durable storage (U5, `durableCopy:false`).

**Antigravity:** see [MOUNT_PROPOSAL.md](MOUNT_PROPOSAL.md) (placement, the token file on the
page, the loaders, the list-client owner).

7. Is `--status-*` (the save-status family) the right token family for job status?
8. Which section or heading should concepts get in `#view-projects`?

**Asset Engineer (v2 vs contract or gallery):**
9. `createCreativeAssetSource` returns the same status-less `RESOLVE_FAILED` for a network error
   and for an ok:true body with no or non-http URL. The gallery can't tell them apart without
   reading text, so a malformed body gets the single transient retry too. Could the source use a
   distinct code, or `network: true`?
10. `DEFAULT_CONCEPT_NOTICE` ("no separately editable parts") differs from the server's
    `CONCEPT_NOTICE` ("no separately editable doors or panels"). It is only a fallback, but the
    wording should match the contract.
11. `viewer.download()` re-resolves fresh but has no retry-once, and it only works for the item
    currently loaded. Is that intended? The gallery downloads through `source.resolve()`.
12. With no `code`, `codeForStatus` maps 403 → `SIGN_IN_REQUIRED`, but the contract defines only
    401 for auth. Should 403 count as signed-out?
13. Should the viewer render `concept.notice` itself, or the host? The gallery shows it in the
    viewer panel today, so it may appear twice if the overlay shows it too.
