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
Status: open, question AE-1 (option such as `autoRetry:false`)
