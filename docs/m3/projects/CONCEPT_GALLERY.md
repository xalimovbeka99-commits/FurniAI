# Concept gallery (Projects → 3D concepts)

**Owner:** Grok Projects Engineer. **Branch:** `grok/projects-assets` (base `a29f47b`).
**Code:** `src/lib/projects/conceptGallery/`. **Tests:** `tests/projects/`. **Demo:** `docs/m3/projects/demo/` (FIXTURE DATA).

The gallery lists the signed-in user's AI visual concepts from `GET /api/creative?resource=jobs`.
For each one it shows the job id, a status badge with text, the created and updated dates, and
`concept.notice`. It resolves asset addresses freshly on every open and download. It is
framework-free and renders without `innerHTML`.

## 1. Contract used

`docs/creative/SCENARIO_3D_API_CONTRACT.md`, **status PROPOSED**, read from the review copy
`/workspace/scenario-review/SCENARIO_3D_API_CONTRACT.md`. The implementation was checked against
Claude's backend at `refs/review/claude-scenario-3d/feat/scenario-3d-generation` =
`7f42f956` (base `15a571f`). That backend is read-only here and is **not merged** with the
`a29f47b` lineage; nothing from it is imported or committed on this branch.

Fields the gallery reads (§2.4 job view): `jobId`, `status`, `provider`, `model`,
`sourceReferenceId`, `outputs[{index, format, mimeType}]`, `error{code, message}`, `createdAt`,
`updatedAt`, `concept.notice`. Asset (§2.5): `asset.url` and `asset.format`, used once and then dropped.

Not shown, because the contract does not provide them: thumbnails (a neutral placeholder
tile is used instead), the prompt (the view has none), a reference image (only
`sourceReferenceId`, shown as an id), dimensions, and any `designId` or design link.
`providerProgress` is never rendered and `providerStatus` is never rendered or branched on.
Both are kept in `getState()` for diagnostics only.

## 2. Client interface (injected)

No browser client for `/api/creative` ships at `7f42f956`; the backend has only the handler and
the server-side `scenarioClient.js`. So the gallery **defines the interface it needs and does not
ship an implementation**, to avoid competing with the real client when its owner writes one (see
Q1). The full JSDoc is in `mountConceptGallery.js`.

```js
/** @typedef CreativeJobsClient
 *  listJobs({ accessToken, signal })              -> { ok, jobs }                 GET ?resource=jobs
 *  getJob({ jobId, accessToken, signal })         -> { ok, job, refresh? }        GET ?resource=jobs&jobId=
 *  getAssetUrl({ jobId, index, accessToken, signal }) -> { ok, asset }            GET ?resource=asset&jobId=&index=
 *  Non-2xx: reject with { status, code, message?, details? }  (code from { ok:false, code, error, details? })
 *  Network: reject with no `status` (e.g. fetch's TypeError).
 */
```

`getAccessToken()` is called before every request. If it returns a null token, the gallery shows
the signed-out state and makes no call. Bearer rules are the same as `/api/designs`. The gallery
switches on `code`; it uses the HTTP status only when there is no code (401, ≥ 500).

```js
import { mountConceptGallery } from "src/lib/projects/conceptGallery/index.js";
const gallery = mountConceptGallery(rootEl, {
  client,                                   // CreativeJobsClient
  getAccessToken,                           // () => string | null | Promise<…>
  onOpenConcept,                            // optional viewer hook, §6
  assetResolver,                            // optional; replaces client.getAssetUrl, still called every time
  pollIntervalMs: 4000,                     // clamped to 3000–5000
  // also optional: formatDate(iso), startDownload({ url, filename, jobId, index, format }), title
});
gallery.refresh(); gallery.getState(); gallery.destroy();
```

## 3. States

| State | Trigger | UI |
|---|---|---|
| loading | first list or Refresh | `aria-busy`, skeleton, screen-reader text |
| empty | `jobs: []` | "No 3D concepts yet…" |
| list | `jobs` non-empty | cards in server order (newest first) |
| polling | any `submitting`/`processing` | spinner and text badge; polite live region "Checking N concepts for updates…" |
| failed job | `status: failed` | the server's `error.message` (as text), no retry |
| submission_unknown | `status: submission_unknown` | "**May have been charged.** … It has not been retried, and FurniAI will not retry it automatically." No retry control |
| signed out | no token, or `401` / `MISSING_AUTH` | "Sign in to see your 3D concepts." Polling stops |
| network | rejection without status | message + Try again |
| 5xx | `≥ 500` (`INTERNAL`, `PROVIDER_*`, `AUTH_UNAVAILABLE`) | message + Try again (server text is not shown) |
| not configured | `503 CREATIVE_NOT_CONFIGURED`, `CREATIVE_STORE_NOT_CONFIGURED`, `PERSISTENCE_NOT_CONFIGURED` | "3D concepts aren't available on this deployment yet." |
| asset: not ready | `409 ASSET_NOT_READY` | message; the job is re-checked once with `getJob` |
| asset: unavailable | `410 ASSET_UNAVAILABLE` | "no longer available … no stored copy" |
| integrity | `409 RECORD_INTEGRITY_FAILED` on asset or `getJob` | message; on `getJob` the badge becomes "Integrity check failed" and that job stops polling |
| job gone | `404 MISSING_JOB` during polling | "This concept no longer exists." It stops polling |

