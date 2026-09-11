# F1 readiness report — reconciled candidate

**Date:** 2026-09-11 (Asia/Dubai)  
**Branch:** `integ/f1-m2omit-candidate`  
**Isolated checkout:** `C:\Users\xalim\FurniAI-F1-Candidate`  
**Draft PR:** https://github.com/xalimovbeka99-commits/FurniAI/pull/4  
**Main / production:** unchanged  

## Boundary reconciliation
See `docs/m2/integ/BOUNDARY_RECONCILIATION.md`.

- **Claude owns** final unsupported boundary: tip `8a865cf` (`componentRequests.js`, kernel `unrepresentableComponents` incl. approval refusal, transport → `UNSUPPORTED`).
- **Grok owns** integration/browser verification: customer nav, pointer doors, unsupported assistant-bubble asserts, Undo identity + panel materialCode.
- Grok’s inline drawer parser was **not** kept; superseded by Claude’s `componentRequests.js`.
- Grok’s `unsupportedCustomerEntry.test.js` superseded by Claude’s `unsupportedRequestIntegration.test.js`.

## Evidence lanes

| Lane | Status |
|---|---|
| Parser / deterministic transport | **PASS** (Claude integration tests + Playwright customer-path) |
| Isolated parser TEST SETUP | **PASS** (transport cleared on purpose; not customer-path) |
| Simulated provider | **PASS** (Claude integrity suites) |
| Live provider | **UNVERIFIED** (API credential) |
| Mobile usable UI | **NEEDS FIXES** (Antigravity; no extra assignment) |

## F1 Playwright (this tip)
5/5 PASS — SHA stamped by test from `git rev-parse HEAD`.

1. Isolated viewer + pointer door clicks  
2. Parser TEST SETUP draft/edit/Undo labels  
3. Customer-path Undo: envelope + proposalId/fingerprint + rail chrome + panel materialCode + group size  
4. Unsupported: **new** assistant bubble explains + offers alternative; design/revision retained  
5. Negative proof: removing that assistant bubble makes asserts fail  

## Recommendation
Ready for Bekzod integration review of reconciled F1 candidate. Stay on F1.
