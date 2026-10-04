# Concept gallery (Projects → 3D concepts)

**Owner:** Grok Projects Engineer. **Branch:** `grok/projects-assets`. It was rebased from `a29f47b`
onto `integ/scenario-candidate` `6d3f204`, then **merged** with `42c3fa6` (asset viewer v2), then
**merged** with `grok/asset-viewer` `b34e259` (asset viewer **v2.1**, tree `f2dac04f`).
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

Asset Engineer's viewer v2.1 (`src/lib/assetViewer/` at `b34e259`) already does the asset and
job-status work, so the gallery **injects** it and does not reimplement it. The gallery module's
only import from `src/lib/assetViewer/` is the pure rule `isRetryableResolveError` from
`creativeAsset.js` (an import, not an edit). `mountAssetViewer` and the source stay injected. Only
tests and the demo import `createCreativeAssetSource`.

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
  `{ ...viewerOptions, creativeSource, renderConceptNotice: false }`. `renderConceptNotice` is set
  last, so `viewerOptions` can't turn the overlay's notice back on. It then calls
  `viewer.load({ jobId, index, format, mimeType, concept })`. That is a job-output reference,
  never a URL. v2.1 resolves the address, re-resolves once if that resolve fails retryably (V1),
  and on `FETCH_FAILED`, `PARSE_FAILED` or `UNSUPPORTED_FORMAT` re-resolves once and retries once,
  then reports `ASSET_DISPLAY_FAILED`. The gallery adds no retry of its own here. Close and
  `destroy()` call `viewer.dispose()`.
- **Notice (v2.1 V3, V6).** The gallery renders `concept.notice` itself, always: on every card,
  and in the viewer panel from the moment Open is clicked, through loading, ready, download-only
  and every error. The panel starts with the job's notice (or the contract fallback). After the
  load it switches to `viewer.getState().concept.notice` when `noticeSource` is `"server"`, so
  the text from this resolve wins. The server's text is shown **verbatim**: not trimmed, collapsed
  or shortened, rendered with `textContent` and `white-space: pre-wrap`. A blank notice counts as
  missing, the same rule as v2.1.
