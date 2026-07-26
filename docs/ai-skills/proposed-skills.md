# Proposed AI Skills — Detail

Format follows the research brief: Skill Name / Problem Solved / Input /
Output / Required AI / Required Models / Possible Libraries / Possible Open
Source Projects / Complexity / Priority / Future Version.

---

## 1. Furniture Construction Validator

**Problem solved**: `sanitizeConfig()` in `api/chat.js:102-119` clamps every
field to a valid *range* independently, but never checks whether the
*combination* is sound — e.g. `drawers: 6` on an `h: 45` (cm) unit gives each
drawer under 6cm of usable front height; `shelves: 7` on a 240cm-wide, 25cm
deep bookshelf risks visible sag with no center support; a `doorType: mirror`
section at the widest allowed `w` may exceed what a single mirror pane can
safely span. None of this is caught today — the customer (and the factory)
only finds out at build time.

**Input**: the sanitized config object already produced by `sanitizeConfig()`
(same shape, no new fields required for a first version).

**Output**: an array of graded findings, e.g. `{ severity: "info"|"warning"|
"error", field, message }` — matching cabinet-mcp's "typed and graded by
severity, not binary pass/fail" pattern (see
[../knowledge-base/open-source-landscape.md#cabinet-mcp](../knowledge-base/open-source-landscape.md#cabinet-mcp)).
Never blocks config creation — surfaced as a short aside in the assistant's
natural-language reply ("heads up — at this height I'd space those drawers a
little differently") and/or a subtle badge in the UI, not a hard error.

**Required AI**: none for the rule engine itself — deterministic, like
`production.js`'s existing `buildDrillingSpec()`. Optional: reuse the same
Claude call already happening in `api/chat.js` to phrase findings naturally
instead of as a raw rule-engine message (no second model call needed — pass
the findings into the same system prompt turn).

**Required Models**: none additional (existing `claude-sonnet-4-6` call in
`api/chat.js:22` is sufficient for phrasing; the checks themselves are plain
JS).

**Possible Libraries**: none.

**Possible Open Source Projects**: cabinet-mcp's evaluation engine (pattern
only — clearance/structural/hardware-fit/joinery-compatibility categories,
graded severity, measured values in the message rather than a bare boolean).

**Complexity**: Medium (a pure function + a dozen real rules to start; no UI
rebuild, no schema change).

**Priority**: High — directly closes a real, confirmed gap, touches only
`api/chat.js`, fully reversible, no risk to the existing configurator.

**Future version**: cabinet-mcp's *auto-repair* pattern — instead of only
flagging, propose a corrected config (e.g. auto-reduce `drawers` or
redistribute `shelves`) and let the customer accept it in one click.

**IMPLEMENTED (2026-07-17)**: `finding()` now optionally carries a `fix` —
a deterministic partial-config patch computed by the same rule that found
the problem (narrow bays → fewer sections, shelf span too wide → more
sections, kitchen/sideboard drawers with <2 sections → sections:2).
`index.html` renders these as a one-click "Apply: sections → 4" chip.
**A real ordering bug was caught and fixed during testing**: the chip's
click handler initially mutated `Builder.cfg` directly, but for a
newly-generated (not yet a refinement) design, `Builder.cfg` doesn't
represent the new design yet at click time — navigation to it is
deliberately delayed so the chip is visible at all (same delay mechanism as
skill #4's similar-design chips). Fixed by having the chip correct the
*pending* config object and open that corrected version directly, instead
of touching `Builder.cfg` before it's ready — verified with a real
end-to-end browser test (AI creates an unsafe 6-section wardrobe → chip
reads "Apply: sections → 4" → click → correctly rebuilds at 4 sections, zero
console errors). Only applies to preset-type warnings for now (custom-parts
auto-repair — e.g. auto-nudging an overlapping part — is a harder problem,
not attempted this round).

**Update 2026-07-15 (research batch 5)**: added a shelf-span deflection-risk
rule and a vanity-height realism note, both grounded in real L/360 shelving
standards (see
[../knowledge-base/remaining-catalog-types-landscape.md](../knowledge-base/remaining-catalog-types-landscape.md)).
The bookshelf schema's own allowed range (`w:240cm, sections:1`) permitted a
~236cm unsupported shelf span — roughly 3× the safe limit for this
catalog's pin-supported 32mm-system construction — with zero warning before
this. Applies to every type with adjustable shelves (wardrobe/walkin/
bookshelf/vanity/sideboard), not just bookshelf, since the physics doesn't
care what the furniture is called; kitchen is excluded since `kitchenRun()`
has no adjustable-shelf concept. Verified with unit tests (the exact
research-flagged extreme case, a safe 4-section case, kitchen exclusion, a
too-short vanity, and regression on the existing rules) and a real
end-to-end AI call — the assistant wove the warning into its reply with a
concrete fix (add sections) without blocking the design, consistent with
every other finding in this validator.

---

## 2. Hardware Recommendation & BOM — IMPLEMENTED (2026-07-15)

**Correction to the integration path guessed below**: this turned out not to
belong in `api/chat.js` at all. The live site already had a real, deterministic
hardware-BOM function — `generateHardwareList(cfg, panels)` in `index.html`
(feeds the "Generate production documents" factory order sheet, pillar 7) —
which is the natural, already-wired home for this. Implemented by upgrading
that function directly: per-door-panel hinge count/model via a real
`hingeSpecFor(doorHeightMm)` (Blum Clip Top, Ø35mm cup, count from the
*panel's own* height — 2 up to 1200mm, 3 up to 1800mm, 4 beyond, matching
[construction-standards.md](../knowledge-base/construction-standards.md)),
per-drawer-bay slide tier via `slideSpecFor(bayWidthMm, depthMm)` (Blum
Tandem 550H/plus 563H/Movento 760H, 30/50/60kg), and handle pack-quantity
math (`Math.ceil(qty / HANDLE_PACK_SIZE)`). Verified with unit tests on the
extracted pure functions across 7 configs (including doorless/drawerless
edge cases) and a real Playwright render of the factory order sheet.
Fixed a real latent bug in the process: the old hinge count only checked
overall cabinet height (`cfg.h>=200`), so a kitchen (whose individual door
panels are always short — ~78-92cm) could wrongly get 3 hinges per door
just because the *cabinet* was tall; now correctly always 2, per door panel.

**Original proposal (superseded by the above):**

**Problem solved**: hardware today (in the dormant `knowledgeBase.js:39-45`)
is flat per-unit pricing with no model differentiation — a 30cm drawer and a
120cm drawer get the identical `drawerSlide` line, and there's no real
hinge-model, load-based-slide, or pull-pack-quantity logic anywhere in the
codebase, live or dormant. This is a genuine, confirmed gap in the furniture
industry too — no open hardware database exists (see
[../knowledge-base/hardware-specifications.md](../knowledge-base/hardware-specifications.md)) — so building this well is a real, defensible differentiator, not
catch-up work.

**Input**: the same config (`type, sections, drawers, shelves, w, h, d,
doorType`) already available in `api/chat.js`.

**Output**: a structured hardware BOM: hinge count + real model tier (using
Blum's placement thresholds — 100mm from door edge, extra hinge past
1200mm/1800mm door height, already loosely matched by the live
`H > 1800 → 5, H > 1200 → 4, else 3` formula in `production.js:65`, just
extended with an actual model name/overlay type instead of only a count);
drawer slide model matched to bay width/depth as a load proxy; pull/knob
line with pack-quantity math (`packsNeeded = Math.ceil(qty / packSize)`).

**Required AI**: none for the recommendation logic itself (deterministic
lookup against a curated hardware table, same shape as
`knowledgeBase.js`'s existing `HARDWARE`/`HANDLE_STYLES` objects, just
richer). Optional LLM pass only to explain *why* a heavier-duty slide was
picked, if surfaced to the customer.

**Required Models**: none additional.

**Possible Libraries**: none.

**Possible Open Source Projects**: cabinet-mcp's curated hardware data shape
(7 drawer-slide models with load ratings, 7 Blum hinge variants, pull
pack-quantity math) — a structure to emulate with Furni AI's own real
supplier SKUs, not to copy verbatim (their exact catalog is theirs).

**Complexity**: Medium (mostly data entry — typing in real supplier
part numbers/load ratings once, then simple lookup logic).

**Priority**: High — same low-risk profile as #1, and it's the concrete
first step of "convert repo discovery into permanent Furni AI knowledge"
from the research brief's own stated goal.

**Future version**: connect line items to real supplier stock/price feeds;
extend the Construction Validator (#1) to cross-check hardware fit (e.g.
flag when a chosen slide's load rating is exceeded by the estimated drawer
weight for that material/size).

---

## 3. Furniture Style/Image Recognition — IMPLEMENTED (2026-07-15)

**What shipped, exactly**: no new endpoint, no separate structured-output
contract — an image is just another content block in the same
`set_furniture_config` tool-calling turn `api/chat.js` already had. Frontend:
a 📷 attach button on both chat surfaces (`index.html`'s main `#/ai` chat and
the in-builder "Ask AI" drawer), client-side resize to a 1024px max dimension
+ JPEG re-encode via canvas (keeps payload well under Vercel's body-size
limit regardless of the original photo size), a small thumbnail preview
before sending and inline in the sent message bubble. Backend: `content` may
now be a string (unchanged) or an array of Anthropic content blocks;
`sanitizeMessages()`/`sanitizeContentBlock()` allow-list image media types
and cap base64 size, dropping anything else silently rather than passing
untrusted shapes straight to the API — same defense-in-depth posture as
`sanitizeConfig()`. System prompt extended with one paragraph: describe what
you see, map it onto the existing vocabulary, call `set_furniture_config`
same as from text, never claim to recognize a specific real product/brand.

**Verified three ways**: unit tests on the extracted sanitizer (valid image+
text, invalid media type stripped, oversized image stripped, bad role
dropped — 7 cases); direct API calls with a real photo (a Playwright
screenshot of the site's own 3D wardrobe render) that correctly read glass
doors, gold handles, drawer count, and ivory material, landing on nearly
identical dimensions to the source design; a full real-browser click-through
(attach → preview appears → send → image shows in the sent bubble → preview
clears → assistant replies → new design opens in the builder) with zero
console errors.

**Original proposal (for context — matches what shipped closely):**

**Problem solved**: customers often start from an inspiration photo, not
words — today there's no way to turn "I like this photo" into a seeded
config or a matched design. This is the research brief's own worked example
skill, and it's genuinely the right shape for a first vision skill: narrow
input, narrow output, no new architecture.

**Confirmed by research batch 2** (see
[../knowledge-base/vision-recognition-landscape.md](../knowledge-base/vision-recognition-landscape.md)):
every open-source furniture classifier/detector found (plasmon360's ResNet34
style classifier, the iMaterialist/Flying-Furniture CNN classifiers, YOLOv5/
Detectron2 detectors) exists to solve a problem Furni AI doesn't have —
they all classify a *closed vocabulary the model doesn't already know*
(what type of furniture is this, out of N trained classes). Furni AI already
knows the furniture type (the customer told it); it only needs a *style/
material/door-type read* of a photo, which a vision-capable LLM does in one
call with zero training data — no bespoke model or dataset needed here, this
was the right scope from the start.

**Input**: a customer-uploaded furniture photo (wardrobe/kitchen/etc.).

**Output**: `{ furnitureType, style, dominantMaterialGuess, doorTypeGuess,
confidence }`, used to pre-fill a `set_furniture_config` call instead of
starting from defaults.

**Required AI**: Yes — a vision-capable call.

**Required Models**: the same Claude model family already in use
(`claude-sonnet-4-6` supports image input) — no separate CV/vision model or
new API key needed, just an additional multimodal message in the existing
`api/chat.js` conversation.

**Possible Libraries**: none beyond image upload handling on the frontend
(base64 the file, attach as an image content block).

**Possible Open Source Projects**: none directly reusable — this is
inherently a vision-LLM-prompting task, not something an open-source style
classifier would do better than Claude already does today.

**Complexity**: Medium (needs an image-upload affordance in `index.html`'s
chat UI + a multimodal message branch in `api/chat.js`; no backend rebuild).

**Priority**: Medium — a real differentiator, but not blocking anything the
sales flow needs today; sequence after #1 and #2.

**Future version, IMPLEMENTED (2026-07-17)**: active preference memory now
ships. `summarizePreferences()` in `api/chat.js` computes real MAJORITY
patterns (a choice repeated in over half of a customer's past designs, not
a one-off) across `material`/`handle`/`doorType`/`led`, and feeds them into
the system prompt as a soft default bias — a customer whose past designs
are consistently walnut+gold gets that as the default for a brand-new
design, without ever being asked, while anything they explicitly request
still overrides it. Requires 2+ past designs and a genuine >50% majority;
a single data point or an even split correctly produces no bias.
**A real bug found and fixed first**: `sanitizePastDesigns()` always ran
`sanitizeConfig()` regardless of type — since `'custom'` isn't in the
11-value preset `TYPES` enum, any saved custom design would have been
silently coerced into a fake "wardrobe" (wrong type, wrong dimensions,
parts array discarded entirely) the moment it became part of a customer's
memory context. Fixed by branching to `sanitizeCustomDesign()` for
`type==='custom'` entries — this would have quietly corrupted both the
existing reactive recall ("the one from last time") and the new preference
feature for any customer who'd saved a custom piece. Verified end-to-end: a
simulated customer with 3/3 walnut+gold past designs got a walnut bookshelf
by default from "design me a bookshelf" alone, and unit tests confirmed the
guard against thin/mixed data (0-1 designs, exact 50/50 splits) correctly
produces no forced bias.

Feed accepted matches into a **Furniture Project Memory**
skill (from the research brief's own skill list) — remember a returning
customer's visual preferences across sessions, extending the existing
Supabase `projects`/`ai_conversations` tables rather than a new store. Also
worth adopting from plasmon360's classifier: when a customer corrects a
misread ("that's walnut, not oak"), log the correction — over time this
becomes a real, proprietary dataset of exactly the styles/materials Furni
AI's own customers care about, which no generic model provides.

**IMPLEMENTED (2026-07-17)**: new `log_correction` tool, called alongside
`set_furniture_config`/`set_custom_design` in the same turn. The tool's own
description carries the distinction that matters: a stated error ("that's
walnut, not oak") gets logged; a routine change of mind ("actually make it
black instead") doesn't. Writes to a new append-only `ai_corrections`
Supabase table (RLS-scoped per user, same pattern as
`projects`/`ai_conversations`), client-side, best-effort — never blocks the
chat UI, silently no-ops when signed out. Verified both directions with
real API calls: a genuine correction correctly fixed the design AND
returned `correction:{field:'mat',wrongValue:'oak',correctValue:'walnut'}`;
a routine change correctly fixed the design with `correction:null` — never
logged. A real browser click-through (build → refine via a stated
correction) produced zero console errors.

**Also** (research batch 4, see
[../knowledge-base/drawings-pdf-ocr-landscape.md](../knowledge-base/drawings-pdf-ocr-landscape.md)):
if a customer ever attaches a born-digital PDF (a real spec sheet or CAD
export, not a photo) rather than an image, extracting its text layer
directly (PyMuPDF/pdfplumber-style) would be faster, free, and more precise
than sending it through a vision call — worth branching on file type if/when
that use case shows up, not needed for photo uploads.

---

## 4. Furniture Similar Design Finder — IMPLEMENTED (2026-07-15)

**What shipped**: exactly the attribute-overlap approach proposed below, no
changes needed. `scoreDesignMatch(d, cfg)` in `index.html` weights `type`
match heaviest (+40), then `mat`/`doorType`/`handle`/`led` (+20/+15/+10/+5),
plus a small bonus for close overall dimensions. `findSimilarDesigns(cfg, 3)`
scores every `DESIGNS` entry and returns the top matches; shown as clickable
chips ("Closest existing designs: Glass Wardrobe (75% match), …") only when
a config came from an **image-attached** message (not plain text — the
"I have an inspiration photo" scenario this skill targets) and the top score
clears a 40-point floor (real type match at minimum), so it never fires with
noise for a config that doesn't resemble anything in the catalog.

**A real bug caught during implementation, not in the original design**:
the existing flow auto-navigates to a freshly AI-generated design the
instant `data.config` comes back (`openAiDesignInBuilder` → `go(...)`) —
which would have made the similar-designs chips flash and disappear before
anyone could read or click them, since the navigation switches the visible
view. Fixed with a short delay (2.5s) before that auto-navigate, cancelled
if the user clicks a chip first (a `picked` flag) — otherwise unclicked
chips still resolve to the new design exactly as before, unchanged default
behavior. Verified both paths with real browser tests: clicking a chip
navigates directly to that catalog design and the pending auto-navigate
does NOT fire afterward; not clicking anything still lands on the new
AI-generated design after the delay.

**Also verified**: unit-tested `findSimilarDesigns` directly against the
real 30-entry catalog — an exact-attribute config scores its source design
100%, a photo-derived config (via skill #3) correctly ranked the actual
source catalog entry ("Glass Wardrobe") #1 in a real end-to-end run, and an
intentionally mismatched config (bookshelf/mirror/navy) correctly produced
only moderate, type-only-matched scores rather than false positives.

**Original proposal (for context — matches what shipped):**

## 4. Furniture Similar Design Finder (new, from research batch 2)

**Problem solved**: a customer with an inspiration photo wants to know
"which of your existing designs looks like this," not just an abstract style
label — a natural companion to #3, and one of the skills explicitly named in
the original research brief's skill list ("Furniture Similar Design Finder,"
"Furniture Inspiration Search") that wasn't covered in the first proposal
pass.

**Grounded in**: iDECOR's detect→embed→cosine-similarity-retrieve pipeline
(see [../knowledge-base/vision-recognition-landscape.md#idecor-ikea-furniture-recommender](../knowledge-base/vision-recognition-landscape.md#idecor-ikea-furniture-recommender))
— but simplified to fit Furni AI's actual stack. iDECOR needs a detect step
because room photos contain multiple objects; a customer's inspiration photo
is already a single item, so that step is unnecessary. True vector cosine
similarity needs a hosted embedding model (VGG16/InceptionV3/CLIP) Furni AI
doesn't have — the pragmatic v1 is **attribute-overlap scoring** instead: run
skill #3's photo read once, then rank the existing `DESIGNS` catalog entries
in `index.html` by how many attributes match (`type`, `mat`, `doorType`,
`handle`, aspect-ratio-of-`w:h:d`), returning the top 3-5. This is a real
simplification (attribute overlap isn't as precise as learned visual
similarity) but needs zero new infrastructure and is honest about the
tradeoff, not a fake version of the "real" approach.

**Input**: the structured output of skill #3, plus the existing `DESIGNS`
array (no new data source).

**Output**: top 3-5 matching catalog entries (index into `DESIGNS`), so the
AI can say "this looks closest to your Oak Sideboard — want to start from
that and adjust?"

**Required AI**: none beyond skill #3's existing vision call — the ranking
itself is plain JS (score by attribute overlap).

**Required Models**: none additional.

**Possible Libraries**: none.

**Possible Open Source Projects**: iDECOR (pattern only — see above).

**Complexity**: Low, once #3 exists (it's a scoring function over data
that's already in memory client-side).

**Priority**: Medium — a natural, cheap extension of #3; build right after
it, not before.

**Future version**: replace attribute-overlap scoring with real embedding
similarity if/when the catalog grows large enough that attribute matching
stops being precise enough (a hosted CLIP-style model, called the same way
iDECOR uses VGG16/InceptionV3) — explicitly deferred, not needed at current
catalog size (~30 entries).

---

## 5. Furniture Render Generator (future, from research batch 2 — do not build yet)

**Problem solved**: "show me what this would look like" as a photorealistic
render, not the existing stylized Three.js configurator view — a skill
explicitly named in the original research brief's list, but **architecturally
unrelated to skill #3** despite both involving "AI + a photo." Recording this
now specifically so it doesn't get conflated with or scoped alongside the
lightweight vision-recognition skills above.

**Grounded in**: StableDesign's real architecture (see
[../knowledge-base/vision-recognition-landscape.md#stabledesign-generative-interior-design](../knowledge-base/vision-recognition-landscape.md#stabledesign-generative-interior-design))
— dual ControlNet (segmentation + depth) conditioning a LoRA-fine-tuned
Stable Diffusion model, plus a scene-detection and auto-captioning stage.
This is a **generative image model stack**, not a vision-LLM call — a
fundamentally different, much heavier engineering lift (model hosting/
fine-tuning, GPU inference, room-structure conditioning) than anything else
proposed in this document.

**Input**: a room photo (or the existing 3D configurator's own render) plus
the customer's chosen config.

**Output**: a photorealistic furnished visualization.

**Required AI**: Yes — a diffusion model, not an LLM call.

**Required Models**: Stable Diffusion + ControlNet (segmentation + depth) at
minimum; LoRA fine-tuning for a consistent Furni AI aesthetic would need a
real training pass on Furni AI's own catalog imagery.

**Possible Libraries**: `diffusers` (Hugging Face), ControlNet checkpoints
referenced in StableDesign (`controlnet-seg-room`, `sd-controlnet-depth`).

**Possible Open Source Projects**: Lavreniuk/generative-interior-design
(architecture reference only).

**Complexity**: High — real model hosting/GPU cost, a training pipeline if
fine-tuning is wanted, and no existing infrastructure in this repo for any
of it (the live site is a static site + a lightweight serverless function;
this needs a persistent inference service).

**Priority**: Low for now — flagged as a real, valuable future capability
matching the original vision's "see designs coming to life," but explicitly
**not** something to start alongside the low-cost skills above. Revisit once
skills #1-4 are shipped and validated.

**Future version**: N/A — this *is* the future version; no smaller v1 exists
that isn't just skill #3 again.
