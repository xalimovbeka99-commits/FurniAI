# FurniAI — Existing System Analysis (Phase 0)

Written before any Furniture Intelligence Engine / Furniture IR / Tool System code is
added, per the master vision prompt's explicit instruction: understand the repo first,
document it, then propose an experimental architecture — do not generate code blindly.

Everything below is verified against the actual repository state on 2026-07-12, not
against prior documentation (several existing docs, noted below, are stale).

---

## CURRENT ARCHITECTURE

Two independent, incompatible codebases live in the same repo:

1. **Static site — `index.html` / `styles.css` / `app.js` (LIVE, the actual product).**
   Vanilla HTML/CSS/JS, no build step. `vercel.json` (`framework: null`) copies these
   three files into `dist/`. This is what real users hit at `furnia.vercel.app`.
   `api/chat.js` is a Vercel serverless function (plain Node, not a Next.js route) that
   serves this site's AI chat.

2. **Next.js app — `src/` (NOT deployed, in-development).**
   React 18 + `@react-three/fiber`/drei + Zustand + Tailwind. Structured conventionally
   (`src/app`, `src/components/builder`, `src/lib`, `src/store`). `vercel.json`
   deliberately overrides Next.js auto-detection so this never reaches production — a
   prior attempt to deploy it broke the live site.

Infra reality check: **no Docker, no Redis, no self-hosted Postgres anywhere in this
repo.** The only backend datastore is Supabase (hosted Postgres + Auth), wired into
`index.html` this session — see "Loose end" below. **No test framework is configured**
(no jest/vitest/mocha in `package.json`, no `*.test.js`/`*.spec.js` files exist anywhere),
despite `START-HERE.md` claiming several `src/lib` files are "✓ tested" — that claim is
aspirational leftover text, not backed by any test in the repo.

