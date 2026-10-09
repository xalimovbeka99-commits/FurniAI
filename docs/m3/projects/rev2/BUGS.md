# Bugs: concept gallery rev 2 (replica-test bug-report format)

Records for BUG-001 and BUG-002 were in the earlier scratch session and were not recovered with
the WIP; their fixes, if any, are in the history before `7f8932b`.

### BUG-003: Closing the 3D view loses keyboard focus

- Severity: S3
- Flow / case: F03 / F03-H1
- Screen: 24-open-3d-view
- Build: before `7f8932b`  Browser / device: Chromium (Playwright), 1440px and 390px

Steps
1. Tab to "Open 3D view" on the Ready card, press Enter.
2. Activate "Close 3D view".

Expected: focus returns to the "Open 3D view" button that opened the panel.
Actual: focus fell back to `<body>`.
Evidence: `tests/projects/viewer.test.js` "replica-test BUG-003 …"; e2e F03-H1.
Suspected cause: the panel re-render replaced the opener without restoring focus.
Status: fixed in 7f8932b

### BUG-004: Gallery retried asset calls automatically (against the 7 Oct user-initiated-only policy)

- Severity: S2
- Flow / case: F02 / F02-E2, F02-E4
- Screen: 21-asset-rate-limited-429-try-again, 22-asset-provider-unavailable-502
- Build: `1c50a42`  Browser / device: any

Steps
1. Download on a Ready card while the asset endpoint answers 429 (or 5xx / network).

Expected: exactly one request; a visible "Try download again" sends one more only when clicked.
Actual: a second resolve was sent automatically (immediate re-resolve on retryable errors, delayed
retry on 429).
Evidence: rev2Brief "no automatic retry" counts with fake timers; e2e F02-E2.
Suspected cause: rev-1 design copied AE's `isRetryableResolveError` rule.
Status: fixed in 3e5f79a (auto retry removed; Try again buttons; polling pauses instead of backing off)

### BUG-005: Open 3D view still re-resolves once automatically inside AE's viewer

- Severity: S3
- Flow / case: F03 / F03-H1
- Screen: 24-open-3d-view
- Build: `3e5f79a` with AE viewer v2.1  Browser / device: any

Steps
1. Open 3D view while the asset endpoint answers 502 once.

Expected (policy): one resolve, then "Try opening again".
Actual: AE's `load()` re-resolves once by itself (and retries the display once) before reporting.
Evidence: `tests/projects/viewer.test.js` notes the internal re-resolve; "Try opening again" adds exactly the user's calls.
Suspected cause: `src/lib/assetViewer` v2.1 V1 behaviour (not owned here).
Status: fixed: AE viewer v3 1bb8b59 adds `autoRetry` (default off); the gallery passes `autoRetry: false` at mount and on every load() (viewerV3.test.js). Older viewers keep their own retry.

### BUG-006: A 403 during Open or from the viewer left the viewer panel open (QE INT-403)

- Severity: S2
- Flow / case: F06 / F06-N2, QE-INT403
- Build: `e62020f` (QE review, merged with AE viewer v3 1bb8b59)  Browser / device: any

Steps
1. Open 3D view; the asset endpoint (or the viewer itself via onError FORBIDDEN) answers 403. Repeat for list, poll and Download.

Expected: viewer disposed, panel closed, page-wide permission panel, exactly one announced alert, no sign-in wording.
Actual: viewer panel stayed mounted behind/next to the page-wide panel; a second alert could be announced.
Evidence: qeReview.test.js (real viewer via mountHarness + SIMULATED fakes), viewer.test.js, e2e "QE INT-403" (SYNTHETIC/MOCKED), screenshot 29.
Update (AE viewer v3.1 22bf5bb): `pageWide:true` is honoured on every channel (load() result, getState().error, onError, "error" event, statechange); the gallery's own permission announcement is collapsed to one live-region write (viewerPageWide.test.js counts writes, incl. the REAL v3.1 viewer; e2e MutationObserver count).
Status: fixed in the QE follow-up commit on top of e62020f

### BUG-007: "Try again" offered where retrying cannot help (QE PJ-1)

- Severity: S3
- Flow / case: F06-E1 / F03, QE-PJ1
- Build: `e62020f` (QE review, merged with AE viewer v3 1bb8b59)  Browser / device: any

Steps
1. Make list / Open / Download answer 403, 404 (missing job), a malformed or invalid body, or fail integrity.

Expected: no Try again; kept only for network, 5xx, 429, provider unavailable, not ready (and the viewer display failures FETCH_FAILED / ASSET_DISPLAY_FAILED / WEBGL_CONTEXT_LOST, which a fresh resolve fixes).
Actual: Try again shown for 404 and malformed responses.
Evidence: qeReview.test.js, assets.test.js, rev2Brief.test.js it.each retry flags, e2e PANELS.
Status: fixed in the QE follow-up commit on top of e62020f

### BUG-008: Download used the server-suggested filename (QE)

- Severity: S3
- Flow / case: F03 Download, QE-name
- Build: `e62020f` (QE review, merged with AE viewer v3 1bb8b59)  Browser / device: any

Steps
1. Download where the asset response carries filename "asset_out_job_fx_1.glb" or a cross-origin URL.

Expected: saved as furniai-concept-<jobId>-<index>.<fmt|bin> (sanitised); d.filename only if it already matches.
Actual: server filename used; cross-origin <a download> name ignored by browsers.
Evidence: qeReview.test.js conceptFilename/downloadFilename, e2e "QE download name" (blob download, SYNTHETIC/MOCKED).
Status: fixed in the QE follow-up commit on top of e62020f

### BUG-009: Buttons under 44 px tap target (QE)

- Severity: S3
- Flow / case: A11Y, QE-tap
- Build: `e62020f` (QE review, merged with AE viewer v3 1bb8b59)  Browser / device: any

Steps
1. Measure gallery buttons at 1440 and 390.

Expected: every control at least 44 x 44 px, no horizontal overflow at 390.
Actual: small buttons ~30 px tall.
Evidence: e2e "QE tap targets" both viewports; capture.mjs fails on any visible button < 44 px.
Status: fixed in the QE follow-up commit on top of e62020f

### BUG-010: Billing "missing" wording implied no charge (QE info)

- Severity: S4
- Flow / case: F08-E1, QE-wording
- Build: `e62020f` (QE review, merged with AE viewer v3 1bb8b59)  Browser / device: any

Steps
1. Show a concept whose server reports no billing.

Expected: wording says the cost is unknown / may have been charged.
Actual: "no cost has been reported" read as no charge.
Evidence: rev2Contract.test.js uses BILLING_TEXT.missing; e2e F01-H2 asserts the new text.
Status: fixed in the QE follow-up commit on top of e62020f
