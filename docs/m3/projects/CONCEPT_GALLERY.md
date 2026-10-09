# Concept gallery (Projects → 3D concepts), rev 2

**Owner:** Grok Projects Engineer. **Branch:** `grok/projects-assets`, **local commits only, not
pushed** (CraZy, 7 Oct 2026: "DO NOT PUSH yet"). **Base:** candidate
`f472aef2e0ca0d9f4e362714407363673bba412d` (merged into this branch at `cd0ebe3`).
**Code:** `src/lib/projects/conceptGallery/`. **Tests:** `tests/projects/`.
**Demo:** `docs/m3/projects/demo/` (SYNTHETIC/MOCKED). **Mount:** [MOUNT_PROPOSAL.md](MOUNT_PROPOSAL.md).
**Replica evidence:** [rev2/TEST_PLAN.md](rev2/TEST_PLAN.md), [rev2/BUGS.md](rev2/BUGS.md),
[rev2/features.csv](rev2/features.csv), [rev2/parity.md](rev2/parity.md).

## 0. Evidence labels

| Label | Means | Used for |
|---|---|---|
| **SYNTHETIC/MOCKED** | made-up data or a local stand-in server; no provider involved | all 56 screenshots, the demo, Playwright e2e, the MOCKED reload route |
| **SIMULATED** | Claude's rev-2 fixture pack (`3946b53`) and the in-memory provider stand-in (`scenario.stand-in.invalid`) | unit tests, `creativeContract.test.js` (real `api/creative.js` handler, stand-in provider) |
| **LIVE** | a real Scenario call or a deployed environment | **nothing.** No paid calls, no `scenario:discover`, no secrets, no Preview/Production checks |

## 1. Contract used

