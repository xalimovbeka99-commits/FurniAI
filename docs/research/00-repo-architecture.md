# FurniAI Brain Research — Verified Repository Architecture

**Date:** 2026-07-23 · **Phase:** research-and-architecture only (no product code changed)
**Companion docs:** existing `docs/knowledge-base/` (5 research batches) and `docs/ai-skills/` are the prior research program. This folder extends them — it does not replace them.

## 1. Two codebases, one live

| Surface | Status | Files | AI? |
|---|---|---|---|
| Static site | **LIVE** (furnia.vercel.app, Vercel `framework:null`) | `index.html` (entire app inline), `api/chat.js`, `api/constructionValidator.js` | Yes — Claude tool-use |
| Next.js app | In development, **not deployed** (hard rule: never switch Vercel without explicit approval) | `src/` (r3f + Zustand + Tailwind) | Partially (`salesAgent.js`) |

`app.js` and `styles.css` at root are legacy/superseded. `FurniAI/` is a diverged duplicate of the static site.

## 2. What already exists, mapped to the master prompt's vocabulary

| Master-prompt concept | Actual repo implementation today |
|---|---|
| FSL (design language) | **Two de facto schemas.** Live: flat cfg `{type, sections, drawers, shelves, doorType, mat, handle, led, w, h, d}` + `set_custom_design` parts (role/w/h/d/x/y/z, `restsOnFloor`/`restsOnParts`). Next.js: richer module-based `configSchema.js`. **`docs/ai-skills/README.md` already recommends against inventing a third FSL** — extend the live schema field by field instead. |
| Deterministic rule engine | `api/constructionValidator.js` — graded (non-binary) findings, physics-backed (L/360 shelf span), each warning carries a deterministic `fix` patch (auto-repair chip). This is the bounded repair loop, v0. |
| Validation gate | `sanitizeConfig()` in `chat.js` (range clamping); `configSchema.js` in Next.js (full sanitizer). |
| Geometry engine | Live: `Builder` in `index.html` (Three.js r128, per-type builders). Next.js: `buildGeometry.js` (pure config → parts → cut list, tested). |
| Production output | Live: `generateCutList()` + hardware list + order modal → WhatsApp / print-PDF. Next.js: `production.js` (cut list mm, edge banding, grain, drilling spec, CSV for BAZIS). **The factory contract is PDF + CSV into BAZIS — FurniAI does not and should not emit G-code.** |
| Catalogs | `knowledgeBase.js` (materials, hardware, prices AED, type defaults) — plain JS module by design, not a vector DB. |
| Memory | Supabase: `profiles`, `projects` (saved designs), `ai_conversations`, **`ai_corrections`** (correction-event store already exists). `chat.js` computes majority-preference bias from ≥2 past designs (consent-scoped, per-user, never overrides explicit asks). |
| Case/knowledge docs | `docs/knowledge-base/` — 24 topics across 5 batches + targeted image-to-design research; `docs/ai-skills/proposed-skills.md`. |
| Evaluation suite | **Missing.** No automated tests in either codebase (Next.js libs described as "tested" = manually verified). This is the biggest genuine gap. |

## 3. Verified constraints (from repo docs and git history)

- Never point Vercel at `src/` without approval (a prior attempt broke production).
- The live site never shows prices in the AI chat surface.
- The live cfg vocabulary and the Next.js schema must not be merged blindly — they are intentionally separate.
- Uploaded/exported files from Bekzod's environment can carry mojibake; diff before replacing live files.
- The factory works from PDF + CSV (mm, English, OrderID on every row); BAZIS or the operator handles nesting/CNC.

## 4. Reconciliation: master prompt vs. repo reality

The master prompt assumes a large FSL-centric brain with CAD kernel, nesting, and CNC phases. The repo's own evidence says:

1. **FSL:** treat the live cfg + custom-parts schema as **FSL v0**. Evolve it (typed patches, stable part IDs, revision history) rather than writing a new language. This honors both the prompt ("typed FSL patches") and the repo's standing recommendation.
2. **Repair loop:** `constructionValidator.js` findings-with-fix is already the pattern §12 asks for. The upgrade path is: more rules, typed error categories, attempt budget, and regression cases — not a new engine.
3. **CNC (§7.13, Phase G):** out of scope for FurniAI itself. The safety boundary is the BAZIS handoff. Nesting (Phase F) is optional and only worth doing if the factory wants utilization reports before BAZIS.
4. **Memory (§3):** project memory (`projects`), conversation memory (`ai_conversations`), preference memory (majority-bias in `chat.js`), correction events (`ai_corrections`) all exist in embryo. What's missing is the **governed promotion pipeline** (candidate lesson → review → rule/catalog change → regression test).
5. **Knowledge architecture (§4):** the hybrid already exists in miniature: catalogs (`knowledgeBase.js`), rules (`constructionValidator.js`), retrieval-ish docs (`docs/knowledge-base/`), LLM orchestration (`chat.js`). Missing: source registry with provenance, versioning, and an evaluation harness.

## 5. Proposed structure merge (per §14 — no competing trees)

- `docs/research/` (this folder) = research-phase outputs.
- `docs/knowledge-base/` stays the extraction home; new batches continue there.
- `knowledge/` tree from the master prompt: **do not create yet.** Its concepts map onto existing files (catalogs → `knowledgeBase.js`, rules → `constructionValidator.js`, cases → `docs/knowledge-base/*`). Create `knowledge/sources/registry.yaml` only when the source registry (see `source-registry.yaml` here) is approved.