Dead weight at the repo root, none of it referenced by the live site, none of it touched
by anything below: `app.js` (43KB, orphaned — copied into every Vercel build but never
`<script src>`'d by `index.html`), `index_3.html` (798-line abandoned variant),
`FurniAI/` subdirectory (a 198-line early skeleton duplicate of the static site).

---

## CURRENT 3D CAPABILITIES

### Static site (`index.html`, live)
- A single global `Builder` object (~900 lines of imperative Three.js starting at
  `index.html:896`) with hand-written methods (`wall()`, `makeCornerCab`,
  `makeKitchenCornerCab`, `makeDoor`, `box()`, `frontPanel()`, ...) that build meshes
  directly from a flat `cfg` object. No intermediate representation — geometry is
  produced straight from parameters.
- 30 hardcoded catalog presets in `DESIGNS` (`index.html:663`), each
  `{name, type, sections, drawers, shelves, doorType, mat, handle, led, w, h, d, basePrice}`.
- Production docs (cut list, hardware list, drilling notes, orthographic SVG views,
  assembly blueprint) are computed by a **separate** set of functions
  (`generatePanelList`, `generateHardwareList`, `buildTechnicalDrawings`,
  `buildAssemblyBlueprint`) that re-derive facts straight from `cfg` — independently
  from the 3D builder, not from a shared model. They agree today only because both were
  hand-written consistently; there is no single source of engineering truth enforcing
  that. This is precisely the fragility the vision's "3D is a view of the Furniture IR"
  principle (its own Section 16) is meant to eliminate.
- Real, hardened, customer-facing: 11 furniture types, 13 materials, reflective mirror
  material, procedural grain textures, mobile-first UX (bottom sheets, pinch-zoom).
  Corner-cabinet geometry in particular has a rough, multi-round fix history (several
  reverted attempts) — treat it as fragile, not a template to copy.

### Next.js app (`src/`, not deployed)
- `src/lib/buildGeometry.js` — a genuinely **pure function**: `FurnitureConfig → flat
  parts array` (`{id, role, size, position, material, module}`, metres, floor at Y=0).
  This is already a primitive Furniture IR: stable-ish entity IDs, semantic roles,
  positions, material refs. It's missing edges/hardware/machining/dependencies and any
  schema versioning, but it is structurally the right shape.
- `src/components/builder/FurnitureModel.jsx` renders each part as a `<mesh>` **directly
  from `buildGeometry()` output**, with click-to-select wired to `part.module`. This
  already satisfies "3D is a view of the engineering model" far better than the static
  site does.
- `src/lib/production.js` derives cut list, drilling spec, and CSV from the **same**
  `buildGeometry()` parts list used for rendering — one real source of truth, unlike the
  static site's two independent derivations.
- Config vocabulary (`src/lib/furnitureConfig.js`): `type / style / material /
  handleStyle / doorType / ledLighting / hasPlinth / dimensions{width,height,depth} /
  modules[]`, where each module has `kind / widthRatio / doorCount / drawerRows /
  shelfCount / hingeSide / slideType`. Materially closer to a real Furniture Intent
  schema than the static site's flat section/drawer/shelf counts.
- Coverage is much narrower than the static site: only 4 furniture types
  (wardrobe/kitchen/cabinet/shelves) have real module logic; office/bed/table/
  dressing_table fall back to one generic shelf bay. No corner/L/U shapes at all.
- **Unproven** — no tests, no evidence in project history of anyone having run
  `/builder` recently and visually confirmed it renders correctly. Read cleanly, but
  don't assume it works until it's actually exercised.

---

## CURRENT AI CAPABILITIES

Two independent Claude tool-use agents already exist:

1. **`api/chat.js` — LIVE, deployed, confirmed working in production.** One tool,
   `set_furniture_config`. Maps natural language onto the static site's flat cfg
   vocabulary; every field is passed through a server-side `sanitizeConfig()` that
   clamps/coerces against a fixed vocabulary and per-type numeric ranges before it can
   reach the 3D builder (`api/chat.js:91-108`). This is a real, working, narrow instance
   of "AI proposes → deterministic gate validates → deterministic engine renders" —
   just with one coarse tool instead of a registry of granular ones.
2. **`src/lib/salesAgent.js` — dormant, Next.js only.** One tool, `generate_quote`,
   wired to `pricing.js`; used by `/api/sales-agent` and the WhatsApp webhook route.
   Built for a pricing/checkout-first business model that the product has since
   abandoned (see below) — do not extend without reconciling direction first.

Neither agent has: a multi-tool registry, a separate "engineering plan" step, real
change-propagation (the static-site agent's "make it wider" support is just "resend the
full config every turn," not entity-level diffing), or persistent memory across
sessions. `supabase/schema.sql` defines an `ai_conversations` table for exactly that
last piece, but nothing reads or writes it yet.

---

## CURRENT FURNITURE CAPABILITIES

| | Static site (live) | Next.js (`src/`) |
|---|---|---|
| Furniture types | 11 (incl. L/U walk-ins, kitchen L/U/island, vanities) | 8 defined, only 4 with real module logic |
| Preset designs | 30 | 0 (config-driven, no gallery wired) |
| Corner/L/U geometry | Yes (fragile, hand-patched) | No |
| Materials | 13, incl. reflective mirror + procedural grain | Flat colour swatches only |
| Production output | Full multi-section printable doc: cover, SVG orthographic views, panel list, hardware list, cut list, assembly blueprint — client-side, no backend | Cut list + plain-text drilling notes + CSV — leaner but architecturally sounder (single source) |
| Mobile UX | Hardened through multiple real-device fix rounds | Not addressed |

---

## REUSABLE SYSTEMS (do not rebuild from zero)

- **`src/lib/furnitureConfig.js` + `configSchema.js`** — the closest existing thing to
  a Furniture Intent schema plus a real validation gate. `validateConfig()`
  (`src/lib/configSchema.js:48`) already does what the vision demands: overlay
  AI-proposed fields onto a known-good template, clamp/coerce every field individually,
  never let a bad AI response through unsanitized. Extend this; don't replace it.
- **`src/lib/buildGeometry.js`** — proto Geometry Engine and proto parts-list IR.
  Evolving its part shape (add `entityType`, `materialId` object, `edges[]`,
  `machining[]`, `dependencies[]`) is a much shorter path to a real Furniture IR than
  starting fresh.
- **`src/lib/production.js`** — proto Production Engine / Cut List Engine, already
  deriving from the same parts list the 3D view uses.
- **`api/chat.js`'s `sanitizeConfig()` pattern** — proven in production. The new Tool
  Registry's per-tool validation should follow this exact shape (enum allowlists +
  numeric clamps + safe fallbacks, never a raw pass-through).
- **`supabase/schema.sql`** — `profiles` / `projects` / `ai_conversations` tables with
  RLS, already designed for "AI memory of the model" (vision Section 30) and
  project/change history. The design is sound; it just hasn't been applied yet (below).

---

## TECHNICAL DEBT RELEVANT TO THE NEW ENGINE

- **Two incompatible config vocabularies** (static site's flat cfg vs. Next.js's typed
  FurnitureConfig). The new Furniture IR should be its own versioned schema — not a
  superset hack of both — with an adapter layer only if the static site ever needs to
  read from it.
- **Root-level dead code** (`app.js`, `index_3.html`, `FurniAI/`) — harmless to the new
  engine work as long as nothing new is added under those paths; flagged here so it
  isn't mistaken for something relevant.
- **`START-HERE.md` / the now-removed `FurniAI-Master-Specification.md`** described a
  payment/checkout-first business model the product has since explicitly abandoned (no
  prices, no checkout — see project vision-pivot notes). Neither should be treated as
  current direction; this new 36-section prompt supersedes both. The spec file was
  removed from the working tree this session; `START-HERE.md`'s dangling reference to it
  was patched so the doc isn't broken, but its content still describes the old model.
- **No automated tests anywhere** *(true as of 2026-07-12, when this analysis was
  written).* Any new engine code should carry real tests from the start — the vision
  prompt requires this explicitly (Section 36) and the "✓ tested" claims already in
  this repo for `buildGeometry.js`/`pricing.js`/`production.js` are not backed by
  anything that actually runs.
  **Update (2026-07-23):** no longer accurate for the code that didn't exist yet on
  2026-07-12. FSL v1 (`src/lib/fsl/`, `src/lib/furniture-brain/`,
  `src/lib/furniture-knowledge/`, the configurator adapter, the generation API route)
  added Vitest, and a Phase 0 evaluation-harness pass (master plan §27) added
  characterization tests for `furnitureConfig.js`, `buildGeometry.js`,
  `configSchema.js`, and `knowledgeBase.js` — all previously untested. 154 tests pass
  today, plus 13 explicit `test.todo` knownGap entries
  (`furniture-brain/wardrobeBenchmark.test.js`) documenting what's still missing
  rather than leaving it silently uncovered. `buildGeometry.js` now has panel-output
  characterization tests specifically, closing part of the original gap this bullet
  warned about — but `pricing.js` and `production.js` still have none, and neither
  does a broader end-to-end geometry/production **evaluation harness** (the
  benchmark-case suite described in the archived knowledge-research master prompt,
  §15: multi-module wardrobes, corner/L-shapes, resize-after-production-intent, etc.
  — see `docs/research/furniai-brain-knowledge-research-master-prompt.md`, and the
  knownGap register above for the current, authoritative version of that list). Unit/
  characterization tests on individual modules and end-to-end evaluation of
  geometry/production output remain different things; only the former exists today.
- **Loose end, unrelated to the new engine but open right now:** Supabase
  auth/saved-projects (roadmap pillar 6) is mid-flight. Real project credentials were
  wired into `index.html` this session but are still uncommitted pending your
  confirmation (a permission gate flagged committing a live key/URL as worth an explicit
  go-ahead). Separately, `supabase/schema.sql` has never been run against the live
  project — confirmed by querying the REST API directly and getting back
  `PGRST205: Could not find the table 'public.projects'`. Neither blocks the new engine
  work; both need you, not more agent work, to close out.

---

## SAFE INTEGRATION POINTS

- **`/cad-lab`** as a brand-new route/page — purely additive, zero risk to the live site
  or the existing Next.js pages.
- **New `src/lib/ir/*`, `src/lib/tools/*`, `src/lib/engines/*`, `src/lib/rules/*`
  modules** — pure functions and data with nothing existing depending on them, so they
  can be iterated freely without risk of breaking `index.html` or current Next.js pages.
- **Extending in place** (not replacing) `buildGeometry.js` / `furnitureConfig.js` /
  `configSchema.js` / `production.js`, as long as existing exports and call sites
  (`FurnitureModel.jsx`, `production.js`'s current callers) keep working unchanged.
- **A new, separate AI endpoint** (e.g. `src/app/api/cad-lab/route.js`) modeled on
  `api/chat.js`'s proven hop-loop + sanitize pattern, rather than modifying `api/chat.js`
  itself.

## SYSTEMS THAT SHOULD NOT BE MODIFIED YET

- `index.html`'s `Builder` object and `DESIGNS` catalog — the live product. Standing
  project rule is to never rewrite this wholesale, and nothing in this phase requires
  touching it at all.
- `api/chat.js` — live, deployed, working AI agent for real users. The new Furniture
  Engineering Planner is a parallel experiment until it's proven, not a replacement.
- `supabase/schema.sql` / the auth+saved-projects feature — a separate in-flight thread
  with its own next steps (above); don't conflate it with the new engine work.
- `src/lib/salesAgent.js`, `pricing.js`, `whatsapp.js` — built for the abandoned
  pricing/checkout model. Leave dormant; don't extend until the business-model question
  is revisited explicitly.

---

## PROPOSED EXPERIMENTAL ARCHITECTURE (first vertical slice only)

Scoped tightly to Section 32/33 of the vision prompt — one cabinet, create + modify,
nothing else:

- `/cad-lab` page (Next.js, isolated from `/builder`) with the panel layout from
  Section 26 (AI command, intent, plan, tool calls, IR, 3D, entity inspector,
  validation, production analysis, cut list, experiment log).
- `src/lib/ir/furnitureIR.js` — versioned schema for FurnitureProject / Assembly / Part,
  built as an evolution of today's `buildGeometry.js` part shape (add `entityType`,
  structured `materialId`, `edges[]`, `machining[]`, `parameters`, `dependencies[]`).
- `src/lib/tools/registry.js` + exactly the first 10 tools from Section 33
  (`create_base_cabinet`, `set_dimensions`, `add_shelf`, `remove_shelf`,
  `apply_material`, `get_entity`, `get_project_summary`, `validate_project`,
  `analyze_production`, `generate_cut_list`), each validated the same way
  `configSchema.js` validates today.
- `src/lib/rules/baseCabinetRules.js` — one rule set, formalizing the carcass-shell
  logic already in `buildGeometry.js` (lines 30-44) per Section 13.
- `src/lib/engines/parametricEngine.js` + `changePropagation.js` — thin wrappers that
  call `buildGeometry()`-equivalent logic on every mutation. Full-rebuild propagation is
  explicitly acceptable for v0 per the vision prompt's own Section 12 ("do not
  over-engineer a distributed reactive graph system").
- A new `src/app/api/cad-lab/route.js` implementing the Furniture Engineering Planner
  (Section 8), modeled directly on `api/chat.js`'s hop-loop + sanitize pattern, calling
  the Section 33 tool list instead of one big config blob.
- **Mandatory proof, per Section 32**: create a 600×720×560mm base cabinet (18mm white
  MDF, one shelf) via natural language, show the IR/3D/cut-list all populate; then
  modify it ("make it 800mm wide") and show every dependent value — bottom/top/back/
  shelf width, cut list rows — actually change. No part of this is "done" until that
  round-trip is demonstrated with real output, not just code that looks right.

---

## OPEN QUESTIONS BEFORE MAJOR CODING STARTS

1. **Where does `/cad-lab` live?** The Next.js app (`src/`) is architecturally much
   closer to the target already (pure config→parts function, entity-based selection,
   validation gate) than the static site's imperative Builder. Recommendation: build
   `/cad-lab` inside `src/`, reusing `buildGeometry.js`/`configSchema.js` as the seed —
   confirm before I start.
2. Should the two open Supabase loose ends (uncommitted credentials, unapplied schema)
   be resolved first, in parallel, or left alone while this work proceeds? They're
   unrelated to the engine but are the only other thing currently mid-flight.
3. OK to leave `salesAgent.js` / `pricing.js` / `whatsapp.js` untouched (not deleted, not
   extended) for now, given they encode the abandoned pricing-first model?
