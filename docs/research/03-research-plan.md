# Research Plan, Risks, Definition of Done & Decisions for Bekzod

## 1. Source hierarchy & evaluation rubric

- **Tier A (authoritative):** standards bodies, manufacturer technical docs (Blum/Hettich/Häfele, EGGER/Kronospan), BAZIS docs, and **the partner factory's own procedures**. Only tier that can create/change a production rule. Factory facts are authoritative **only within that factory's profile** (`factory-profiles/<id>.json`) — never universal furniture rules. Compliance claims additionally require licensed standard text or certification — reading a summary is not compliance.
- **Tier B (implementations):** OSS repos per `01-github-landscape.md`. Architecture and algorithm ideas; code reuse only after license/commit/security record in `source-registry.yaml`.
- **Tier C (practitioner):** Reddit/forums. Produces hypotheses and eval cases only. A Tier C claim enters a rule only after Tier A or factory confirmation.
- **Tier D (inspiration):** styles/trends only; no copying protected designs.

Rubric per source: relevance (does it change a rule, catalog entry, or eval case?), authority tier, license/rights, version pinned, conflict check against existing rules, confidence, and the derived-artifact link. A source that produces no rule/catalog/case/decision is recorded and closed.

## 2. Open research questions (by taxonomy §7, prioritized)

**P0 — wardrobe modeling knowledge (MVP):** exact panel breakdown conventions for 18mm MDF wardrobes; internal-layout ergonomics; module/zone grammar; collision/motion envelopes; machine-neutral manufacturing-feature semantics. *(Factory ground truth — board stock, edge bands, drilling method, hardware purchases, BAZIS import format — moved to deferred Phases 6–7 per decision log.)*
**P1 — wardrobe expert pack (§7.1/7.2/7.6/7.7):** internal-layout ergonomics for UAE market (hanging heights, drawer zones); sliding-door system constraints (min depth, track clearances — currently absent from validator); door weight/size limits per selected hinge series; plinth/filler/scribe rules for wall-to-wall fits.
**P2 — site conditions (§7.3):** what FurniAI asks the customer vs. what a site visit verifies; ceiling-height/AC-duct constraints common in UAE apartments.
**P3 — costing (§7.14):** connect price to generated cut list (repo already flags basePrice as static); waste factor per material.
**P4 — nesting/CNC (§7.12/7.13):** only the BAZIS-compatibility question; everything else deferred.

## 3. Phase 0 (rev. 2026-07-23 per `docs/MASTER-PLAN.md` — supersedes the earlier four-week sequence; **no factory interview in Phase 0**)

1. Inspect and preserve the current repository state (uncommitted work committed or explicitly parked).
2. Establish the real test baseline (see §8 test inventory — discovery run 2026-07-23).
3. Create the approved evaluation fixtures (`06-eval-harness.md`: fixtures 1–5, 7–10 asserted; 6/13/14 knownGap todos; capability statuses on every fixture).
4. Document current behavior and known gaps.
5. Prepare the wardrobe vertical slice (MASTER-PLAN Phase 1: request → brief → FSL v0 → exact 18mm MDF panels → validated geometry → editable 3D → saved revision, with its acceptance list).

Wardrobe knowledge research (hardware series, ergonomics, sliding systems) continues as offline research feeding hand-authored rule *proposals* — reviewed diffs with regression fixtures, merged only after approval. Factory-dependent items (BAZIS CSV verification, past-order diff, hardware purchase list) are deferred to Phases 6–7.

## 4. Definition of done (Phase 0)

1. Every claim in these docs either carries a registry source ID, is marked `prior-knowledge`, or appears in §7 below.
2. Real test baseline established and documented (§8) — no "zero tests" or "N tests" claims without discovery evidence.
3. Wardrobe eval fixtures runnable (1–5, 7–10 asserted; 6/13/14 knownGap; capability statuses declared); baseline recorded.
4. Rule proposals exist as reviewable diffs with provenance; zero merged without approval.
5. License review complete for any dependency proposed for actual reuse.
6. Wardrobe vertical slice proposal with exact acceptance criteria ready for approval.

## 8. Test inventory (discovery run 2026-07-23 — repository evidence)

Searched both codebases (excluding `node_modules`, `.next`, `.git`) for `*.test.*`, `*.spec.*`, test directories, package.json test scripts, and `node:test`/`assert` imports; also searched full git history for test-like paths ever added.

| Category | Count | Evidence |
|---|---|---|
| Furniture-knowledge/unit tests | 0 | no matching files, dirs, or scripts anywhere |
| Geometry tests | 0 | same |
| API tests | 0 | same |
| End-to-end tests | 0 | Playwright named as intended stack in the (deleted) Master Specification; never installed or configured |
| Evaluation harness | 0 (planned) | `06-eval-harness.md` design only; `tests/` not yet created |