`docs/creative/SCENARIO_3D_API_CONTRACT.md` **Revision 2, status PROPOSED** (dated 2026-10-04),
as it is at `f472aef` (from Claude's `3946b53`), SHA-256 `12db2995…f525`. Endpoints used, all
existing, none added:

| Call | Used for |
|---|---|
| `GET /api/creative?resource=config` | availability note (configured, liveGenerationEnabled, maxCostPerJob). One call per list load, never retried |
| `GET /api/creative?resource=jobs` | the list (store only, newest first, max 50) and **reload restore** |
| `GET /api/creative?resource=jobs&jobId=` | polling an unfinished job (via AE's `creativeSource.getJob`, else the thin client) |
| `GET /api/creative?resource=asset&jobId=&index=` | a fresh URL per Open/Download (via AE's `creativeSource.resolve`) |
| `POST jobs` answers | not sent by the gallery. `submitOutcome.describeSubmitResponse(status, body)` turns any POST answer into truthful UI text for whoever owns the Generate button |

Fields shown: `status`, `createdAt`, `updatedAt`, `outputs` (only whether a result exists and its
format), `sourceReferenceId`, `model`, `usage.billingOutcome` / cost, `error`, `concept.notice`.
Never shown: dimensions, a `designId` or Studio link, `providerProgress`, `providerStatus`.

## 2. Reuse vs new

| Piece | Decision | Why |
|---|---|---|
| AG `getStudioAccessToken()` (index.html) | **reused** via `studioAccessToken(scope)` | delegates at call time; returns null if absent or blank |
| AG `DesignsApiClient` (`src/lib/persistence/designsApiClient.js`) | **not forked, not imported** | its `request`/`authHeaders` aren't exported and it is bound to `/api/designs`. A test fails if the gallery ever calls it (DesignsApiClient trap). Request AG-1 |
| AG My Projects (`#view-projects`, `#projectsGrid`, `.project-card`) | **reused as the host page**, not as markup | `.project-card` is clickable and means a dimensioned design; concepts are a separate section (MOUNT_PROPOSAL.md) |
| AG design tokens `src/styles/design-tokens.css` | **reused** with the same values as `var()` fallbacks | |
| `src/lib/designs/myDesigns` | not used | not AG's, not mounted |
| AE viewer v2.1 / v3 (`mountAssetViewer`, `createCreativeAssetSource`) | **injected**, not imported; mounted and loaded with `autoRetry: false` | the gallery bundle now imports nothing from `src/lib/assetViewer/` (rev 1 imported `isRetryableResolveError`; removed with auto retry). IIFE bundle 84.5 KB unminified, 0 assetViewer modules |
| `jobsClient.js` `createCreativeJobsClient` | **new**, thin | `listJobs`, `getJob`, `getConfig`: one fetch per call, Bearer header, `cache:"no-store"`, typed `{status, code, message}` rejections, no retry |
| `submitOutcome.js` | **new** | billing / budget / 429 / unknown-charge wording for POST jobs answers |

## 3. Reload restore

- State is rebuilt **only** from `GET ?resource=jobs` on mount. No localStorage, sessionStorage,
  IndexedDB or cookies are used for anything (asserted: unit Proxy spy, e2e `afterEach` checks
  both storages are empty, capture fails on any storage use).
- Unfinished jobs (`submitting`, `processing`) resume polling right after the list loads.
- Evidence: e2e `F05-H1` and screenshot `28-after-reload-restored` do a **real page reload**
  against the MOCKED per-session route on the demo server (`/__mock-api/<sid>/creative`); the job
  is processing, survives the reload, resumes polling and turns Ready.
- More than 50 jobs: the server caps the list at 50; the gallery says so (`data-truncated`).

## 4. Retry policy: user-initiated only (7 Oct)

- **No automatic retry anywhere in the gallery.** Removed in rev 2: the Download re-resolve on a
  retryable failure and the 429 delayed retry. Each Open/Download click = one asset call.
- Visible buttons instead: "Try again" (list), "Try opening again" / "Try download again"
  (asset), "Check status again" (paused polling). Each sends exactly one request (fake-timer tests
  count calls).
- **Offered only where trying again can help (QE PJ-1, 9 Oct):** network, 5xx, 429, provider
  unavailable (`PROVIDER_UNAVAILABLE` / `UNEXPECTED_RESPONSE`), `409 ASSET_NOT_READY`, and on Open
  the viewer's `FETCH_FAILED` / `ASSET_DISPLAY_FAILED` / `WEBGL_CONTEXT_LOST` (each try resolves a
  new address, which fixes a dead or expired link). `errors.js` `USER_RETRY_KINDS`,
  `RETRYABLE_DISPLAY_CODES`, `canUserRetryAsset()`.
- **Never offered:** 401 / 403 (page-wide), 404 / missing job, 409 integrity, malformed or unreadable
  answers, provider refusals (402 credits, provider keys, rejected request), 410, not-configured,
  other 4xx, and a damaged / empty / unsupported / too-large file. The header **Refresh** always
  stays: after a 401/403 it is how the page comes back once access is restored.
- Polling: every 3–5 s (`pollIntervalMs` clamped). A failed round re-polls at 5 s (no backoff).
  It **pauses** after 3 failed rounds in a row or on any 429, and says so, with "Check status
  again". It stops when no job is unfinished, on `destroy()`, while the tab is hidden, on
  signed-out and on a list error.
- **Viewer retries (AE-1, RESOLVED):** AE's viewer v3 (`1bb8b59`, local) adds `autoRetry`,
  **default off**, at mount and per call on `load()`/`download()`; when off, the viewer shows a
  focusable Try again that re-resolves fresh. The gallery passes `autoRetry: false`
  **explicitly** in the mount options (set after `viewerOptions`, so a host can't turn it on) and
  on every `load()` (`tests/projects/viewerV3.test.js`). Older viewers (v2.1) ignore the unknown
  option and still work, but keep their own single re-resolve/display retry.
- **409 `ASSET_NOT_READY`:** the one status refresh of that job after a not-ready answer was
  **accepted by CraZy as not a retry** (it re-reads the job, it doesn't repeat the asset call).
- Contract §2.5 says "if a load fails, call it again once"; that conflicts with the 7 Oct policy.
  The gallery follows the policy (Claude request C-4).

## 5. Billing and budget wording (truthful)

| Input | Card / message |
|---|---|
| `billingOutcome: not_submitted` | "No paid request was sent for this attempt." |
| `unconfirmed` (job finished) | "Not confirmed: the request was or may have been sent, and the provider hasn't reported a cost. It may have been charged." |
| `unconfirmed` (job still running) | "Not confirmed yet: the request was sent and the provider hasn't reported a cost yet. It may be charged." |
| no `billingOutcome` (older record) | "This server didn't report billing for this concept, so it isn't known whether it was charged." |
| `unconfirmed` (answer lost) / `submission_unknown` | "**May have been charged.** … It has not been retried, and FurniAI will not retry it automatically." + "Generating again from this reference will ask you to confirm first, because this attempt may have been charged." |
| `reported` | "Cost reported by the generation service: N provider units (unit unverified)." |
| `409 PRIOR_SUBMISSION_UNKNOWN` | `needs_acknowledgement`: the user must confirm; the resend carries `acknowledgeUnknownCharge: true` |
| `402 COST_CAP_EXCEEDED` | "would cost more than the per-concept budget … (estimate X, limit Y, both in provider units, unit unverified), so it wasn't generated." No request sent |
| `502 COST_UNVERIFIED` | no request sent; user may try again |
| `503 CREATIVE_*_NOT_CONFIGURED / GENERATION_DISABLED` | unavailable; existing concepts still listed |
| `429` (rate limited) | "busy"; billing stated per code; retry only by the user |
| `PROVIDER_UNAVAILABLE / UNEXPECTED_RESPONSE` | "may have been charged", no retry offered for the submit |
| unknown / network on submit | "It isn't known whether the paid request was sent. It may have been charged." Resend only with the same idempotency key |

Unknown billing is **never** called "no charge" or "free" (e2e `F01-H2` scans every state). The
earlier "no cost has been reported" (QE PJ-I) is gone: it could read as "no cost".

## 6. States

All at desktop-1440 and mobile-390, screenshots in `artifacts/rev2/{desktop,mobile}/` (30 + 30,
**SYNTHETIC/MOCKED**, `NN-name.SYNTHETIC.png`). All 56 earlier shots were re-shot on 9 Oct (44 px
controls change every header; billing, retry and 401/403 wording changed several); 29 and 30 are new:

| # | State | Key behaviour |
|---|---|---|
| 01 | loading | `aria-busy`, skeleton |
| 02 | empty | "No 3D concepts yet. The server has none for this account…" (dashed panel) |
| 03 | list (rev-2 fixture, 7 jobs) | Concept label, status, Result row; Open/Download only when a result exists |
| 04 | billing outcomes | one truthful line per outcome |
| 05 | polling | live region, 3–5 s |
| 06 | polling paused (429) | "Status checks paused." + Check status again |
| 07 | failed (provider codes) | safe one-line reason |
| 08 | submission_unknown | may have been charged; confirm-first note |
| 09 | 401 signed out | "Sign in to see your 3D concepts.", polling stops. No button: no host sign-in hook in this state (see 30) |
| 10 | 403 page-wide | "This account doesn't have permission to see these 3D concepts." Like signed-out (page-wide, polling stops) but **no sign-in button, link or text** and no Try again; re-shot 8 Oct after the wording change (AE-2) |
| 11–15 | network / 5xx / 429 / provider refused / provider unavailable | lead line "Your concepts couldn't be loaded. This doesn't mean you have none."; Try again on 11, 12, 13, 15, **not** on 14 (provider refused) |
| 16 | not configured 503 | no Try again |
| 17 | generation unavailable / budget | availability note from config; list still shown |
| 18 | malformed | no Try again |
| 19–23 | asset 409 not ready / 410 / 429 / 502 provider / 409 integrity | per-file messages; Try … again where retryable |
| 24–25 | Open 3D view / Download | SYNTHETIC GLB (sha256 `e2bec10b7995…`) |
| 26 | reference thumbnails | host `resolveReferenceThumbnail` hook; placeholder otherwise |
| 27 | long content | wrapping at 390 |
| 28 | after reload restored | real reload, MOCKED route |
| 29 | Open → 403 FORBIDDEN (INT-403) | the real viewer is disposed and its panel closed; the page-wide permission panel is the ONE alert; no sign-in wording |
| 30 | 401 with a host sign-in hook | "Sign in" button that calls the host's `onSignIn` (SYNTHETIC hook in the demo) |

A failed request never looks like an empty gallery (different panel, lead line).
Accessibility: `section` + `article` cards, text badges, `role=status` / `role=alert`, focus back to
the opener after Close 3D view (BUG-003), reduced motion honoured. **Every gallery control is at
least 44 × 44 CSS px at every width** (`.fcg-btn` `min-height` / `min-width: 44px`; AG's token file
has no tap-target token, so the value is literal; AG-5). The capture script and an e2e test fail on
any gallery button under 44 px; 390 px has no horizontal overflow. axe: 0 violations on 18 states ×
2 viewports.

### Page-wide 401 / 403 (QE INT-403, 9 Oct)

Any request that answers 401 or 403 sends the page page-wide: the list, a status check, Open, a
Download, or the viewer itself reporting `SIGN_IN_REQUIRED` / `FORBIDDEN` through `onError` (e.g.
after its own Try again). `goPageWide()` then **disposes the viewer and removes its panel**, clears
the announcer, stops polling and shows one panel. Result: exactly **one** announced alert (the
panel, `role=alert`); the viewer's own "Signing in again won't change that." can't linger. The
gallery wraps a host `viewerOptions.onError` (still called first) and defers the dispose one
microtask so the viewer is never disposed inside its own callback.

**AE viewer v3.1 (`22bf5bb`, CraZy's update 9 Oct).** A `FORBIDDEN` record now carries
`pageWide:true` in `getState().error`, the `"error"` event and `onError` (and `load()`'s result).
The gallery listens on **every** channel (`load()` result, `getState().error` after a failed load,
`onError`, `viewer.on("error")`, `viewer.on("statechange")`); `pageWide:true` alone is enough
(`isPageWideViewerRecord`), whatever the code; a 401-shaped record stays signed-out. Whichever
channel comes first wins: the others are no-ops once that viewer is closed, `goPageWide()` doesn't
re-dispatch an identical page-wide state, and `renderBody` keeps the same error panel node across
re-renders, so the `role=alert` panel is **inserted (announced) once**. The viewer announces its own
single alert before the gallery disposes it; that node leaves with the viewer, so the page ends
with exactly one permission announcement. Tests count the live-region writes:
`tests/projects/viewerPageWide.test.js` (each channel and all at once, late reports from a disposed
viewer, a no-flag control, and the REAL viewer, which on v3.1 also asserts `pageWide:true` on
onError, the event and statechange) and the e2e "QE INT-403" (MutationObserver: gallery writes = 1).

### Download file name (QE, 9 Oct)

Always `furniai-concept-<jobId>-<index>.<fmt|bin>` (job id sanitised to `[A-Za-z0-9_-]`, 64 chars;
format to `[a-z0-9]`, 8 chars; `conceptFilename()`). The source's `filename` is used only if it is
already that exact name for the same job and output (`downloadFilename()`). Browsers ignore
`<a download>` for a cross-origin address, so the **default** download reads a cross-origin file
once (`credentials: "omit"`, `cache: "no-store"`) and saves it from a local `blob:` address under
the FurniAI name, revoked after 10 s. If the browser won't let the page read the file (no CORS),
it falls back to one plain link; only then can the browser pick the provider's name (Claude U7:
CDN CORS). A host `startDownload` receives the FurniAI name.

### Sign in (QE PJ-I)

The gallery takes an optional `onSignIn` hook. With it, the **401** panel shows a "Sign in" button
that calls it; without it the text stays. **403 never** gets one. AG's page has `openAuthModal()`
(index.html ~l.4941) but no agreed public hook, so MOUNT_PROPOSAL.md proposes
`onSignIn: () => openAuthModal()` for AG to confirm (AG-6). The gallery invents no navigation.

## 7. Thumbnails

Contract rev 2 has no thumbnail or reference-preview field. The gallery accepts an optional host
hook `resolveReferenceThumbnail({ referenceId, jobId, signal })`; URLs are held in a local Map
(never in state or storage) and only `http(s)`, `blob:` and `data:image/` are accepted. Without
the hook or on error: a "Concept / No reference preview" placeholder (Claude request C-2).

## 8. Design tokens and layout

Tokens from `src/styles/design-tokens.css` (AG `8744d07`), each with its value as fallback, plus
`--bek-green-light`, `--bek-green-border`, `--font-serif` in rev 2. Exported as
`CONCEPT_GALLERY_TOKENS`; all selectors under `.fcg`. Grid: 3 columns at 1440, 1 column at 390.

## 9. Bundle entry (for CraZy)

`src/lib/projects/conceptGallery/entry.js` (version `concept-gallery/3-rev2`), not wired:
`scripts/build-static.mjs` is CraZy's.

```js
{ entryPoints: [resolve(root, "src/lib/projects/conceptGallery/entry.js")], bundle: true, format: "iife",
  globalName: "FurniConceptGallery", outfile: resolve(root, "concept-gallery.js") }
```

## 10. Tests (box, 9 Oct 2026, QE follow-up)

```
npx vitest run --config tests/projects/vitest.config.js      # 13 files, 266 passed (SIMULATED fixtures)
npx vitest run                                               # root: tests/projects all pass; see below
npx playwright test -c tests/projects/e2e/playwright.config.mjs  # 100 passed, desktop-1440 + mobile-390, axe on 18 states (SYNTHETIC/MOCKED)
npx eslint src/lib/projects tests/projects docs/m3/projects/demo # clean
node docs/m3/projects/demo/capture.mjs                       # 60 SYNTHETIC screenshots (30 + 30), fails if any gallery button < 44px
```

**Viewer used.** On this branch the gallery mounts the asset viewer present here (v2.1). The
same commit was also run on a throwaway merge `e62020f + 1bb8b59 (AE viewer v3) + 03fd0dea (QE)`
with `src/lib/assetViewer` + `tests/assetViewer` taken from AE v3.1 (tree `154bf48`, identical to
`22bf5bb`'s): module 266/266 and e2e 100/100 against the **real v3.1 viewer**, and
`tests/projects/qeReview.test.js` drives the **real** viewer through AE's
`tests/assetViewer/helpers/mountHarness.js` (real three + GLTFLoader, fake GPU) — not a fake.

Root `npx vitest run` on this branch: 2095 passed, 129 failed, 4 skipped, 20 todo. **All 129
failures are in `tests/acceptance/scenario/**`** (not owned here; they need viewer v3 / the
candidate backend) and fail the same way on the base.

Root `npx vitest run` on the v3.1 merge: 2341 passed, **1 failed**, 4 skipped, 20 todo (v3 merge
before the v3.1 update: 2313 / 1). The one
failure is QE's `galleryViewer.acceptance.test.js` "Open and Download NEVER retry … 403/404 lock
the card": its helper waits for the viewer status after a 403, but INT-403 now disposes the
viewer and closes the panel (intended). QE needs to update that test (QE-1 below).

- `creativeContract.test.js` (9 tests, SIMULATED): real `api/creative.js`, memory store, provider
  stand-in that throws for any other host. Rev-2 fixes: Claude's SYNTHETIC PNG instead of magic
  bytes, `billingOutcome` asserts; new: bare PNG signature → `422 INVALID_IMAGE`, real PNG → 201
  (`validation: "decoded"`), `PRIOR_SUBMISSION_UNKNOWN` → resend with `acknowledgeUnknownCharge` →
  202, `getConfig` → ready with `maxCostPerJob` 20; the list runs through `createCreativeJobsClient`.
- `rev2Brief.test.js` (66): jobs client, reload restore + storage spy, error vs empty, no-auto-retry
  counts, budget/config/429/provider wording, every billingOutcome, PRIOR_SUBMISSION_UNKNOWN,
  concept vs design (DesignsApiClient trap), Open/Download table, thumbnails, 50 cap.

## 11. Open requests and questions

**Claude (via CraZy):** C-1 list pagination beyond 50 · C-2 a reference-preview / thumbnail field
or endpoint · C-3 let `GET jobs` refresh unfinished jobs (today N jobs = N `getJob` calls per
round) · C-4 resolve §2.5 "call it again once" vs user-initiated retries only · C-5 say what 403
means on `/api/creative` (page-wide vs per job).

**Antigravity (via CraZy):** AG-1 export a generic authed JSON request / `authHeaders` from the
designs client · AG-2 expose the token helper under a stable name (e.g.
`window.FurniAuth.getAccessToken`) · AG-3 agree the mount point (MOUNT_PROPOSAL.md) · AG-4 link
`design-tokens.css` on the page; are `--status-*` right for job status? · **AG-5** add a
tap-target token (e.g. `--tap-min: 44px`); the gallery uses a literal `44px` until then ·
**AG-6** confirm wiring `onSignIn: () => openAuthModal()` at mount (index.html has
`openAuthModal()` but no agreed public hook); without it the 401 panel keeps text only.

**Quality Engineer:** QE-1 update `galleryViewer.acceptance.test.js` (403/404 lock): after a 403
the viewer is disposed and the panel closed, so don't wait on `viewerStatus()` · QE-2
`e2e.flows.spec.js` flow 10b calls `succeeded`, which is only defined inside flow 10, so the
KNOWN_DEFECT `test.fail` passes on a ReferenceError; with a local copy of the helper (throwaway
worktree only) flow 10b passes on desktop and 390 with this fix and fails on e62020f.

**Asset Engineer:**
- AE-1 (`autoRetry` opt-out): **RESOLVED** by AE viewer v3 `1bb8b59`. `autoRetry` defaults to
  off, and the gallery passes `autoRetry: false` explicitly at mount and on each `load()`.
- AE-2 (`FORBIDDEN` page-wide): **RESOLVED**, confirmed by AE. Rev 2 never returns a per-job
  403; it comes from infrastructure. The gallery treats it like signed-out without a sign-in
  prompt. Since the QE follow-up, a `FORBIDDEN` reported by the viewer itself (`onError`) also
  disposes it and closes into the page-wide panel with one alert; with v3.1 the gallery also acts on
  `pageWide:true` from every channel. Note for AE (resolved in v3.1, which dropped it): the viewer's own `FORBIDDEN` text in `src/lib/assetViewer/errors.js` still
  says "Signing in again won't change that."; the gallery never shows it (it closes into the
  page-wide panel).

## 12. Replica skills used

The `replica-build`, `replica-test` and `replica-diff` skill folders were **read** (read-only) and
followed. The Windows PC went offline mid-task, so they were read from a byte copy on the box
(`/workspace/replica-skills`, SHA-256 recorded for comparison with the Windows originals). The two
replica-diff tools were **copied to a temp dir** (`/tmp/replica-diff.z8ay/`) and **run directly**:
`imgdiff.py` (layout mode, 11 rev-1 → rev-2 screens, `rev2/diffs/*.json|.layout.png`) and
`parity.py rev2/features.csv --visual rev2/diffs/*.json --markdown > rev2/parity.md` (features
94.3, must-haves 25/26). replica-test gave [rev2/TEST_PLAN.md](rev2/TEST_PLAN.md) (case IDs F01–F10)
and [rev2/BUGS.md](rev2/BUGS.md); replica-build gave the state list, 390/1440 and the token rules.
