# F1 unsupported-boundary reconciliation

**Date:** 2026-09-11 (Asia/Dubai)
**Candidate:** `integ/f1-m2omit-candidate`

## Conflict
Grok (PR #4 / `fcbbd2a`) and Claude (`8a865cf`, descendant of `d5c32aa`) independently wired the unsupported-request boundary.

## Retained implementation (Claude owns boundary)
From Claude tip `8a865cf1c50730f3c48a03de9d655387cc1c36d6`:
- `src/lib/conversation/componentRequests.js` — deterministic unsupported component requests (drawers, etc.), policy-backed wording/alternatives
- `src/lib/conversation/pipeline.js` — `unrepresentableComponents` refusal at `previewDraftWardrobe` / `approveAndPreview` / edit paths; no design replacement; no revision advance; alternative not applied; approval cannot override
- `src/lib/adapters/aiDesignerTransport.js` — maps unsupported[] to `RESULT_KIND.UNSUPPORTED` (not REJECTED / not DESIGNER_UNAVAILABLE)
- `src/lib/conversation/unsupportedRequestIntegration.test.js` — entry-point integration tests
- `componentOutcomes` ledger updates + accounting doc

**Why:** BEK assigned Claude ownership of the final boundary. Claude’s tip also covers kernel refusal including approval, shared policy source for parser+kernel explanations, negation / “light oak” regressions called out in the patch, and refuses unbuildable designs instead of previewing them with a silent missing part.

## Retained verification (Grok owns integration / browser)
Kept and improved on this branch (not discarded):
- `tests/browser/f1-journey.spec.js` — customer nav, pointer door clicks, parser TEST SETUP isolation, customer-path Undo, unsupported browser path
- Evidence under `docs/m2/integ/evidence/f1/` with SHA from `git rev-parse HEAD`
- `docs/m2/integ/F1_READINESS.md`

## Not blindly merged
- Grok’s inline `drawerRequest` block inside `parseConversationalCommand` was **replaced** by Claude’s `componentRequests.js` integration (same intent, Claude’s structure).
- Grok’s `unsupportedCustomerEntry.test.js` is **superseded** by Claude’s broader `unsupportedRequestIntegration.test.js` (covers proposeDesignChange, applyConversationalEdit, previewDraftWardrobe, approveAndPreview). Removed to avoid duplicate/divergent assertions on the same boundary.
