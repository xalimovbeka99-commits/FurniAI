# Bathroom / TV Unit / Bookshelf / Office — Research Batch 5

Fifth pilot batch: real construction standards for the catalog types batch 1
didn't cover (batch 1 was kitchen/wardrobe-focused). This batch checks
bathroom vanities, TV units/sideboards, bookshelves, and office furniture
against the live site's actual `RANGES` (`api/chat.js`) and construction
logic (`index.html`'s `wall()`/`buildVanity()`/`buildSideboard()`). Unlike
batches 3-4, this one surfaced a real, concrete, previously-uncaught gap.

## Bookshelf — real gap found: shelf-span deflection risk

**Standards found**: the L/360 rule (max allowable sag = span ÷ 360, chosen
so sag is invisible to the eye) is the standard structural guideline for
shelving. A 3/4" (~19mm) shelf under normal residential load (20-25 lb/ft)
can safely span roughly 24-30" (61-76cm) between supports; reduce 15-20% for
adjustable pin supports (which is what this catalog uses — `shelf-pin holes
Ø5mm, 32mm system`, confirmed in [construction-standards.md](construction-standards.md)).
Deflection grows with the **cube** of span (δ ∝ L³) — doubling the span
means 8× the sag, not 2×. Floating/cantilever shelves (no far-end support)
sag **9.6×** more than the same shelf supported at both ends. Material
matters enormously: hardwood/plywood (~1.5-1.83M psi) resists sag far
better than particleboard/melamine (~0.4-0.43M psi).

**Cross-check against the live site — a real, previously-uncaught gap**:
bookshelf's `RANGES` in `api/chat.js` allow `w: [60, 240]` cm with
`sections: [1, 6]`. `wall()` in `index.html` gives each bay a shelf spanning
the **full bay width** (`sw = (W - panel×(N+1)) / N`). At the schema's own
allowed extremes — `w: 240, sections: 1` — that's a single ~236cm (93")
unsupported shelf span, roughly **3× the safe limit** for any panel material
in this catalog, none of which is solid hardwood (all are veneered MDF/
plywood per the material palette). The **Construction Validator (skill #1)
has no rule for this at all today** — every existing rule checks bays being
too *narrow*, none check a shelf being too *wide*. This is a real,
concrete, physics-backed gap, not a style preference.

**Proposed new Construction Validator rule** (not yet implemented — a
natural extension of the already-shipped skill #1, not a new skill):
flag when bay width exceeds a safe shelf-span threshold (~65-70cm for the
32mm/pin-supported construction this catalog uses, before reducing further
for very heavy expected loads) and `shelves > 0`. Severity `warning`,
suggesting either more sections (narrower bays) or fewer/no shelves at that
width. A single conservative threshold is enough for v1 — none of the
catalog's materials are solid hardwood, so a material-tiered threshold
isn't needed yet (see [construction-standards.md](construction-standards.md)-style
scope discipline: don't build for a distinction the data doesn't have).

## Bathroom vanity — a smaller, real realism gap

**Standards found**: 34-36" (86-91cm) "comfort height" is the real-world
default for vanity counters today; ADA maximum is 34" (86cm). Standard depth
21-22" (53-56cm). Toe-kick 4"H × 3"D (10×7.6cm).

**Cross-check against the live site**: `vanity_freestanding`/`vanity_floating`
share `h: [45, 100]` cm in `RANGES`. The lower end (45cm) is roughly half of
any real standing-height vanity standard — a customer (or the AI) requesting
a 45-50cm-tall "vanity" would get something no real bathroom vanity is ever
built at. Depth range `d: [40, 65]` and width `w: [60, 240]` both already
comfortably cover the real 53-56cm depth / up to ~183cm-for-double-basin
width standards, so only the height floor is unrealistic.

**Proposed addition**: a Construction Validator `info`-level note when
`type.startsWith('vanity')` and `h < 75`cm — below real comfort-height
range, "unusually low for a vanity — real vanity counters are typically
86-91cm from the floor." Info, not warning, since a deliberately low
"console"-style unit isn't structurally unsafe, just unusual.

## TV unit / sideboard — real safety + construction notes, not yet a rule

**Standards found**: the real US STURDY Act / ASTM F2057-23 / UL 1678
requirements exist specifically because TVs on top of storage furniture are
a documented tip-over risk — real anti-tip anchoring hardware is a
standard, expected line item for this furniture class. Real media consoles
also standardly include back-panel cable pass-throughs and 2-4" internal
clearance around AV equipment for heat dissipation.

**Cross-check against the live site**: `generateHardwareList()` has no
anti-tip hardware line for `sideboard`/TV-unit type at all, and
`buildSideboard()`'s back panel (`index.html`) is a single solid board with
no cable cutout modeled. **Not proposed as an immediate rule** — UAE (this
catalog's stated market) isn't bound by the US STURDY Act specifically, and
a cable-cutout is a cosmetic/functional detail, not a structural-safety
question the way shelf deflection is — but worth recording as a real,
concrete "what a serious TV-unit line would eventually need," should this
furniture type ever get its own dedicated attention the way kitchen/
wardrobe already have.

## Office furniture — a catalog gap, not a construction-rule gap

ANSI/BIFMA X10.1 (dimensions) and X5.1/X5.5/X5.6/X5.9/X5.11 (safety/
durability) are the real governing standards. Real reference dimensions:
filing cabinets 70-140cm H × 45-65cm D × 40-50cm W; credenzas 72-90cm H ×
120-200+cm L × 45-55cm D; 48" (122cm) clearance recommended behind a desk.

**What this means for Furni AI**: "office furniture" isn't one of the 11
types in `TYPES` (`api/chat.js`) today — there's no desk/filing-cabinet
category in the catalog at all. Not a bug, just confirms office furniture
is genuinely out of scope currently. These are the real dimensions to seed
`RANGES` with if that ever changes — noted for later, not actionable now.