Accessibility: the region is a `section` labelled by its `h2`, and each card is an `article`
labelled by its title. Badges carry text, so colour is never the only signal. The live region is
`role=status`, and asset failures are announced through a single `role=alert` region. Buttons
take `disabled` and `aria-busy` and change their text while fetching. Focus is restored after
re-renders, and reduced motion is honoured.

## 4. Polling rules

- **The list never refreshes from Scenario.** At `7f42f956`, `listJobs` reads the store only
  (verified: no provider call). So the gallery polls **`getJob` for each non-terminal job** every
  `pollIntervalMs` (default 4 s, clamped to the contract's 3–5 s). The server throttles provider
  checks to one per 2 s per job.
- Terminal statuses (`succeeded`, `failed`, `submission_unknown`) are never polled. When none
  are left, polling stops.
- `refresh:{ok:false}` means the status *check* failed, not the job. The gallery keeps polling at
  the normal interval and adds "The last status check didn't go through. Still checking."
- If a round has any network or 5xx failure, the gallery backs off: interval × 2ⁿ, capped at 30 s.
  It goes back to the normal interval after a clean round.
- Polling stops on `destroy()`, when `document.hidden` is set, on signed-out, and on a list error.
  When the page becomes visible again it polls immediately.
- Stale guards: the gallery ignores list answers older than the latest `refresh()`, discards poll
  rounds that span a refresh, ignores job views whose `updatedAt` is older than what it already
  has, and ignores everything after `destroy()` (in-flight requests are aborted).

## 5. URL rules

- `getAssetUrl` (or `assetResolver`) is called on **every** Open and Download. The URL is never
  stored in state or in the DOM. A download uses a temporary `<a download>` that is removed
  straight away.
- **Retry once:** a transient failure (network, ≥ 500, 429) gets exactly one more call.
  `ASSET_NOT_READY`, `ASSET_UNAVAILABLE`, `RECORD_INTEGRITY_FAILED`, `MISSING_JOB`, 400 and 401
  are definitive and are not retried.
- Only `glb`/`gltf` get "Open 3D view". Every other format, and `null`, is download-only.

## 6. Viewer hook (Asset Engineer)

```js
onOpenConcept({ jobId, index, format, mimeType, notice, resolveUrl })   // resolveUrl: () => Promise<string>
```

The gallery hands over **a resolver, never a URL**. Each `resolveUrl()` call is a fresh
`GET ?resource=asset` (with the one transient retry), and the gallery's busy and error state
updates on the card. It rejects with `ConceptAssetError { code, kind, status }`. It still works
after the gallery is destroyed, so a viewer can outlive it.

Alignment with `grok/asset-viewer`: checked read-only at `f8dd8be` (review.git); the Windows
branch tip is `3741aa1`, with an identical tree. Nothing is imported. `mountAssetViewer(el, opts)`
there takes a neutral descriptor `{ url | arrayBuffer | blob, format?, mime?, filename? }` on
`load()`. **No asset-resolver hook exists there yet.** Its open question 7 (expired signed URL
returns 403 → `FETCH_FAILED`, "should the viewer ask the host to refresh the URL and retry")
is what `resolveUrl` answers. The expected host glue, until their hook lands:

```js
onOpenConcept: async ({ resolveUrl, format, notice }) => {
  const load = async () => viewer.load({ url: await resolveUrl(), format });
  let r = await load();
  if (r?.ok === false && r.error?.code === "FETCH_FAILED") r = await load();   // contract §2.5: call again once
}
```

Suggested hook shape for Asset Engineer: accept `{ resolveUrl, format }` in the descriptor, or
`load({ resolve: () => Promise<url> })`, and call it for every load and once more on
`FETCH_FAILED`.

## 7. Design tokens (Antigravity)

**Source:** `src/styles/design-tokens.css` (blob `68bf15f`) at `refs/review/ag-e06377b`; the same
blob is at `365c0523` and `refs/review/ag-9d44e10`. It is not on `a29f47b`, where root
`styles.css` defines only `--paper`, `--paper-2`, `--paper-3`, `--ink`, `--ink-soft`, `--brass`,
`--brass-bright`, `--walnut`, `--line`, `--line-soft` and `--r`. Every `var()` in
`styles.js` carries AG's own value as its fallback, so the gallery looks the same with or
without the tokens file.

Tokens used: `--paper`, `--paper-2`, `--paper-3`, `--ink`, `--ink-soft`, `--ink-faint`, `--brass`,
`--line`, `--line-soft`, `--r`, `--r-sm`, `--font-sans`, `--font-mono`, `--space-sm`, `--space-md`,
`--space-lg`, `--space-xl`, and `--status-{saved,saving,unsaved,error}-{bg,text,border}`. The
badges map onto them as follows: succeeded → saved, submitting/processing → saving,
submission_unknown → unsaved, failed or integrity → error. The list is exported as
`CONCEPT_GALLERY_TOKENS`. All selectors are under `.fcg`.

## 8. Bundle entry (for CraZy)

`src/lib/projects/conceptGallery/entry.js` is ready. It is **not** wired into
`scripts/build-static.mjs`, because CraZy owns that file. It would mirror the My Designs entry:

```js
{ entryPoints: [resolve(root, "src/lib/projects/conceptGallery/entry.js")], bundle: true, format: "iife",
  globalName: "FurniConceptGallery", outfile: resolve(root, "concept-gallery.js") }   // + add "concept-gallery.js" to the copied files
```

The bundle imports no client and no fixtures.

## 9. Tests and evidence

- `npx vitest run --config tests/projects/vitest.config.js` runs the gallery suites: state,
  gallery states, polling, assets, and the fixture shape. The root `npx vitest run` picks them up
  through `src/lib/projects/conceptGallery/conceptGallery.collect.test.js`, the same pattern as
  the asset viewer. Delete the collector if `tests/projects/**` joins the root include list.
- `tests/projects/fixtureShape.test.js` pins the fixtures to the contract's key sets, statuses and
  error bodies. It does not depend on the `7f42f956` ref.
- **Contract check (scratch, not committed):** I ran the real `api/creative.js` at `7f42f956`
  in-process with Claude's `scenarioStandIn.js` and the memory store, with outbound fetch limited
  to loopback. No Scenario network or paid calls were made. The jobs list, the processing,
  succeeded, failed and submission_unknown job views, and the asset view all had exactly the
  fixture key sets and types. The error codes and statuses matched: `409 ASSET_NOT_READY`
  (`details.jobStatus`), `410 ASSET_UNAVAILABLE` (`details.durableCopy:false`),
  `409 RECORD_INTEGRITY_FAILED` (on asset and `getJob`, with the row dropped from the list),
  `401 MISSING_AUTH` and `404 MISSING_JOB`. The gallery, mounted on a scratch HTTP adapter, listed
  the jobs, polled a processing job to succeeded, got a new URL on each download, and mapped 410
  and signed-out correctly.
- Demo: `node docs/m3/projects/demo/serve.mjs`, then open `/docs/m3/projects/demo/?state=list`.
  It uses **fixture data only**. `node docs/m3/projects/demo/capture.mjs` writes screenshots to a
  temp folder, and `--update` writes them to `docs/m3/projects/artifacts/` (13 states plus a 390 px
  mobile view).

## 10. Open questions

**Claude (backend):**
1. Who owns the browser `CreativeJobsClient`? The gallery needs the interface in §2. Should
   Claude ship it next to `api/creative`, or AG beside `designsApiClient.js`?
2. Should `GET ?resource=jobs` refresh non-terminal jobs, or return a hint, so the gallery doesn't
   need N `getJob` calls per round? With 50 jobs that is 50 calls every 4 s.
3. The job view has no prompt or reference preview. Is a reference thumbnail planned? The gallery
   would show it if added.
4. Failed jobs carry `error.code: PROVIDER_GENERATION_FAILED`, which is not in `CREATIVE_ERROR`.
   Their `error.message` is the provider's text verbatim (stand-in: "simulated generation
   failure"). Is it customer-safe?
5. What is the `providerProgress` scale (the stand-in sends 0.5)? It stays unrendered until this is
   answered.
6. Asset URL CORS and expiry (U7), and durable storage (`storage.durableCopy:false`, U5). Until
   these are settled, `410 ASSET_UNAVAILABLE` is permanent for that output.

**Antigravity:**
7. Is `design-tokens.css` going onto the Studio page (it is not on `a29f47b`)? Are the
   `--status-*` save tokens the right family for job status, or will there be job-status tokens?
8. Where in the Projects shell does the gallery mount? Which element, and which route
   (`#/projects`)?

**Asset Engineer:**
9. Which resolver hook shape will `mountAssetViewer` take (§6)? Will it call the resolver once
   more on `FETCH_FAILED`, or should the host do that?
10. Should the viewer show `notice` itself, or should the host render it next to the viewer?
