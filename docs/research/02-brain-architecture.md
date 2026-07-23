# FurniAI Brain — Knowledge, Memory, Creativity & Learning Architecture

Design proposal mapped to the ACTUAL repo (see `00-repo-architecture.md`). Nothing here is implemented; everything extends existing files, never a parallel rebuild.

> **Rev. 2026-07-23:** reconciled with `docs/MASTER-PLAN.md` (authoritative). Key changes: 18mm MDF is the MVP modeling convention (a default, editable per model — not a factory fact awaiting interview); factory profile deferred; nesting/CNC moved from "deferred" to **staged scope**; millimetre migration added as an explicit versioned FSL item; capability statuses adopted.

## 0. Staged production-intelligence boundary (MASTER-PLAN §14–§18)

- **Early phases:** machine-neutral manufacturing features, cut lists, machining semantics (drilling/grooves/cutouts/orientation/grain/edge intent), validation, and a rectangular nesting *preview*.
- **Later phases:** verified nesting engine and neutral production exports (FSL JSON, PDF drawings, parts CSV, DXF/SVG, manufacturing-feature JSON).
- **Prohibited until validated with a real machine/export profile and a successful import test:** machine-specific CNC/G-code and any BAZIS-compatibility claim.
- FurniAI is not a factory ERP, production scheduler, inventory system, or machine-control system.
- Every model/benchmark carries a capability status: `production_ready | preview | conceptual | unsupported`. Never label a model more mature than the evidence.

## 1. Ontology / FSL position

**Decision proposed:** FSL = the live cfg schema, versioned. No new language.

**MVP modeling convention (MASTER-PLAN §3):** default structural material = 18mm MDF, represented as one explicit configurable rule/value — never hard-coded across functions. Materials stay editable (MFC, plywood, solid wood, other thicknesses later); every exception explicit in the model.

**Millimetre migration (explicit versioned item — do NOT change fields silently):** the live cfg is in cm; mm is the target canonical unit. Approved approaches: keep cm fields during a compatibility window and add clearly named `*_mm` fields, or introduce a versioned schema with adapters at every existing boundary. Regression tests must guard against accidental 10× scaling errors before any unit change ships.

- `fsl_version` field added to configs; stored per revision in Supabase `projects`.
- Custom pieces: evolve `set_custom_design` parts with (a) stable part IDs, (b) an attachment grammar generalizing `restsOnFloor`/`restsOnParts` (BOSL2-style: `attachedTo: {part, face, offset}`), (c) typed patch operations (`add_part`, `resize_part`, `move_part`, `set_material`) so "make it wider" becomes a diffable patch instead of a full re-send.
- The Next.js `configSchema.js` module vocabulary (door/drawerBank/openShelf/applianceGap + widthRatio + hingeSide) is the richer target; migrate the live schema toward it field-by-field, never both-at-once.

## 2. Knowledge layers (hybrid, per master prompt §4) — current → target

| Layer | Today | Target |
|---|---|---|
| Catalogs | `knowledgeBase.js` placeholders | Same file, real factory data (boards, edge bands, hardware series w/ manufacturer part numbers + source IDs from registry) |
| Rules | `constructionValidator.js` | Same engine; each rule gains `{id, sourceId, severity, market}` provenance; rules file split by domain when >~40 rules |
| Retrieval | none (docs are for humans) | Deferred. At current scale, curated rules + catalogs beat RAG. Revisit only when long-tail Q&A ("can I put a cooktop over this drawer unit?") is a real observed need |
| Design grammar | implicit in `DESIGNS` presets + Builder | explicit pattern list (zones: hanging/folded/drawer/shoe; module templates; proportion rules) as data in `designs.js`-style presets — the "variant generator" already planned in START-HERE |
| Cases | `docs/knowledge-base/*.md` prose | structured case files only after ≥10 real corrected orders exist; don't build the library before the cases |
| Evaluation | none | **the missing keystone — see §5** |

## 3. Memory model → concrete storage

