# Scenario 3D concept generation — acceptance evidence (Grok QA)

**Author:** Grok Quality Engineer. **Date:** 2026-10-04, Asia/Dubai (GST, UTC+4).
**Branch:** `grok/scenario-acceptance` (local only, **not pushed**).
**Base:** `integ/scenario-candidate` = `485f8a691d3890e4b47bd7cb65b6f6efa2d53220` (§1–§8); the
follow-up (§0) is verified on `ce3626a` + Projects `53f4384` (contains Asset `b34e259`)
(`42c3fa6` + Projects concept gallery `34f80a7` under `src/lib/projects/**`, not attached to any page).
**Contract under test:** `docs/creative/SCENARIO_3D_API_CONTRACT.md` — **status PROPOSED**.

> **What this is not.** Nothing here is a Scenario demo. No request reached Scenario, nothing
> was billed, no hosted database was used, no secret was read. The browser layer runs against a
> **TEST HARNESS** page, not the FurniAI product UI. Neither the asset viewer v2 nor the concept
> gallery is attached to any product page at `485f8a6`.

## 0. Follow-up — candidate `ce3626a` + Projects `53f4384` (contains Asset `b34e259`)

**Candidate:** `integ/scenario-candidate` = `ce3626ae395ac8b21e6fcad76691aea0ae958910` (485f8a6 +
this branch's 687f20a; tree identical to 687f20a). **Verified against a throwaway local merge**
`ce3626a` + `grok/projects-assets` **`53f438458c73920558ac1ba98d65ccd87e705316`** (tree `9d23a8e0…`),
deleted afterwards. `53f4384` = `6d0adfd` (G1/G2) → `c862c6e` (collector deleted) → `ae7af53`
(merge of `grok/asset-viewer` **`b34e259`**, tree `f2dac04f`; second parent verified = `b34e259`) →
`53f4384` (v2.1 adoption). `src/lib/assetViewer` tree is `6aba98a0` in `b34e259`, `ae7af53` and
`53f4384` alike, so merging `b34e259` on top is a no-op. All refs arrived as git bundles of **refs**
(not bare SHAs), sha256-checked on both sides; the Windows temp bundles were deleted.

**Scope review.** `b34e259` vs `7eaa414`: `src/lib/assetViewer/**` **plus** `docs/m3/asset-viewer/**`
and `tests/assetViewer/**` (new `creativeRetry.test.js`; edits to `creativeSource`/`creativeViewer`
tests). `53f4384` vs `34f80a7` (own commits): `src/lib/projects/**`, `docs/m3/projects/**` (incl.
two PNGs) **plus** `tests/projects/**` (new `assetFailures.test.js`; edits to assets, gallery,
polling, state, viewer tests, `helpers.js`, `fixtures/fakeViewer.js`), and deletes the
`conceptGallery.collect.test.js` collector (→ C5). The gallery imports exactly one Asset symbol,
the pure `isRetryableResolveError`. No backend, `api/**`, `index.html`, migration or root-config change.

### Status of the findings
| ID | Status on the merge | Evidence (test) |
|---|---|---|
| **G1** | **FIXED** — integrity (and missing-job, 403) from Open or Download makes the card job-errored: badge "Integrity check failed", `data-error=integrity`, the job text, **no Open and no Download**, `jobErrors {kind:"integrity"}`, spinner 0 | `G1 FIXED (was KNOWN_DEFECT …)` (flipped from `it.fails`); `RECORD_INTEGRITY_FAILED from Open …`; `RECORD_INTEGRITY_FAILED from Download …` (1 call, nothing downloaded, Open unreachable); `integrity found by the action path (Open) and by the poll path give the SAME card state` (only `data-status` differs: the server status) |
| **G2** | **FIXED** — an Open whose resolve fails on 5xx says `MSG.serverAsset`, never "Downloading it may still work" | `Open re-resolves ONCE on a transient resolve failure …` |
| **V1** | **FIXED** — `load()` re-resolves exactly once on network, 5xx and 429 (phase `retrying`), never a third time; never on 400/401/402/403/404/409/410, `*_NOT_CONFIGURED` or a malformed 2xx | `viewerV21`: `V1 load()` × 5 kinds (network, real 502, real 429, 503 no code, 500 INTERNAL); `V1/V5: NO retry on 4xx` × 10 kinds |
| **V2** | **FIXED, with caveat N1** — a malformed 2xx (not JSON, `ok:false`, no asset, no/non-http url, other job/index) is `RESOLVE_MALFORMED` (`cause:"malformed"`, never retried); a transport failure is `RESOLVE_FAILED` (`cause:"network"`) | `V2 RESOLVE_FAILED vs RESOLVE_MALFORMED` × 9 |
| **V3** | **FIXED** — a blank/missing notice falls back to text **equal** to the server's `CONCEPT_NOTICE.notice` | `V4 …` blank / no field / no concept |
| **V4** | **FIXED** — 403 `UNAUTHORIZED`, bare 403 and a 403 HTML page → `FORBIDDEN` with its own message; 401 stays `SIGN_IN_REQUIRED` | `V3 403 is FORBIDDEN …` × 4 |
| **V5** | **FIXED** — `download({jobId,index})` re-resolves exactly once on the same transient kinds (`attempts {resolve:2}`), fresh address, viewer state untouched; no retry on 4xx/malformed | `V5 download()` × 5; `V1/V5: NO retry on 4xx` |
| V6 (`renderConceptNotice`) | **works** — default/true: one overlay copy, verbatim; false: overlay empty + `data-av-concept-host-rendered`, `getState().concept.notice` still the server text, in ready and error states. **The gallery passes `false`** and shows the notice once, in its panel, before/after load and after an error | `V6 renderConceptNotice` × 3; `V6 + gallery: …renderConceptNotice:false…` |
| notice verbatim | **works** — a 2 kB notice with leading/trailing spaces, tabs, newlines and markup-like text reaches state, overlay and `download().concept` byte-for-byte | `V4 … never trimmed, collapsed, truncated or rewritten` |

Projects' three claims for the 687f20a suite on `53f4384` were checked independently against the
contract, not copied: the 687f20a suite gives **111/114** there (reproduced); (1) G1 → `it`: the
contract makes `RECORD_INTEGRITY_FAILED` a property of the **record** (§3.7 "a row edited around the
API is refused"), so a job-level lock is the right reading (A7); (2) the integrity test's Download
button is now null — asserted, and the Download path got its own test; (3) Open on 502 now makes
**2** resolves (`[502, 502]`, `MSG.serverAsset`): §2.5 "if a load fails, call it again once" read
with v2.1's V1 rule — one retry, never two. Also asserted on the gallery's Open **and** Download:
`RESOLVE_MALFORMED`, 403 and 404 are **never retried** (1 call each); malformed stays per-file;
403/404 lock the card (403 = "Not allowed", lifted by the next good list); 410 stays per-file (the
card keeps Ready and both actions — §2.5 makes 410 about the file).

### New findings (follow-up)
| ID | Owner | Sev | Finding |
|---|---|---|---|
| N1 | Asset | Low (doc/brief) | `RESOLVE_FAILED` does **not** mean "network only": an unknown server code (e.g. 500 `INTERNAL`) is also `RESOLVE_FAILED`, with `details.cause:"http"` (documented in `creativeAsset.js`). Hosts must read `details.cause`, not the code. Test: `FINDING (not network-only) …` |
| N2 | Projects | Info | 403 locks one card ("Not allowed") until the next successful list; correct per CONCEPT_GALLERY.md §5 but the contract defines no 403 (A9). The earlier "lock across refresh" wording for integrity was corrected in 53f4384 (§5 row "integrity": the next refresh drops the row if the server still refuses it) — tested: a still-invalid row is dropped, a restored row comes back **Ready** (server truth, no sticky client lock) |
| N3 | Projects / Integration | Low | the gallery shows `PROVIDER_RATE_LIMITED` (429) as "FurniAI couldn't get this file." (no "try again in a moment"), unlike 5xx. Honest, but a rate limit is the case where "try again in a moment" is most true |
| N4 | Integration | Medium (gate) | C5 below — `tests/projects/**` is outside the root vitest run once the collector is gone |
| N5 | Grok QA (fixed here) | Low | `tests/fixtures/scenario/generate-fixtures.mjs` had a `#!` shebang and is imported by Vitest; on a CRLF checkout (`core.autocrlf=true`, Bekzod's Windows default) `#!/usr/bin/env node\r` breaks the import. Fixed in this commit (see below) |

### Counts (follow-up)
`:4173` checked free before each Playwright run; harness on 4417/4420, `reuseExistingServer:false`.
| Run | 3-way merge (`ce3626a` + `53f4384` [+ `b34e259` no-op]) + this commit | This branch's tip alone (= `ce3626a` tree + this commit) |
|---|---|---|
| `npx vitest run` | **1929 passed / 0 failed / 4 skipped / 20 todo** (1953; 126 files + 1 skipped) — `tests/projects/**` not included (C5) | **1915 passed / 45 failed / 4 skipped / 20 todo** (1984) — the 45 are exactly the new/updated v2.1 + G1/G2 tests below; everything else green |
| …scenario acceptance (`tests/acceptance/scenario`) | **161/161** (api 51 · tampering 42 · tamperingSupabase 7 · galleryViewer 20 · viewerV21 41); **26** `it.fails` KNOWN_DEFECT remain (D-series + api), G1 no longer one | 116 passed / **45 failed**: galleryViewer 8 (G1, both integrity paths, refresh/remount, action≡poll, Open 502 retry, no-retry malformed/4xx, V6+gallery) and viewerV21 37 (all but the 4 that 7eaa414 already satisfies). Expected: these assert v2.1 / 6d0adfd behaviour |
| `--config tests/projects/vitest.config.js` | **116/116** (8 files) — matches Projects' claim | n/a (old 73 run via the 34f80a7 collector, green) |
| Scenario Playwright harness | **25 passed / 0 failed / 4 skipped** (29; the 4 antigravity `test.fail` KNOWN_DEFECTs fail as expected) | **25 passed / 0 failed / 4 skipped** |

### CRLF (N5) fix in this commit
- `generate-fixtures.mjs` is now a pure module: no shebang, no CLI. The CLI moved to
  `generate-fixtures.cli.mjs` (no shebang; `node tests/fixtures/scenario/generate-fixtures.cli.mjs [--check]`).
  `manifest.json` changed only in its `note`. GLB bytes unchanged (sha256 of all 7 identical before/after,
  regenerated twice; `--check` all `ok`).
- `.gitattributes` (kept the patch rule) adds `tests/fixtures/scenario/*.mjs text eol=lf`, `*.json text
  eol=lf`, `*.glb binary` (`html-as.glb` is text-like and must never be converted) and
  `tests/acceptance/scenario/**/*.mjs text eol=lf`.
- Verified on three throwaway clones of this commit, each merged with `53f4384` (merge trees identical,
  `12c7afd1`): **LF clone** → `npx vitest run` **1929/0/4/20**; **`git -c core.autocrlf=true clone`**
  (every other text file checked out CRLF; the two generators, `manifest.json` and the harness
  `server.mjs` stay `w/lf`; `html-as.glb` stays `-text`; all 7 GLB sha256 identical) → **1929/0/4/20**,
  gallery config 116/116; **forced CRLF** on both generators (`sed 's/$/\r/'`) → scenario 161/161, full
  1929/0/4/20, `generate-fixtures.cli.mjs --check` all `ok`. **Control:** the 687f20a generator (with
  the shebang) forced to CRLF makes `api.acceptance.test.js` fail to load (`SyntaxError: Invalid or
  unexpected token`, 0 tests) — the defect this fixes. The clones were deleted.

## 1. Tracks

| Track | Status | What is real | What is stand-in |
|---|---|---|---|
| **SIMULATED** | run | `api/creative.js` + `src/lib/creative/**` (Claude, unmodified), over HTTP on 127.0.0.1 or in-process | the Scenario provider (`tests/acceptance/scenario/support/fixtureProvider.js`, protocol-compatible with `scenarioStandIn.js`) |
| **MOCKED** | run | the RLS/unique-index rules of `supabase/migrations/2026-10-04_creative_generation.sql` | PostgREST (`support/fakeSupabase.js`); the Scenario CDN (`https://cdn.fixture.invalid`, serving `tests/fixtures/scenario/*.glb`) |
| **LOCAL** | run | viewer v2 (`src/lib/assetViewer/**`, 7eaa414), concept gallery (`src/lib/projects/**`, 34f80a7), real three 0.166 + GLTFLoader, real Chromium, the real `index.html` (reference-panel check only) | fake GPU renderer / OrbitControls in Node; the gallery's fake DOM; local static servers on unique ports |
| **LIVE** | **NOT RUN** | — | needs Bekzod's explicit authorization, real Scenario credentials and a spend cap. `npm run scenario:discover` was **never** run (it reads `.env.local` and calls Scenario). |

The browser harness (`tests/acceptance/scenario/harness/`, port 4417, desktop 1280 + 390 px) is a
**TEST HARNESS**: its page shows a "TEST HARNESS" banner (asserted by every test), it is not
product UI, and it exists only because no product page uploads a reference to `/api/creative` or
mounts the viewer/gallery.

## 2. Counts — candidate baseline vs this branch (both on `485f8a6`)

Static-server runs: `:4173` was checked free before each run (`ss -ltn`), and every run used its
own port with `reuseExistingServer:false` (scenario harness 4417, reference-panel page 4420,
browser suite 4418 on the branch / 4419 on the clean candidate worktree).

| Track | Candidate `485f8a6` (clean worktree) | This branch (tip) | Delta |
|---|---|---|---|
| `npx vitest run` | 122 files passed, 1 skipped · **1799 passed / 0 failed / 4 skipped / 20 todo** (1823) — matches Integration's baseline | 126 files passed, 1 skipped · **1913 passed / 0 failed / 4 skipped / 20 todo** (1937) | +114 tests, all in `tests/acceptance/scenario/**`; the 123 non-scenario file results are **identical** line by line |
| …of which scenario acceptance (vitest) | — | api.acceptance 51 · tampering 42 · tamperingSupabase 7 · galleryViewer 14 = **114**, **27** of them `it.fails` KNOWN_DEFECT | +14 (gallery/viewer) since the 42c3fa6 report (100, 26 it.fails) |
| …the 4 skipped (both sides) | `tests/wardrobe-ai/evals/live.eval.test.js` (live eval, skipped without credentials) | same | 0 |
| …of which Projects gallery suites (`tests/projects/**`, via the collector) | 73 passed | 73 passed (also 73/73 with `--config tests/projects/vitest.config.js`) | 0 |
| Scenario Playwright TEST HARNESS (`playwright.scenario.config.js`) | n/a (branch-only) | 29 tests: **25 passed / 0 failed / 4 skipped**. desktop: 10 passed + 2 BLOCKED `test.fixme`; 390 px: 10 passed + 2 BLOCKED; antigravity-ui (real `index.html`): 1 CURRENT_BEHAVIOUR passed + 4 `test.fail` KNOWN_DEFECT failing as expected (Playwright counts those as passed). The view leg on the real viewer v2 is part of the desktop and 390 px projects | — |
| Existing editable-builder subset (`customer-workflow-e2e`, `studio-redesign-persistence`; sanitized copies) | 4 passed / 0 failed | 4 passed / 0 failed | 0 |
| Existing browser suite, full (`tests/browser/*`, sanitized copies, `playwright.regression.config.js`) | 103 tests: **88 passed / 13 failed / 2 skipped** (30.6 min) | 103 tests: **88 passed / 13 failed / 2 skipped** (30.6 min) | 0 — the 103 per-test outcomes were diffed and are identical; the same 13 fail on the clean candidate |
| `npm run docs:check` | exit 1 (3 pre-existing broken `file:///` links in `docs/artifacts/studio-redesign-delivery/DELIVERY.md`) | exit 1 — the same 3 links only; this document adds none | — |

"Sanitized copies": `tests/acceptance/scenario/regression/sanitize-browser-specs.cjs` copies
`tests/browser/*` to the self-ignored `.qa-sanitized/browser/`, deletes every line that copies
screenshots into `C:/Users/xalim/.gemini/antigravity/brain/...` and redirects `docs/**` evidence
writes under `test-results/`. Nothing else changes; `site.spec.js` itself is not modified.

## 3. Gallery + viewer acceptance (new on 485f8a6)

`tests/acceptance/scenario/galleryViewer.acceptance.test.js`, modelled on
`tests/projects/creativeContract.test.js`. Real handler over HTTP, real
`createCreativeAssetSource`, real `mountAssetViewer` v2 (real three + GLTFLoader, fake GPU),
real `mountConceptGallery`; MOCKED provider + CDN. Test-side plumbing only: the list client
(no product list client exists) and the viewer's CDN fetch mapping `cdn.fixture.invalid` to
the fixture server. Storage spies assert nothing is written to local/sessionStorage.

| # | Test (name prefix) | Result |
|---|---|---|
| 1 | "a succeeded job appears in the gallery with its real asset" | green — card `succeeded`/"Ready", Files "GLB", aria-hidden placeholder tile (the contract has **no thumbnail**), no `<img>`; Open → 1 `?resource=asset` (`cache:"no-store"`), 1 CDN fetch, bytes SHA-256 = `textured-cube.glb` from the manifest; viewer `ready`, `openInBuilder/export/production:false`; `concept.notice` in the viewer panel; no address in gallery state, DOM or viewer state |
| 2 | "a job generated while the gallery is open is polled" | green — processing card has no Open/Download; `getJob` poll (~3 s) → succeeded, polling stops, Open works |
| 3 | "resolved FRESH on every open and download, never cached" | green — every issued address is revoked between opens and the next Open still loads; 2 opens + 2 downloads = 4 resolves, 4 distinct addresses |
| 4 | "one retry on a failed load" | green — 1 dead address → re-resolved once and shown (`attempts {resolve:2, display:2}`); 2 dead → `ASSET_DISPLAY_FAILED` after exactly 2 resolves, Download still enabled |
| 5 | "one retry on a transient resolve failure for Download" | green — 502 then 200 → one download; 502 twice → honest server message, no download, no third call |
| 6 | ~~"CURRENT_BEHAVIOUR Open does NOT retry a transient resolve failure (502)"~~ → **"Open re-resolves ONCE on a transient resolve failure"** (follow-up) | green on the §0 merge — 502→200 shown (`attempts {resolve:2, display:1}`); 502,502 → `MSG.serverAsset`, not "Downloading it may still work", exactly 2 resolves, card stays Ready (A1 settled by v2.1 V1; G2 fixed) |
| 7 | "expired (410 ASSET_UNAVAILABLE)" | green — "no longer available … no stored copy" for Open and Download, no model, no retry, no CDN fetch |
| 8 | "not ready (409 ASSET_NOT_READY)" | green — honest message, no model, no address retry, one `getJob` re-check, card becomes "Generating" without Open. Reaching 409 for a card held as succeeded needs a non-monotonic row; status is unsigned (D1b), so the test flips it |
| 9 | "RECORD_INTEGRITY_FAILED from Open is never rendered as a usable asset" (follow-up: was "…Download starts nothing") | green on the §0 merge — no model, no provider asset call, no CDN fetch; the card then has **neither Open nor Download** (the old test clicked Download, which no longer exists); Refresh drops the row. The Download path is its own test (§0) |
| 10 | "RECORD_INTEGRITY_FAILED while polling" | green — badge "Integrity check failed", no Open/Download, polling stops, provider never asked |
| 11 | "G1 FIXED (was KNOWN_DEFECT …)" | **`it`** (flipped in the follow-up) — green on the §0 merge; fails on `ce3626a` alone, as expected |
| 12 | "submission_unknown shows 'May have been charged' with NO button on the card" | green — exact copy `May have been charged. ` + `SUBMISSION_UNKNOWN_WARNING`; zero buttons on the card, the only control on the gallery is the list Refresh; after Refresh and a full poll interval: only GETs, zero `getJob`, zero asset calls, provider counters unchanged, generate = 1 |
| 13 | "owner isolation" | green — user B's gallery is empty; B's resolver and `getJob` for A's job → 404 `MISSING_JOB`; B's viewer shows no model; no provider/CDN call |
| 14 | "reopen" | green — after `destroy()` (viewer disposed, DOM removed) a new gallery lists the concept from the server and Open resolves a **new** address (old ones revoked) with the same bytes |

**Save / reopen.** Reopen = re-list from the server + fresh resolve (test 14). **Save is a GAP:**
neither the contract (§1: "the API never links a concept to a `designId`") nor the gallery
defines saving a concept to a project or design. The list is capped at the newest 50 jobs (§2.4),
so older concepts silently leave the gallery.

## 4. Tampering defects (summary — full repro already sent to Integration)

Root cause: `src/lib/creative/creativeService.js:55` signs only ids
(`jobId, userId, referenceId, modelId, providerJobId, outputs[].assetId`). `status`,
`idempotencyKey`, `createdAt`, `error`, `outputs[].format/mimeType`, costs and timestamps are
unsigned, yet routes, the billing guard and `settleStale` act on them; and the migration lets the
owner INSERT/UPDATE their own `creative_jobs` rows through PostgREST
(`supabase/migrations/2026-10-04_creative_generation.sql:70-73`).

| # | Severity | Tests (exact names) |
|---|---|---|
| D2 signature laundering: a forged row is re-signed by the submit path; user A gets a URL for user B's asset (+ a paid call) | **Critical** | `KNOWN_DEFECT D2 a forged row must stay refused after the submit path touches it; a foreign asset must never resolve` · `KNOWN_DEFECT D2-e2e a forged row must never become valid, and user A must never get user B's asset` |
| D1c / D1d / D1f second PAID call (status→failed, createdAt pushed back, idempotencyKey renamed) | **High (billing)** | `KNOWN_DEFECT D1c BILLING: active job edited processing→failed must NOT unlock a second paid generation` · `KNOWN_DEFECT D1c-e2e a status the owner wrote via PostgREST must not unlock a second paid generation` · `KNOWN_DEFECT D1d submitting row with createdAt pushed into the past must NOT release the active slot (second paid call)` · `KNOWN_DEFECT D1f idempotencyKey edited: the original key must still never cause a second paid call` |
| D3 overlapping polls write a stale signature → paid result permanently 409 | **High** | `KNOWN_DEFECT D3 after two overlapping polls the succeeded job must still be readable and downloadable` |
| D1a / D1b / D1e forged status accepted; "may have been charged" erasable | Medium-High | `KNOWN_DEFECT D1a status edited processing→succeeded must be refused (409 RECORD_INTEGRITY_FAILED)` · `KNOWN_DEFECT D1b status downgraded succeeded→processing must be refused with no provider call` · `KNOWN_DEFECT D1e submission_unknown edited→failed must be refused (the 'may have been charged' warning must not be erasable)` |
| D1-coverage 13 unsigned fields accepted | Medium | `KNOWN_DEFECT D1-coverage <field> edited on a succeeded job must be refused (409)` × status, idempotencyKey, error, outputs[0].format, outputs[0].mimeType, estimatedCost, reportedCost, providerStatus, providerProgress, createdAt, submittedAt, completedAt, lastPolledAt |
| D6 poll throttle is check-then-act | Medium (enables D3) | `KNOWN_DEFECT D6 a CONCURRENT burst of 8 polls must still make at most 1 provider status call (§2.4 'at most once per 2 s per job')` |
| D5 double-click upload on the durable path loses one referenceId | Medium | `KNOWN_DEFECT D5 two identical uploads at once (double-click) must both yield a usable referenceId` |
| D4 provider 410 for an asset → 502 instead of 410 | Low-Medium | `KNOWN_DEFECT D4 provider answering 410 Gone for the asset must map to 410 ASSET_UNAVAILABLE` |

Each KNOWN_DEFECT was checked by running it as `it`: it fails on its contract assertion. The
GUARD tests (signed-field edits, stripped/borrowed `sig`, swapped/re-owned rows, client-supplied
status/ids) are green.

## 5. Defects by owner

### Claude Code — backend (`api/creative.js`, `src/lib/creative/**`, migration)
| ID | Sev | Where | Fix direction |
|---|---|---|---|
| D2 | Critical | `creativeService.js:135-138` (conflict row → `settleStale` with no signature check), `:61-66` (`update()` re-signs) | verify every row before acting; never sign an unverified row |
| D1c/D1d/D1f | High | `creativeService.js:55`; `memoryStore.js:29`; migration `:61-63` (active index on unsigned `status`), `:70-73` (owner INSERT/UPDATE); `settleStale` `:74-82` | sign the whole row; remove owner write policies (service role / SECURITY DEFINER RPC) or make reservation refuse unverifiable rows |
| D3 | High | `creativeService.js:61-66`; `memoryStore.js:47-52`; `supabaseStore.js:83-86` | compare-and-set on `updated_at`/version; sign what is stored |
| D1a/b/e, D1-coverage | Medium-High / Medium | `creativeService.js:55`, used at `:164-183`, `:191-212` | canonical signature over all acted-on fields, or list exclusions in §3.7 |
| D6 | Medium | `creativeService.js:170-178` | claim `lastPolledAt` atomically before the provider call |
| D5 | Medium | `supabaseStore.js:42`, `:52-55` | on insert conflict re-read by (owner, sha256), return `reused:true` |
| D4 | Low-Medium | `scenarioClient.js:68-69` (only 404 sets `notFound`) | treat 410 as not-found for assets |
| B1 (viewer leg) | Low | `creativeService.js:251-259` `detectFormat` reads the URL extension/mimeType only | HTML served as `.glb` is reported `format:"glb"` and downloads as `.glb`; the viewer refuses it (harness test "HTML served as .glb …"). Document it in §2.4, or sniff/HEAD-check when a durable copy exists (U6) |
| B2 | Low | `creativeService.js:244` | failed jobs carry `error.code:"PROVIDER_GENERATION_FAILED"` (not in `CREATIVE_ERROR`, `errors.js`) and the provider's message verbatim; add the code and decide whether the text is customer-safe |

### Asset Engineer — viewer v2 (`src/lib/assetViewer/**`)
The view leg (harness, desktop + 390) is green on the real viewer: resolve per view, one
re-resolve on an expired/refused address then `ASSET_DISPLAY_FAILED` (no retry storm), HTML-as-.glb
sniffed and refused, 410 not re-called, `download({save:true})` re-resolves, the file passes the
GLB inspector, relative W:H:D only, `openInBuilder:false`. Findings:
| ID | Sev | Where | Fix direction |
|---|---|---|---|
| V1 — **FIXED in b34e259** (§0) | Low | `mountAssetViewer.js:682-687` — a 5xx/network failure of the **resolve** call itself is not retried; only display failures are (`RETRYABLE_DISPLAY_CODES`, `:81`) | decide with the contract owner (ambiguity A1); if "load" includes the resolve, retry once on network/5xx |
| V2 — **FIXED in b34e259**, with a caveat (§0 N1) | Low | `creativeAsset.js:183`, `:187`, `:204` — `RESOLVE_FAILED` with no status for both a network error and a malformed ok:true body | distinct code or `network:true` so hosts don't retry a malformed body |
| V3 — **FIXED in b34e259** | Low | `creativeAsset.js:46` `DEFAULT_CONCEPT_NOTICE` ("no separately editable parts") vs server `CONCEPT_NOTICE` `creativeService.js:30` ("doors or panels") | use the contract wording |
| V4 — **FIXED in b34e259** | Low | `creativeAsset.js:123` maps 403 → `SIGN_IN_REQUIRED`; the contract defines only 401 | align with the contract |
| V5 — **FIXED in b34e259** | Low | `viewer.download()` (`mountAssetViewer.js` ~`:857`) re-resolves but has no retry-once and only serves the loaded item | document, or add retry-once |

### Projects Engineer — concept gallery (`src/lib/projects/**`)
| ID | Sev | Where | Fix direction |
|---|---|---|---|
| **G1** — **FIXED in 6d0adfd, verified on 53f4384** (§0) | Medium | `mountConceptGallery.js:364` and `:481` re-check the job only for `ASSET_NOT_READY`; `render.js:218` keeps rendering outputs. After an asset-level `409 RECORD_INTEGRITY_FAILED` (Open or Download) the card still says **"Ready"** with enabled Open/Download. No mesh or file is ever served (test 9), but the card advertises a usable asset. Test: `KNOWN_DEFECT G1 after Open/Download returns 409 RECORD_INTEGRITY_FAILED the card must stop advertising the concept as Ready with Open/Download (mountConceptGallery.js:364/:481 re-check only ASSET_NOT_READY)` | on `INTEGRITY` / `NOT_FOUND` from `runAsset` / `openInViewer`, dispatch `JOB_ERR` for the job (as the poll path does at `:285`, `:320`) |
| G2 — **FIXED in 6d0adfd, verified on 53f4384** (§0) | Low | `mountConceptGallery.js:476-477` — an Open whose resolve fails with 5xx/network says "The 3D view couldn't show this file. Downloading it may still work." | map `SERVER`/`NETWORK` to `ASSET_MESSAGES` (server outage, not a file problem) |
| G3 | Info | `render.js:86-94` placeholder tile | correct per contract (no thumbnail field); a preview needs a contract change (A2) |
| G4 | Info / blocker for mounting | `mountConceptGallery.js:16-26` — the list client (`listJobs`) is injected and **no product implementation exists**; tests use a test-side adapter | owner decision (CONCEPT_GALLERY.md §10 Q1) |

### Antigravity — UI (`index.html`)
| ID | Sev | Where | Fix direction |
|---|---|---|---|
| **AG1 KNOWN_DEFECT: the reference panel is a client-side mock** | **High** | `index.html:4468` `CONCEPT_PALETTES` (canned titles + bundled stock photos `images/*.jpg`, `:4473-4500`); `:4508` `generateReferenceConcepts()`; `:4519` a fixed 600 ms `setTimeout`, **zero** network calls; `:4537` each card badged **"Scenario Visual Reference"**; `:4544` prints **W×H×D cm**; `:4547` "**Build to my sizes with this style →**"; `:4557` `applyConceptToBuilder(...)` loads it into the builder. Violates contract §1 (no dimensions, never into the builder) and labels stock images as Scenario output. Tests (`antigravity-reference-panel.spec.js`, real `index.html` on :4420, `/api/creative` stubbed 503, all non-local requests aborted): `CURRENT_BEHAVIOUR: Generate Visual Concepts makes ZERO /api/creative calls and renders canned cards with cm dimensions and a builder hand-off` (green) and four `test.fail`: `KNOWN_DEFECT contract §1/§2: the reference panel submits through /api/creative (upload + jobs)`, `KNOWN_DEFECT contract §1: a concept shows no real-world dimensions`, `KNOWN_DEFECT contract §1: a concept cannot be loaded into the builder`, `KNOWN_DEFECT: nothing is labelled a Scenario output unless it came from /api/creative` | wire the panel to `POST ?resource=references` + `POST ?resource=jobs` and show results through the gallery/viewer; drop dimensions and the builder hand-off for concepts; until then relabel the cards as examples, not Scenario output |
| AG2 | Blocker (for product acceptance) | `index.html` has no mount point or bundle for `FurniConceptGallery` / `FurniAssetViewer` (see `docs/m3/projects/MOUNT_PROPOSAL.md`) | mount per the proposal; then the harness tests re-run against the product page |

### CraZy — integration
| ID | Sev | Where | Fix direction |
|---|---|---|---|
| C1 | Medium (gate) | `npm run docs:check` fails on the candidate: 3 `file:///c:/Users/xalim/OneDrive/...` links in `docs/artifacts/studio-redesign-delivery/DELIVERY.md` | fix or exempt before calling the candidate green |
| C2 | Medium (gate) | the existing browser suite is not green on the candidate (13 failures, identical with and without this branch: 7 × `r3f-builder.spec.js` (the Next.js `/builder` server is not started by this config: "no real pixels ever rendered"), `capture-redesign-screenshots.spec.js:23` (hard-codes `http://127.0.0.1:4173` at `:26,40,76,93,102,110`, so it fails by construction off 4173), `exp01-integ-extras.spec.js:5`, `site.spec.js:1252` (#9), `:1726` (#26), `:1883` (#30), `studio-save-reopen-staleness.spec.js:77` (#1 REPRODUCTION, a documented-defect test), `webgl-context-stability.spec.js:122`) — see §2 | publish a browser baseline with the vitest baseline; split environment-dependent specs (`r3f-builder` needs the Next server) |
| C3 | Low | the requested `git bundle create … <bare SHA>` is refused by git ("Refusing to create empty bundle"); the bundle was made from `refs/heads/integ/scenario-candidate`, verified to point at `485f8a6` before bundling and after fetch | hand off a ref or tag, not a bare SHA |
| C4 — superseded by C5 | Low | root `vitest.config.js` include omits `tests/projects/**` and `tests/assetViewer/**`; they run only via `src/lib/projects/conceptGallery/conceptGallery.collect.test.js` and `src/lib/assetViewer/assetViewer.collect.test.js` (each warns of double runs if the glob is added) | add the globs and delete the collectors in one integration commit |
| **C5** | Medium (gate) | Projects deleted its collector in `c862c6e` ("root include is Integration's"), so on any merge containing `53f4384` the root `npx vitest run` **no longer runs `tests/projects/**` at all** (116 tests). They pass only via `npx vitest run --config tests/projects/vitest.config.js` (116/116 on the §0 merge). `tests/assetViewer/**` still runs through `src/lib/assetViewer/assetViewer.collect.test.js` | add `tests/projects/**/*.test.js` (and `tests/assetViewer/**/*.test.js`, deleting that collector in the same commit) to the root include; Grok QA did not touch the root config |

Antigravity's `db52d21` is not part of the candidate and was not used.

## 6. Contract ambiguities (the contract is PROPOSED)
- **A1 "if a load fails, call it again once" (§2.5).** Does a 5xx/network failure of the
  `?resource=asset` call count, or only a failed fetch/parse of `url`? The viewer retries only
  display failures; the gallery's Download also retries a transient resolve. Pick one.
  *Follow-up:* v2.1 (b34e259) and the gallery (53f4384) now both re-resolve once on network/5xx/429
  through one rule, `isRetryableResolveError`; the contract text itself is unchanged.
- **A2 No thumbnail / preview / prompt** in the job view (§2.4). The gallery shows a placeholder.
  Is a preview planned (it would need durable storage, U6)?
- **A3 `format` "read from the returned asset" (§2.4).** Today: URL extension or mimeType only,
  no content check — HTML served as `.glb` is `format:"glb"` (B1).
- **A4 Which fields the signature covers (§3.7).** Unsaid; today `status` and the billing fields
  are unsigned (D1/D2).
- **A5 Provider 410 vs 404** for a vanished asset (D4).
- **A6 409 `ASSET_NOT_READY` for a job the client already saw `succeeded`.** Unreachable by an
  honest flow; should the client treat it as a regression or as integrity?
- **A7 Integrity on the asset route vs the job.** Should an asset-level `RECORD_INTEGRITY_FAILED`
  mark the whole job unusable in the UI (G1)? The contract only lists the code.
- **A8 Save / reopen.** No save-to-project, no `designId`; the list is capped at 50 — are older
  concepts reachable at all?
- **A9 Auth codes.** Only 401 is defined; the viewer treated 403 as signed-out (V4). *Follow-up:*
  403 is FORBIDDEN in v2.1 and a job-level "Not allowed" state in the gallery (lifted by a list
  refresh) — still undefined by the contract.
- **A10 Who renders `concept.notice`** (viewer overlay vs host panel) — risk of showing it twice.
  *Follow-up:* settled in code — the gallery passes `renderConceptNotice:false` and shows it once
  in its panel (tested, §0).
- **A11 List refresh.** `GET ?resource=jobs` reads the store only, so N non-terminal jobs mean N
  `getJob` calls per round.
- **A12 Who owns the browser list client** (`listJobs`).
- **A13 Expiry/CORS/durability** — `expiresAt:null`, `expiryKnown:false`, CORS unverified (U7),
  no durable copy (U6); only LIVE can settle them.

## 7. Blocked
- **Viewer v2 and the concept gallery are not attached to any page** at `485f8a6`
  (`harness.spec.js` `test.fixme("viewer v2 / Projects gallery attached to a product page — BLOCKED …")`).
- **The real upload + Generate UI**: the only reference panel is the client-side mock (AG1)
  (`test.fixme("Antigravity's real upload + Generate UI wired to /api/creative — BLOCKED …")`).
- **No product list client** for the gallery (G4).
- **LIVE: NOT RUN** — needs Bekzod's authorization; U6/U7 (durability, CORS, expiry) stay unverified.
- **Hosted Supabase**: not used; PostgREST and RLS are MOCKED.

## 8. How to reproduce
```
npx vitest run                                                     # all tracks in-process
npx vitest run tests/acceptance/scenario                           # scenario acceptance only (114; 161 after the follow-up)
npx vitest run --config tests/projects/vitest.config.js            # gallery suites (not in the root include, C5)
npx playwright test --config=playwright.scenario.config.js         # TEST HARNESS (4417) + real index.html (4420)
SCENARIO_QA_STATIC_PORT=4418 npx playwright test --config=playwright.regression.config.js   # sanitized browser suite
```
Check `ss -ltn | grep 4173` is empty first. Never run `npm run scenario:discover`.
