# FurniAI — Product Vision & Roadmap

Written 2026-07-22, from the founder's own description of the target product,
checked against what actually exists in this repository today (not against
older docs, several of which describe an abandoned pricing/checkout-first
model — see `furniai-existing-system-analysis.md`).

## The vision, in one paragraph

A client — on any device, phone, tablet, or PC — hands FurniAI a starting
point: a photo, a PDF, a hand drawing, or just a spoken or typed description.
An AI "brain," reasoning through FurniAI's own internal furniture
representation, turns that into a real, detailed 3D model. The client then
becomes their own designer inside that 3D view: add, remove, resize, swap
material or texture, live. Once they're happy, the same brain produces
production-grade output — CNC-ready blueprints, nesting layouts, cut lists,
board specs — equivalent to what a CAD/SketchUp/BAZIS operator would hand a
factory. The brain's furniture expertise comes from a large body of
furniture/architecture/production reference material, so it reasons like an
experienced furniture engineer, not a template-filler. Eventually all of this
is exposed as an API for other systems to call.

## The six pillars, and where each one actually stands

| # | Pillar | Status | Where the code lives |
|---|---|---|---|
| 1 | Multi-channel input (photo / PDF / drawing / typed / voice, any device) | **Text only** at the time of writing; image/PDF input and browser-voice input were added the same day — see "Status update" below. | `src/app/api/v1/furniture/generate/route.js` |
| 2 | AI brain + internal furniture "language" | **Real, working first version.** Natural language → validated structured spec. | `src/lib/furniture-brain/brain.js`, `src/lib/fsl/` (schema/enums/validator) |
| 3 | Deep furniture knowledge (learned from a large reference corpus) | **Five categories, hand-authored** (wardrobe, kitchen, bookcase, office_cabinet, sideboard — see "Status update" below). Still not learned from ingested reference material — see Decision below. | `src/lib/furniture-knowledge/{wardrobe,kitchen,bookcase,officeCabinet,sideboard}.js`; the remaining five FSL types fall back to `genericCategory.js` |
| 4 | Live 3D model the client edits themselves | **Real but narrow.** Parametric, genuinely reactive — but covers fewer types/shapes than the live product already does elsewhere. | `src/components/builder/`, `src/lib/buildGeometry.js`, `src/lib/furnitureConfig.js` |
| 5 | Production output (CNC, nesting, blueprints, board specs) | **Cut list + drilling notes only.** No true nesting/sheet optimization, no CAD-grade drawing sheets, no BAZIS/CNC file export. | `src/lib/production.js` |
| 6 | Public API | **First surface exists.** One endpoint, not yet versioned/hardened/documented for external consumers. | `src/app/api/v1/furniture/generate/route.js` |

The short version: **pillar 2 (the brain + its own language) is the one
piece you've already built for real**, with 34 passing tests behind it. The
other five are either missing, partial, or exist in the *wrong* place (see
below).

## The complication a roadmap has to account for: two codebases

This repo contains two independent, non-interoperating implementations of
FurniAI, and each one is ahead of the other on a different pillar:

- **The live static site** (`index.html` / `app.js` / `styles.css`,
  deployed at `furnia.vercel.app`) has the **broader 3D and production
  feature set**: 11 furniture types including L/U walk-in closets and
  corner kitchen runs, 13 materials with reflective/procedural finishes, and
  a full client-side production document (cut list, hardware list, SVG
  orthographic drawings, printable PDF). Its AI agent (`api/chat.js`) is a
  single blunt tool (`set_furniture_config`) with no structured internal
  representation — it re-sends the whole config every turn.
- **The Next.js app** (`src/`, not deployed) has the **better AI
  architecture** — `buildGeometry.js` is a genuinely pure `config → parts`
  function, and FSL v1 is a real structured brain — but only renders 5 of
  10 furniture types, each as one plain rectangular carcass. No corner
  geometry, no L/U shapes, no multi-cabinet kitchen runs.

Every pillar above will eventually need to live in one place. Building
pillars 3–6 only inside `src/` risks recreating a more sophisticated system
that customers never see, since `src/` isn't deployed.

**Decision (2026-07-22): the Next.js app (`src/`) is the long-term home.**
The live static site's 3D/production strengths (corner cabinets, L/U
shapes, kitchen runs, material palette, production documents) get migrated
into `src/` over time; the static site is not the target to build further
into. This resolves what the original draft of this roadmap flagged as the
single biggest open decision — see "Open questions" below for the ones
still outstanding.

## A prior attempt at pillar 2, and why it's not the current direction

Before FSL v1, an earlier experiment (`/cad-lab`: a tool-registry + IR
system — `src/lib/ir/`, `src/lib/tools/`, `src/lib/engines/`,
`src/lib/rules/`) tried to solve the same "AI brain with structured output"
problem. It was superseded by FSL v1 and the `/cad-lab` page/route/store
were removed from the repo on 2026-07-21. Its supporting modules
(`src/lib/ir/`, `tools/`, `engines/`, `rules/`) were fully orphaned (nothing
imported from them) and have now been deleted (2026-07-22).

## Status update — 2026-07-22

Phase 1 (input expansion) work started same day this roadmap was written:

- `POST /api/v1/furniture/generate` now accepts an `attachments` array
  (images and/or a PDF) alongside `message`, using Claude's native vision
  input — no separate OCR/CV pipeline. See `docs/furniture-generation-api.md`
  for the request contract.
- `/fsl-lab` gained a file-attach control and a browser-speech-to-text mic
  button (Web Speech API) that fills the `message` field — voice reuses the
  existing text path client-side, exactly as this roadmap originally
  proposed, with no server-side voice handling.