| Memory type (§3 of prompt) | Storage | Status |
|---|---|---|
| Working | request-scope in `chat.js` (stateless per turn, client resends) | exists; add attempt budget when repair loop deepens |
| Conversation | Supabase `ai_conversations` | exists |
| Project | Supabase `projects` (cfg snapshots) | exists; add: revision chain, rejected-alternatives + reasons, assumption log |
| Preference | majority-bias in `chat.js` (≥2 designs, >50%) | exists and well-designed; add explicit opt-in/out flag |
| Organization/factory | none | **DEFERRED** — `factoryProfile` (see `05-factory-profile-spec.md`) becomes relevant only when implementing a verified export for a specific factory/CNC/BAZIS workflow. Not an MVP prerequisite |
| Domain knowledge | `docs/knowledge-base/` + validator constants | add provenance comments linking each constant to `source-registry.yaml` ID |
| Case | `ai_corrections` table | exists as event store; promotion pipeline missing (§4) |

Tenant isolation: all Supabase tables are per-user already; the rule "one customer's correction never mutates global knowledge" is enforced by the promotion pipeline below — corrections land as events, never as direct rule edits.

## 4. Governed learning lifecycle (§2) — minimal viable version

```
correction event (ai_corrections)            [exists]
  → weekly human review by Bekzod            [new: a simple review query/page]
  → classify: preference | project fact | candidate rule | bug
  → preference/project: applied immediately, tenant-scoped   [exists]
  → candidate rule: reproduce as an eval case → check against Tier A source
      → if confirmed: hand-edit constructionValidator.js + add regression case
      → version bump + changelog line
  → bug: normal fix + regression case
```

No auto-training, no auto-promotion. The "approval authority" is Bekzod (furniture) until a second reviewer exists. Rollback = git revert of the rule change; every rule change is one commit.

## 5. Evaluation harness (prerequisite for everything else)

Highest-priority build item of the whole program. Both codebases have zero automated tests.

- Runner: plain Node script (`npm test`), no framework needed initially.
- Wardrobe benchmark set (from master prompt §15), as JSON fixtures: simple 2-door; multi-module w/ drawers+hanging; wall-to-wall w/ fillers; L-shape; sloped ceiling (expected: honest "unsupported"); sliding-mirror; reference-image w/ missing dims (expected: clarifying question); impossible internal layout (expected: findings); hardware conflict; resize-after-order (expected: frozen-config warning); correction-after-first-render.
- Each case: input → expected cfg properties, expected findings (id + severity), expected cut-list invariants (part count, mm dims, edge banding), pass/fail.
- Deterministic layers (`sanitizeConfig`, `evaluateConstruction`, `generateCutList`, `production.js`) are directly testable today. LLM-layer cases run as a scored suite (valid-config rate, clarification quality) — spot-checked, not CI-gating.

## 6. Creativity pipeline (§11) — scoped to reality

Today `chat.js` produces one design per request. Minimal upgrade, in order:
1. **Multi-concept**: let the model call `set_furniture_config` up to 3× with named alternatives ("boutique", "maximal storage", "budget"); UI shows chips. No new engine.
2. **Two scores kept separate**: desirability (model's own ranking + user pick) vs. engineering confidence (count/severity of validator findings). A concept with warnings can still be shown, labeled conceptual.
3. **Design grammar as data**: zone/module patterns in the preset format (the planned variant generator), so novel combinations come from composing validated primitives.

## 7. Self-correction loop (§12) — deltas only

Existing: schema clamp → graded findings → deterministic `fix` → one-click apply.
Add: (a) typed failure categories on findings (`schema|semantic|constraint|collision|manufacturability|preference`); (b) attempt budget (max 2 auto-repair rounds, then ask); (c) every applied fix logged to `ai_corrections` with before/after diff → feeds §4; (d) never patch geometry without patching the cfg (already structurally true: geometry is derived from cfg only).

## 8. Feedback UX (§13)

Live site already has: 3D selection surface, findings chips. Add per correction: selected part ID, issue category picker (5 options), one-time-vs-preference toggle, before/after cfg diff stored in `ai_corrections`. That is the entire §13 requirement expressed in the existing UI language.
