# F1 unsupported-boundary reconciliation

**Date:** 2026-09-13 (Asia/Dubai)
**Candidate:** `integ/f1-m2omit-candidate`
**Claude tip retained:** `e163a3d50db406bea293c7c90f7be6530f9bc550` (`f1-reconciled.bundle`)

## Conflict
Grok (PR #4) and Claude independently wired the unsupported-request boundary.
Claude then shipped reconciled tip `e163a3d` (descends from `88b03db`, not from Grok's later `0e67597` / `e13c9ff`).

## Retained implementation (Claude owns boundary)
From Claude tip `e163a3d` (reconciled), not a third parser:
- `src/lib/conversation/componentRequests.js`
- `src/lib/conversation/pipeline.js`
- transport + runtime bridge bundles aligned with that tip
- `unsupportedRequestIntegration.test.js` + restored `unsupportedCustomerEntry.test.js`
- Mojibake repairs in kernel/header comments from `e163a3d`

**Attribution:** Negation / `light oak` deciding fixes are in **reconciled** `e163a3d`, not attributed solely to original `8a865cf`. See `RECONCILIATION_UNSUPPORTED_BOUNDARY.md`.

## Retained verification (Grok owns integration / browser)
- `tests/browser/f1-journey.spec.js` (assistant-bubble asserts, wait-for-finished response, Undo canonical + panel finish)
- `index.html` `data-role` markers
- Evidence under `docs/m2/integ/evidence/f1/`
- `docs/m2/integ/F1_READINESS.md`

## Not written
No third competing parser. Grok inline drawer detection stays replaced by Claude's module.
