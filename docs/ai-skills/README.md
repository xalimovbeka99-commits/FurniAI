# Furni AI — Proposed AI Skills (Pilot Pass)

Output of the Furni AI Knowledge Acquisition methodology, scoped to what the
pilot research in [../knowledge-base/](../knowledge-base/README.md) actually
supports with real engineering content — not a wishlist. **Nothing in this
folder has been implemented.** These are proposals for review.

## Ground truth checked before writing these

- The **live** AI surface is `api/chat.js` + `index.html`/`app.js` (static
  site, no framework). Its only tool today is `set_furniture_config`
  (`api/chat.js:71-93`), operating on a flat, coarse config: `{type, sections,
  drawers, shelves, doorType, mat, handle, led, w, h, d}` (counts, not
  per-module detail; dimensions in cm).
- The live site currently has **no construction validation and no hardware
  BOM at all** — `sanitizeConfig()` (`api/chat.js:102-119`) only clamps values
  to a manufacturable *range*, it doesn't check whether the combination makes
  sense together (e.g. 6 drawers in a 45cm-tall unit).
- The dormant Next.js tree (`src/lib/production.js`, `src/lib/knowledgeBase.js`)
  has a *more detailed* config schema and already-real cutlist/drilling-spec
  logic, but is not live traffic today.
- The site explicitly never shows prices (`api/chat.js:68`) — any skill
  proposal that implies pricing logic is out of scope for the live surface.

Given that, the two highest-value, most groundable proposals both target
**extending `api/chat.js`'s tool loop with a new, additional tool** — same
pattern as `set_furniture_config`, called right after it, not a rebuild of
anything. See [proposed-skills.md](proposed-skills.md).

## On the "Furniture Specification Language (FSL)" idea

The research brief suggested formalizing a dedicated spec language. Recommend
**against** starting one now: `api/chat.js`'s `CONFIG_TOOL` schema and the
dormant `src/lib/configSchema.js` already function as a de facto FSL for
their respective surfaces. Introducing a third, parallel schema right after
removing one experimental system (CAD Lab) would repeat the same mistake —
extend the schema that already exists and is live, incrementally, field by
field, rather than inventing a new spec language to hold future knowledge.
