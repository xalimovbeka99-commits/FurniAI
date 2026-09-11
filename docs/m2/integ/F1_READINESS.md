# F1 readiness report — Grok integration verification

**Date:** 2026-09-11 (Asia/Dubai)  
**Isolated checkout:** `C:\Users\xalim\FurniAI-F1-Candidate` branch `integ/f1-m2omit-candidate`  
**Bundle imported:** `f1-candidate.bundle` tip `d5c32aa` (verified) on prereqs `dfc72f8`, `337c7bf`, `206ee06`  
**Combined onto:** integ tip `81a641d` (not rolled back to Claude’s `90e3e84` base)  
**Draft PR:** https://github.com/xalimovbeka99-commits/FurniAI/pull/3  
**Main / production:** unchanged  
**Antigravity mobile:** not available on remote (still NEEDS FIXES)

## Evidence lanes (keep separate)

| Lane | What it proves | Status |
|---|---|---|
| **Parser / deterministic transport** | `proposeDesignChange` without model; width chip; drawer UNSUPPORTED | PASS (unit + Playwright customer-path) |
| **Isolated parser TEST SETUP** | `AiDesignerTransport` cleared on purpose | PASS (labels only; not customer-path claim) |
| **Simulated provider** | Integrity / stub-fetch suites from Claude | PASS (prior; not live) |
| **Live provider** | Real Anthropic path | **UNVERIFIED** (API credential blocker only for this lane) |

## F1 journey matrix

| # | Customer step | Result | Evidence |
|---|---|---|---|
| 1a | Design with AI nav → local draft | **PASS** | Playwright customer-path (no DOM/CSS hacks) |
| 1b | Live draft | **UNVERIFIED** | Live provider |
| 2–5 | Clear wardrobe / exact door / rails / material | **PASS** | Pointer door clicks (no `userData.base` writes); rails 19+2; chrome kept |
| 6a | Supported edit (deterministic transport) | **PASS** | Width chip via normal transport |
| 6b | Live edit | **UNVERIFIED** | Live provider |
| 8 | Undo after supported edit | **PASS** (customer-path) | Restored width/height/depth/finish/bays/doors/rails/group size |
| 9 | Unsupported drawers → explanation; design kept | **PASS** (integration review) | Transport entry + Playwright; alternativeApplied false; no revision bump. Not yet “complete unsupported-request fix” product acceptance beyond this boundary. |
| 10 | Narrow usable UI | **NEEDS FIXES** | Antigravity |

## SHA provenance
`docs/m2/integ/evidence/f1/SOURCE_SHA.txt` is written by Playwright from `git rev-parse HEAD` of the checkout under test. No hardcoded default tip.

## Recommendation
Candidate ready for Bekzod **integration review** of M2-OMIT + F1 acceptance checks. Mobile still Antigravity. Live AI still credential-gated. Stay on F1.
