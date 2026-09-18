# Browser acceptance checklist — tip `c48e108`

**Date:** 2026-09-18 ~19:30 GST (UTC+4)  
**Task branch:** `integ/m2-integration-lead` (docs)  
**Tip SHA:** `c48e108ab779a5b4fe36c8600f1dac38376d74c0`  
**Script:** `scripts/integ/browser-acceptance-checklist.mjs`

## Surfaces

| Surface | Kind | Result this follow-up |
|---|---|---|
| wardrobe-ai + production Vitest | Parser-only | **PASS** — 165 passed / 4 skipped (`--run-vitest`) |
| Phase 1 hash pins | Parser-only | **5 FAIL** (documented; no refresh) |
| `npm run lint` (eslint) | Static | **PASS** (exit 0) |
| Legacy static F1 Playwright | Browser | **NOT COMPLETED this run** (suite started; early fails / interrupted). Prior audit: **4/5**, static **Add drawers FAIL**. Treat as **OPEN**. |
| Next R3F Playwright | Browser | **7/7 PASS** after `npm run build` |
| Hosted Vercel preview | Browser remote | Deployment Ready for SHA `c48e108…`; URL SSO-gated (HTTP 302) — **not** customer-verified without SSO |

## Preview URL ↔ exact SHA (verified)

| Field | Value |
|---|---|
| GitHub Deployment id | `6467524341` |
| **SHA** | **`c48e108ab779a5b4fe36c8600f1dac38376d74c0`** |
| ref | same as SHA (detached deploy ref) |
| environment_url | https://furniai-builder-4ogolldo5-xalimovbeka99-commits-projects.vercel.app |
| state | success |
| Branch alias (PR comment; not SHA-proof alone) | https://furniai-builder-git-integ-e0683a-xalimovbeka99-commits-projects.vercel.app |

## Known static Add drawers failure

F1 `Add drawers on the left` expects STRUCTURAL success; prior M2 audit: static conversational surface still refuses. Parser/Vitest DRAWER_BANK path is green. **Owner:** Integration + static transport owners — surface lag, not pin refresh.

## Open release checklist items

Keep **stale-response** and **drawing-dimension** findings OPEN until re-verified (see `BASELINE_CHANGE_PACKAGE.md`).