Git history contains no test file ever committed. Words like "tested" in `START-HERE.md` / the former Master Specification refer to manual verification during build sessions. **A prior report of "76 passing furniture-knowledge tests" has no evidence in this repository** — no such files exist now or in history; that work, if real, lives in another workspace and was never committed here. Accurate statement: *no automated tests exist in this repository; the evaluation harness does not yet exist.*

## 5. Risks & legal/safety limits

- **License:** OpenCutList is GPL-3.0 — concepts only. cabinet-mcp license unknown — blocks close code study. Standards (AWI/EN) are paid — budget or skip formal compliance claims.
- **Safety:** no machine-executable output ever leaves FurniAI; BAZIS + operator remain the safety boundary. No feeds/speeds/toolpaths from internet sources, period.
- **Privacy:** tenant isolation via Supabase per-user scoping; corrections → events, never direct global mutations; no training on customer data.
- **Prompt injection:** retrieved web/doc content stays out of the system prompt; research findings enter code only through human-reviewed rule diffs.
- **Product risk:** live static site is production — research phase touches `docs/` only. Any later rule change ships behind the existing graded-findings pattern (warnings, not blocks) first.
- **Encoding:** Bekzod's exported files can carry mojibake — diff before replacing anything live.

## 6. Decision log

**2026-07-23 (final, per `docs/MASTER-PLAN.md` adoption):**

1. **MVP material CONFIRMED: 18mm MDF** — FurniAI's default modeling convention, not a fact awaiting a factory interview. Materials remain editable (MFC, plywood, solid wood, other thicknesses later); first vertical slice uses 18mm MDF.
2. **Factory information NOT required for MVP.** Factory interview removed from Phase 0 and all implementation prerequisites; `04-factory-interview.md` and `05-factory-profile-spec.md` are deferred reference documents for future verified-export work (Phases 6–7).
3. **Nesting/CNC: STAGED scope, not deferred outright.** Early: machine-neutral manufacturing features, cut lists, machining semantics, validation, nesting preview. Later: verified nesting engine + production exports. Machine-specific CNC/G-code or BAZIS-compatibility claims: prohibited until validated with a real machine/export profile and a successful import test. FurniAI is not an ERP/scheduler/inventory/machine-control system.
4. **Millimetres = target canonical unit via VERSIONED migration** — either `*_mm` fields alongside cm during compatibility, or a new versioned schema with adapters at every boundary; regression tests against 10× scaling errors required.
5. **Capability statuses adopted** in all benchmarks: `production_ready | preview | conceptual | unsupported`. Sliding/mirror wardrobe = `conceptual`.
6. **Standards:** still no AWI/EN purchases; manufacturer documentation for MVP; no compliance claims.
7. **Next.js:** long-term destination, field-by-field migration; live Vercel deployment unchanged.
8. **Multi-concept generation and runtime RAG remain deferred/excluded.**

Earlier decision rounds (2026-07-23, superseded where they conflict): original 7 answers kept in git history; the factory-interview-first sequencing and "nesting/CNC deferred" wording are superseded by items 2–3 above.

Original questions retained below for context.

### Original decision list (superseded by answers above)

1. **Factory interview (W1)** — the single highest-value action; without it every Tier-A rule stays hypothetical. Willing to schedule?
2. **Hardware system of record** — which hinge/slide series does the factory actually buy (Blum? Hettich? generic)? Determines whose technical data becomes canon.
3. **BAZIS contract** — can we get a sample of the exact CSV/import format the factory's BAZIS accepts, plus one real past order to compare against `production.js` output?
4. **Sliding doors** — wardrobes with sliding doors are in the catalog; validator has no sliding-door rules. Which sliding system (brand/series) should be researched first?
5. **Standards budget** — pay for AWI/EN documents (compliance-grade rules) or stay with manufacturer docs + factory practice (sufficient for UAE custom work)?
6. **Next.js direction** — the richer schema lives in the dormant `src/` tree. Long term: migrate live site toward it, or keep evolving the static site's flat cfg? Affects where FSL v1 lands.
7. **Multi-concept UX** — approve showing up to 3 named design alternatives per request (cost: ~3× tokens per design turn)?

## 7. Claims that remain unverified

- Licenses marked ◐/prior-knowledge in `01-github-landscape.md` (FreeCAD, CadQuery, OpenSCAD, BOSL2, SVGnest, OR-Tools, OCCT) — re-verify at adoption.
- cabinet-mcp license and test claims (283 scenarios) — from prior internal docs, not re-checked.
- All Tier A manufacturer/standards entries — URLs listed, content not yet fetched/extracted.
- Reddit thread findings — carried over from the master prompt and prior batches; threads not re-read this pass.
- "BAZIS accepts our CSV" — asserted in repo docs, never tested against a real BAZIS import (see decision 3).
- Shelf-span constants in `constructionValidator.js` cite industry L/360 guidance via prior batch research; primary source not pinned in the registry yet.