- **Download** calls `creativeSource.resolve()` on every click, then `startDownload` with the
  source's filename `furniai-concept-<job>-<i>.<fmt|bin>`. If the first resolve fails and
  **`isRetryableResolveError(err)`** (Asset Engineer's export) says so, it calls `resolve()` once
  more, never twice. That is the viewer's own rule: network, 5xx and 429, but never a malformed
  body, 401/403/404/409/410 or `*_NOT_CONFIGURED`. The URL is used once and never stored.
  `viewer.download({ jobId, index })` (V5) was considered and not used. `source.resolve()` needs
  no mounted viewer (no WebGL just to download), works for `onOpenConcept` hosts with no viewer
  at all, and with the shared rule it retries exactly as `viewer.download()` would.
- **Polling** uses `creativeSource.getJob()`. Without a source it falls back to `client.getJob`,
  and Open/Download are not offered. The gallery builds no URL resolver of its own.
- Errors come from v2.1 as `AssetViewerError` objects carrying `serverCode`, `status` and
  `details: { cause, retryable }`. The gallery classifies them by `serverCode` first, then by the
  viewer code (`SIGN_IN_REQUIRED`, `FORBIDDEN`, `RESOLVE_MALFORMED`, `CONCEPTS_NOT_CONFIGURED`,
  `CONCEPT_NOT_FOUND`, …), and never by message text.

## 3. States

| State | Trigger | UI |
|---|---|---|
| loading | first list or Refresh | `aria-busy`, skeleton, screen-reader text |
| empty | `jobs: []` | "No 3D concepts yet…" |
| list | `jobs` non-empty | cards in server order (newest first) |
| polling | any `submitting`/`processing` | spinner and text badge; polite live region "Checking N concepts for updates…" |
| failed job | `status: failed` | the server's `error.message` as one safe line (dropped if it contains an address), no retry |
| submission_unknown | `status: submission_unknown` | "**May have been charged.** … It has not been retried, and FurniAI will not retry it automatically." No retry control |
| signed out | no token, `401 MISSING_AUTH`, or v2 `SIGN_IN_REQUIRED`. **Only 401** (v2.1 V4) | "Sign in to see your 3D concepts." Polling stops |
| forbidden | `403` with `UNAUTHORIZED`, `FORBIDDEN`, any other code or none; v2.1 `FORBIDDEN` | list: "This account doesn't have permission to see these 3D concepts. Signing in again won't change that." No sign-in prompt, no Try again (the header Refresh stays). One job (poll, Open or Download): badge "Not allowed", no Open/Download, that job stops polling, nothing is retried. A successful list refresh lifts the lock |
| malformed answer | v2.1 `RESOLVE_MALFORMED` (a 2xx body that can't be used) | "FurniAI sent a reply this page couldn't read…" Never retried, never suggests Download, the card is not locked |
| network | rejection without status | message + Try again |
| 5xx | `≥ 500` | message + Try again (server text is not shown) |
| asset: 5xx / network | `≥ 500` or no status on Open or Download | "FurniAI couldn't get this file right now. Try again in a moment." (network: "…check your connection"). Never suggests the other button, because it would fail the same way (QE G2). Download retries once first; the card stays Ready |
| not configured | `503 *_NOT_CONFIGURED` / v2 `CONCEPTS_NOT_CONFIGURED` | "3D concepts aren't available on this deployment yet." |
| asset: not ready | `409 ASSET_NOT_READY` | message; the job is re-checked once |
| asset: unavailable | `410 ASSET_UNAVAILABLE` | "no longer available … no stored copy" on **that file only**. The card keeps its server status (Ready) and its other outputs. Nothing is retried automatically; a user click is one more honest asset call. The record is intact and contract §2.5 makes 410 about the file, so it is not treated like integrity |
| integrity | `409 RECORD_INTEGRITY_FAILED` from `getJob` **or from Open/Download** | the card becomes job-errored: badge "Integrity check failed", the job message, **no Open, no Download**, never polled. One path for poll and asset (QE G1). The next list refresh drops the row if the server still refuses it |
| job gone | `404 MISSING_JOB` while polling or from Open/Download | badge "Not found", "This concept no longer exists.", no Open/Download, no polling |
| viewer | `ASSET_DISPLAY_FAILED` or another viewer-side code | "The 3D view couldn't show this file. Downloading it may still work." This is the **only** message that points at Download. Download stays available |

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
- Retry once: Download retries only when `isRetryableResolveError` says so, so it matches the
  viewer exactly. Open relies on v2.1's own re-resolves. `ASSET_NOT_READY`, `ASSET_UNAVAILABLE`,
  `RECORD_INTEGRITY_FAILED`, `MISSING_JOB`, 400, 401, 403, `*_NOT_CONFIGURED` and malformed bodies
  are not retried.
- Only `glb`/`gltf` get "Open 3D view". Every other format, and `null`, is download-only.
- A failed Open or Download goes through one function, `afterAssetFailure()` in
  `mountConceptGallery.js`. Integrity or missing-job → the job error, as in polling.
  `ASSET_NOT_READY` → one job re-check. Everything else stays on that file.

## 6. Viewer alignment (Asset Engineer, v2.1 at b34e259)

Alignment was checked against `src/lib/assetViewer/mountAssetViewer.js`, `creativeAsset.js`,
`errors.js` and `docs/m3/asset-viewer/ASSET_VIEWER.md` §12 and its v2.1 changelog, without
editing them. The gallery uses:
- `mountAssetViewer(el, { creativeSource, renderConceptNotice: false, ... })`
- `load({ jobId, index, format, mimeType, concept })`, `getState().concept` and `dispose()`
- `createCreativeAssetSource().resolve()` and `.getJob()`
- `isRetryableResolveError()`
- `AssetViewerError` `code`, `serverCode`, `status` and `details`

What v2.1 changed for the gallery:

| v2.1 | gallery |
|---|---|
| V1: load re-resolves once on a retryable resolve failure | nothing to add. Open after one 502 now succeeds, and two 502s make 2 resolves, not 1 |
| V2: `RESOLVE_MALFORMED` (never retried), `RESOLVE_FAILED` network-only, `details.cause`/`retryable` | Download uses `isRetryableResolveError`. Malformed is its own kind and message (Q9 closed) |
| V3: the server notice verbatim, and the fallback equals the server text | the card and panel show it verbatim (`pre-wrap`); a blank notice falls back (Q10 closed) |
| V4: only 401 is signed out; 403 becomes `FORBIDDEN` | the new `forbidden` kind (list panel and "Not allowed" card) (Q12 closed) |
| V5: `download()` re-resolves once; `download({ jobId, index })` | not used; see §2 (Q11 closed) |
| V6: `renderConceptNotice` | always `false`; the gallery shows the notice in every viewer state (Q13 closed) | `tests/projects/viewer.test.js` fakes only the viewer handle (the
real one needs THREE and WebGL). `tests/projects/assets.test.js` and the contract test run the
**real** `createCreativeAssetSource`.

Q9–Q13 (raised against v2) are answered by v2.1; see §10.

Bundle note: importing `isRetryableResolveError` pulls `assetViewer/creativeAsset.js` and
`assetViewer/errors.js` into the gallery bundle (esbuild IIFE of `entry.js`, unminified:
50.1 KB → 60.8 KB). It doesn't pull in three.js or the viewer. A page that loads both bundles
carries that code twice; see Q14.

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

The bundle imports no client, no viewer and no fixtures. Its only code from Asset Engineer is
`creativeAsset.js` and `errors.js`, for `isRetryableResolveError` (§6). Mounting needs the asset viewer bundle
(`FurniAssetViewer`, Asset Engineer's entry) too; see MOUNT_PROPOSAL.md.

## 9. Tests and evidence

- `npx vitest run --config tests/projects/vitest.config.js` runs 8 files and 116 tests. The root
  `npx vitest run` picks them up once Integration adds the root include (see "Running the tests"
  below). All hooks are scoped inside `describe()`, so fake timers and stubs don't leak.
- `assetFailures.test.js` covers QE G1 and G2: integrity or missing-job from Download, from Open
  through the viewer, and from `onOpenConcept`'s `resolveUrl()`. It also covers the lock across
  refresh, multi-output, 410 per file, late results after `destroy()`, and the Open and Download
  5xx/network/not-configured wording. The fake viewer handle is shared in
  `tests/projects/fixtures/fakeViewer.js`. It models v2.1: the V1 resolve retry through the real
  `isRetryableResolveError`, and `getState().concept` through the real `normalizeConcept`.
- v2.1 cases:
  - Download's call count across 14 failure kinds is cross-checked against
    `isRetryableResolveError` and `details.retryable` on the real source's error. At most one
    retry, with a fresh, unstored URL each time.
  - 403: the list panel, the "Not allowed" card from Download, Open and polling, and lifting the
    lock on refresh.
  - Malformed bodies on Open and Download.
  - `renderConceptNotice:false` can't be overridden.
  - The panel notice before the load, after it (verbatim), and after an early error.
  - The card notice verbatim, with a blank one falling back.
  - These mutations each fail at least one test: removing `renderConceptNotice:false`, not
    updating the panel notice, and treating 403 as signed out.
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
  `docs/m3/projects/artifacts/`. The capture runs with reduced motion. `01-loading.png` was
  re-shot after a fix to the reduced-motion rule, which had painted the loading skeletons in the
  error colour. The other shots are byte-identical after v2.1.

### Running the tests

```
npx vitest run --config tests/projects/vitest.config.js   # the concept-gallery suites
npx vitest run                                            # root suite
```

The collector `src/lib/projects/conceptGallery/conceptGallery.collect.test.js` has been
**deleted** on this branch. Integration handles the root include: CraZy adds this line to
`test.include` in the root `vitest.config.js` (after `"tests/contract/**/*.test.js",`) in an
integration commit, and merges it together with this branch:

```js
      "tests/projects/**/*.test.js",
```

Until that include lands, the root `npx vitest run` **skips `tests/projects/**`**. That is
expected. Use the `--config tests/projects/vitest.config.js` command above for these suites.

### QE review fixes (after 34f80a7)

- **G1:** after Open or Download returns `409 RECORD_INTEGRITY_FAILED`, the card no longer shows
  Ready with Open and Download. It becomes "Integrity check failed" with no Open or Download, the
  same as the polling path. `404 MISSING_JOB` gets the same treatment ("Not found"), also matching
  polling. `410 ASSET_UNAVAILABLE` stays per file (see §3).
- **G2:** a 5xx, network or not-configured failure on Open now uses the same honest message as
  Download ("FurniAI couldn't get this file right now. Try again in a moment.") and no longer says
  "Downloading it may still work". That hint is kept only for real display failures. The Download
  5xx wording was checked: it was already honest and is unchanged.
- With v2.1 merged, Open itself re-resolves once on a 502 (V1). QE's "CURRENT_BEHAVIOUR Open
  does NOT retry a transient resolve failure (502)" therefore also needs `[502, 502]` in place of
  `[502]` (see the acceptance delta in the report).
- QE acceptance (`tests/acceptance/scenario/galleryViewer.acceptance.test.js` @ 687f20a) needs
  three updates when it takes this fix. Flip the `it.fails` "KNOWN_DEFECT G1 …" to `it`. In
  "CURRENT_BEHAVIOUR Open does NOT retry a transient resolve failure (502)", expect
  `MSG.serverAsset`, not `MSG.displayFailed`. In "RECORD_INTEGRITY_FAILED is never rendered as a
  usable asset", the Download click after the failed Open is gone: the button no longer exists,
  so assert it is `null`.

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

**Asset Engineer:** v2.1 (`b34e259`) answered Q9–Q13:
9. ~~A malformed body and a network error share `RESOLVE_FAILED`.~~ Fixed by V2
   (`RESOLVE_MALFORMED`, `details.cause`). A malformed body is no longer retried.
10. ~~`DEFAULT_CONCEPT_NOTICE` differs from the server's text.~~ Fixed by V3. The gallery's
    `FALLBACK_CONCEPT_NOTICE` matches it character for character.
11. ~~`viewer.download()` has no retry and only works for the current item.~~ Fixed by V5. The
    gallery still uses `source.resolve()` with the same rule (§2).
12. ~~403 is treated as signed out.~~ Fixed by V4. The gallery has a `forbidden` state.
13. ~~Is the notice shown twice?~~ Fixed by V6. The gallery passes `renderConceptNotice:false`.
14. **New:** could the gallery receive `isRetryableResolveError` with the source, for example as
    `source.isRetryable` or the browser entry's `FurniAssetViewer.isRetryableResolveError`, as an
    option? That would let the gallery bundle drop the ~10.7 KB copy of `creativeAsset.js` and
    `errors.js`. The gallery imports it today, as allowed.
15. **New:** a 403 `UNAUTHORIZED` from persistence is about the account, not one concept. The
    gallery locks only the card that got it, and a list refresh lifts the lock. Does the viewer
    expect hosts to treat `FORBIDDEN` as page-wide instead?
