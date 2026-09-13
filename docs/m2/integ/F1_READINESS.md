# F1 readiness report — reconciled candidate

**Date:** 2026-09-13 (Asia/Dubai)  
**Branch:** `integ/f1-m2omit-candidate`  
**Isolated checkout:** `C:\Users\xalim\FurniAI-F1-Candidate`  
**Claude tip retained:** `e163a3d` (`f1-reconciled.bundle`)  
**Draft PR:** https://github.com/xalimovbeka99-commits/FurniAI/pull/4  
**Main / production:** unchanged  

## Boundary reconciliation
See `docs/m2/integ/RECONCILIATION_UNSUPPORTED_BOUNDARY.md` and `BOUNDARY_RECONCILIATION.md`.

- **Claude owns** final unsupported boundary from reconciled tip `e163a3d` (not a third parser).
- **Negation / `light oak` deciding fixes** are attributed to **`e163a3d`**, not solely to original `8a865cf`.
- **Grok owns** integration/browser verification: customer nav, pointer doors, assistant-bubble unsupported asserts (not the customer message), wait-until-finished, Undo canonical + panel finish `materialCode`.
- Mobile UI work remains Antigravity-owned; not overwritten by this import.

## Evidence lanes (report separately)

| Lane | Status |
|---|---|
| Parser / deterministic unsupported boundary | **PASS** (focused Vitest: unsupported integration + entry + finish parsing + outcomes) |
| Browser customer journey (Playwright F1) | see run on this tip |
| Mobile usable UI | **NEEDS FIXES** (Antigravity) |
| Live provider | **UNVERIFIED** (API credential) |

## F1 Playwright (this tip)
SHA stamped by test from `git rev-parse HEAD`.

1. Isolated viewer + pointer door clicks (mobile NEEDS FIXES noted, not claimed PASS)
2. Parser TEST SETUP draft/edit/Undo labels
3. Customer-path Undo: canonical identity + finishType + panel materialCode + rails + group size
4. Unsupported: **assistant** explanation after response finished; design retained
5. Negative proof: removing assistant bubble fails asserts; user bubble still present

## Recommendation
Ready for Bekzod integration review of reconciled F1 candidate. Stay on F1.
