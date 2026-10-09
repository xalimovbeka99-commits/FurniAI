# Test plan: concept gallery rev 2 (replica-test format)

Build: `grok/projects-assets` on base `f472aef` (local commits, not pushed). Date: 2026-10-07.
Env: box, local demo server, **SYNTHETIC/MOCKED** data (e2e) and **SIMULATED** fixtures / provider
stand-in (unit). Nothing **LIVE**. Viewports: desktop-1440 (1440×900), mobile-390 (390×844).
Playwright with role/label selectors, console errors and 5xx responses fail the test, axe-core on
16 states per viewport.

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F01-H1 | list | happy | load rev-2 fixture (7 jobs) | 7 cards, Concept label, status, Result row; Open/Download only on the Ready card | e2e + unit | pass |
| F01-H2 | list | happy: billing | load billing-outcomes state | one truthful line per billingOutcome; no "free"/"no charge" on any state | e2e + unit | pass |
| F01-H3 | list | edge: submission_unknown | load state | "May have been charged", confirm-first note, no retry control | e2e + unit | pass |
| F01-N1 | list | negative: empty / loading | load empty, loading | distinct empty panel; aria-busy skeleton | e2e | pass |
| F02-H1 | download | happy | click Download | one fresh resolve per click; SYNTHETIC GLB saved | e2e + unit | pass |
| F02-E1 | download | edge: 410 | click Download | "no longer available"; card stays Ready; one call | e2e + unit | pass |
| F02-E2 | download | edge: 429 | click Download | ONE request; "Try download again" sends exactly one more | e2e + unit | pass |
| F02-E3 | download | edge: integrity 409 | click | card locks, no Open/Download | e2e + unit | pass |
| F02-E4 | download | edge: 502 PROVIDER_UNAVAILABLE | click | provider wording, one request, visible Try again | e2e + unit | pass |
| F03-H1 | open | happy | click Open 3D view, Close | AE viewer with notice; focus returns to Open (BUG-003) | e2e + unit | pass |
| F03-E1 | open | edge: viewer v3 autoRetry | open, fail once, Try opening again; older viewer | mount and every load() get `autoRetry:false`; a viewer that ignores it still opens | unit | pass |
| F04-N1 | keyboard | negative | Tab to Download, Enter | download starts | e2e | pass |
| F05-H1 | reload | happy | processing job on MOCKED route; reload page | card restored from GET jobs, polling resumes, turns Ready; no browser storage | e2e + unit | pass |
| F05-E1 | reload | edge: storage | spy on localStorage/sessionStorage | zero reads/writes | e2e + unit | pass |
| F06-E1 | error vs empty | edge | load 5xx, network, empty | failures say "doesn't mean you have none" + Try again; empty differs | e2e + unit | pass |
| F06-E2 | list retry | edge | list fails; wait; click Try again | nothing automatic; exactly one more request | e2e + unit | pass |
| F06-N1 | auth | negative: 401 / 403 | load | sign-in prompt / page-wide permission message, no Try again for 403 | e2e + unit | pass |
| F06-N2 | auth | negative: 403 page-wide | list / Open / Download answer 403 | permission panel; no sign-in button, link or text; 401 keeps "Sign in to see your 3D concepts." | e2e + unit | pass |
| F07-E1 | polling | edge: 429 | status check answers 429 | polling pauses, "Check status again" resumes | e2e + unit | pass |
| F07-E2 | polling | edge: 3 failures | 3 failed rounds | pause after 3; interval stays 3–5 s, no backoff | unit | pass |
| F07-E3 | polling | edge: terminal / destroy / hidden | | polling stops | unit | pass |
| F08-H1 | availability | happy/edge | config ready / off / unknown | budget line; "unavailable: why"; list still shown | e2e + unit | pass |
| F08-E1 | submit outcomes | edge | POST answers 402, 502 COST_UNVERIFIED, 503, 429, PROVIDER_*, PRIOR_SUBMISSION_UNKNOWN, network | wording + billing per §5 of CONCEPT_GALLERY.md; acknowledgeUnknownCharge on confirm | unit + contract | pass |
| F09-H1 | concept vs design | happy | load list | Concept label + notice on every card; no dimensions, no designId, no Studio link; DesignsApiClient never called | e2e + unit | pass |
| F10-H1 | thumbnails | happy/edge | host hook returns url / null / bad scheme / error | reference image or placeholder; only http(s)/blob/data:image | e2e + unit | pass |
| F10-E1 | list cap | edge | 50 jobs | truncated note | unit | pass |
| C-01 | contract | SIMULATED | real api/creative.js + stand-in | rev-2 shapes, INVALID_IMAGE 422, PRIOR_SUBMISSION_UNKNOWN → 202 with ack, config ready | contract (vitest) | pass |
| QE-INT403 | auth | negative: 403 anywhere | list / poll / Open / Download / viewer onError FORBIDDEN answer 403 | viewer disposed, panel closed, page-wide panel, exactly one alert, no sign-in wording | unit (real viewer) + e2e | pass |
| QE-V31 | auth | negative: viewer pageWide:true | FORBIDDEN flagged pageWide on load() result / getState() / onError / "error" event / statechange / all at once | viewer disposed, panel closed, page-wide 403; gallery writes the permission text into a live region exactly once; page ends with one | unit (stand-in + REAL v3.1) + e2e | pass |
| QE-PJ1 | retry | negative | 403, 404, malformed, invalid, integrity | no Try again; kept for network, 5xx, 429, provider unavailable, not ready | unit + e2e | pass |
| QE-NAME | download | edge | server filename / cross-origin URL | furniai-concept-<jobId>-<index>.<fmt|bin>, sanitised | unit + e2e | pass |
| QE-TAP | a11y | edge | 1440 and 390 | all buttons ≥ 44 × 44 px; no overflow at 390 | e2e + capture | pass |
| QE-SIGNIN | auth | edge: 401 | with / without injected onSignIn | Sign in button only with the hook; never on 403 | unit + e2e | pass |
| QE-WORDING | billing | edge | billing missing / unconfirmed | never implies no charge | unit + e2e | pass |
| A11Y | all | axe | 18 states × 2 viewports | 0 violations | e2e | pass |

Totals (9 Oct 2026, box, after the QE follow-up): module vitest 266/266 (SIMULATED; real viewer
via AE's harness in qeReview.test.js and viewerPageWide.test.js); Playwright 100/100 (50 per viewport, SYNTHETIC/MOCKED, axe on 18 states); ESLint clean;
root vitest on this branch: all `tests/projects` pass, 129 pre-existing failures in `tests/acceptance/scenario/**`.
On the throwaway merge with AE viewer v3 1bb8b59 + QE 03fd0dea, viewer files at v3.1 (22bf5bb tree): module 266/266, e2e 100/100 (real v3.1),
root 2341 passed / 1 failed (QE galleryViewer 403 test expects a live viewer; QE-1 in CONCEPT_GALLERY.md §11).