- Orphaned `/cad-lab` support modules deleted (see above).

**Decision (2026-07-22): furniture expertise is built as hand-authored rule
files per category, not a reference-ingestion/retrieval system** — this
resolves what was open question 1 below. `kitchen.js`, `bookcase.js`, and
`officeCabinet.js` were added the same day, each with its own dimension
rules, defaults, and at least one category-specific semantic check (kitchen:
worktop-depth clearance and base-cabinet door width; bookcase: shelf-span
sag risk; office_cabinet: filing-drawer width) — the same shape as
`wardrobe.js`, not a shortcut. `office_cabinet` also fixes a latent bug this
process surfaced: it previously inherited the `office` configurator type's
750mm desk-height default via the generic fallback, which never fit what
"office_cabinet" names — it now defaults to a proper tall storage cabinet
(1800mm). All four dedicated categories are registered in
`furniture-knowledge/index.js`'s `KNOWLEDGE_BY_TYPE` and covered by tests
(29 new, 76 total passing). Reference-ingestion remains a possible future
upgrade, not ruled out — just not the v1 approach.

**Update (2026-07-23): `sideboard.js` added, same pattern.** A read-only
audit (requested before writing any code) confirmed `sideboard` had the
identical bug: it fell through to `genericCategory.js` and inherited the
`cabinet` configurator type's 1800mm-tall default from `knowledgeBase.js` —
wrong for a low, wide, display-height piece. `sideboard.js` now corrects
this (default 1600×800×450mm; see
[`docs/furniture-knowledge/sideboard-rules.md`](furniture-knowledge/sideboard-rules.md)),
registered in `KNOWLEDGE_BY_TYPE` the same way, with a regression test
proving it no longer resolves through the generic fallback. Deliberately
kept independent — no shared "cabinet base" module was introduced; each
category file remains its own thing, consistent with the decision above.
`leg` is in its allowed-components list (a genuinely typical sideboard
detail) but has no default quantity/properties, so it only appears when a
request explicitly asks for it — and since `leg` geometry is unsupported by
`/builder` today, any design that does include it is correctly reported as
`partially_supported`, not silently marked compatible. All five
configurator-supported FSL types now have dedicated knowledge; 90 tests
passing (76 → 90, +14).

A much larger research charter proposing exactly that reference-ingestion/
retrieval architecture (source registries, catalogs, case memory, GitHub/
standards/Reddit research, CAM/CNC/nesting) was reviewed on 2026-07-23 and
archived, unactioned, at
[`docs/research/furniai-brain-knowledge-research-master-prompt.md`](research/furniai-brain-knowledge-research-master-prompt.md)
— kept as a starting point if this decision is ever revisited, not as a plan
in progress.

**Pillar 4 (geometry expansion) is deprioritized, not just deferred.** The
live static site's corner-cabinet/plinth/door geometry has already been
through a long fix → revert → fix cycle (see git history) and the founder
does not want to reopen that work as a general "catch up to the live site"
push. Geometry code should only change when a specific furniture request
needs a shape that doesn't exist yet — not proactively. Sequencing below is
updated accordingly.

## Recommended sequencing

Not a commitment, a proposed order — each phase is independently useful and
ships on its own:

1. **Input expansion (pillar 1).** ~~Add image and PDF input to the
   `furniture-brain` request path~~ — done 2026-07-22, see "Status update"
   above. Remaining: surface attachment support in a real client, not just
   `/fsl-lab`.
2. **Knowledge expansion (pillar 3).** ~~Add dedicated
   `furniture-knowledge/<type>.js` files for the next few categories~~ — done:
   kitchen, bookcase, office_cabinet (2026-07-22), sideboard (2026-07-23);
   see "Status update" above. All five configurator-supported FSL types now
   have dedicated knowledge. The five configurator-unsupported types
   (`walk_in_closet`, `tv_unit`, `shoe_cabinet`, `bathroom_vanity`,
   `custom_cabinet`) still use the generic fallback by design — no
   configurator to render them into yet, so dedicated rules would have
   nothing to validate against beyond the concept stage.
3. ~~**Geometry expansion (pillar 4).**~~ **Skipped by decision (2026-07-22)**
   — no proactive rebuild of `buildGeometry.js`/the configurator to chase
   parity with the live site's corner/L/U/kitchen-run geometry. Only add a
   specific shape if a real request needs it.
4. **Production expansion (pillar 5).** Real sheet-nesting optimization
   (today's cut list has no layout/yield logic at all) and CAD-grade
   drawing sheets (SVG/PDF), aimed at an actual BAZIS or CNC-importable
   export format rather than a CSV a human retypes.
5. **API hardening (pillar 6).** Version `/api/v1/furniture/generate`
   properly, add auth and rate limiting, write external-facing docs. Low
   effort relative to the others since the contract already exists.

## Open questions (need your call, not a guess)

1. ~~**How should furniture expertise actually be built**~~ — decided
   2026-07-22: hand-written rule files per category, see "Status update"
   above.
2. **What's acceptable cost/latency for multimodal input?** Vision/PDF
   analysis is a per-request AI cost and adds latency versus the plain text
   path — worth setting a rough budget as usage grows.
3. **When does the static site → `src/` migration actually start**, and in
   what order (geometry first, then production, then cut the static site
   over)? The long-term home is decided; the migration plan itself isn't
   written yet.
4. ~~**Should `sideboard` get dedicated knowledge next**~~ — resolved
   2026-07-23: audited, confirmed the same inherited-default mismatch, and
   fixed with `sideboard.js`. See "Status update" above.
