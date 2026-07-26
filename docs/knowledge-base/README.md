# Furni AI Knowledge Base — Research Batches

Research-only output from the Furni AI Knowledge Acquisition methodology. **No code
was changed to produce this** (except where a batch's findings were explicitly
approved for implementation — see the ai-skills folder for what's shipped).
The goal: research public furniture-engineering projects and standards,
extract the engineering knowledge behind them (not the code), and turn it
into permanent, reusable knowledge that can later extend the **live site**
(`index.html`/`app.js`/`api/chat.js`/`src/lib/*`) — never a separate rebuild.
Standing rule going forward: any repo/standard discovered should be converted
into (1) knowledge, (2) a candidate AI skill, (3) a note on how it would
extend the existing system.

Covered so far, out of the ~45 topics in the full research brief:

**Batch 1** — kitchens, wardrobes, production cutlists:
1. Kitchen cabinet design (parametric/open-source)
2. Wardrobe / walk-in closet design (parametric/open-source)
3. Cabinet construction standards (32mm system, carcass/drawer joinery)
4. Furniture hardware (hinges, drawer slides, pulls)
5. Parametric furniture modeling frameworks
6. Furniture CAD / DXF / nesting tooling

**Batch 2** — vision/recognition (feeds the Style/Image Recognition skill):
7. Furniture style recognition / classification
8. Furniture image datasets / general classifiers
9. Furniture computer vision / object detection
10. Furniture AI/ML (interior design, generative)
11. Furniture recommendation systems

**Batch 3** — desktop CAD plugin ecosystem (mostly a validation pass):
12. SketchUp extensions / cabinet plugins
13. AutoCAD furniture tooling
14. Fusion 360 furniture add-ins
15. Blender furniture add-ons
16. General open-source woodworking software

**Batch 4** — drawings/blueprints/PDF/OCR (also mostly a validation pass):
17. Furniture technical drawings / blueprint generation
18. Furniture PDF drawings / dimension parsing
19. Furniture drawing OCR

**Batch 5** — the catalog types batch 1 didn't cover (a real gap this time):
20. Bathroom vanity/cabinet design standards
21. TV unit / media console design standards
22. Bookshelf design standards (shelf span/deflection)
23. Office furniture design standards

**Targeted (not a numbered batch)** — image-to-custom-design, triggered by a
real gap found while extending the `custom` furniture type to photo uploads:
24. Single-image 3D reconstruction vs. VLM-based dimension estimation

## Documents

- [open-source-landscape.md](open-source-landscape.md) — batch 1 repo-by-repo
  extraction (purpose → skills → architecture → what Furni AI can learn →
  integration path)
- [construction-standards.md](construction-standards.md) — the 32mm system and
  real carcass/drawer joinery methods, checked against what `production.js`
  already encodes
- [hardware-specifications.md](hardware-specifications.md) — real hinge/slide/
  leg/pull specs; the real version of this now ships in `index.html`'s
  `generateHardwareList()`, see [../ai-skills/proposed-skills.md](../ai-skills/proposed-skills.md)
- [vision-recognition-landscape.md](vision-recognition-landscape.md) — batch 2:
  style classifiers, object detectors, recommendation systems, and a
  generative-interior-design system, extracted for the Style/Image
  Recognition, Similar Design Finder, and (future) Render Generator skills
- [cad-tooling-landscape.md](cad-tooling-landscape.md) — batch 3: SketchUp/
  AutoCAD/Fusion360/Blender plugins and open-source woodworking software —
  mostly confirms existing choices (hinge-side convention, BOM structure,
  cutlist-from-parameters) rather than surfacing new gaps; one small future
  idea (JSON export alongside the existing CSV/HTML production documents)
- [drawings-pdf-ocr-landscape.md](drawings-pdf-ocr-landscape.md) — batch 4:
  the live site's blueprint/technical-drawing *generation* is already
  confirmed solved; the reverse direction (reading a drawing/PDF a customer
  sends in) is covered for photos/scans by the existing Style/Image
  Recognition skill, with one future refinement noted for born-digital PDFs
  (extract the text layer directly instead of a vision call)
- [remaining-catalog-types-landscape.md](remaining-catalog-types-landscape.md) —
  batch 5: a **real, concrete gap found** — the bookshelf schema's own
  allowed range (`w:240cm, sections:1`) permits a ~3× oversized unsupported
  shelf span with zero warning today; real L/360 deflection standards make
  this a genuine, physics-backed Construction Validator addition, not a
  style nitpick. Smaller notes on vanity height realism and TV-unit safety/
  cable-routing hardware also included.
- [image-to-custom-design-landscape.md](image-to-custom-design-landscape.md) —
  true image-to-3D mesh reconstruction (Tripo/Meshy/Hunyuan3D) is real but
  produces geometry with no construction semantics — same deferred tier as
  the Render Generator. VLM-based proportion estimation is the right tier
  (same as Style/Image Recognition already uses) and is what got shipped:
  photo uploads can now trigger `set_custom_design`, not just presets.
  Testing surfaced a real secondary gap — a floating-gap coordinate error
  (opposite of the earlier sinking-tabletop bug) that the overlap-only
  backstop doesn't catch. **Fixed properly**: parts now declare
  `restsOnFloor`/`restsOnParts` explicitly, so the checker verifies only
  real declared relationships (never guessing, never false-positiving on
  intentional gaps) and computes an exact corrected y — feeding the same
  auto-repair chip. Re-verified: both original bugs and a previously-broken
  asymmetric chair now produce zero findings and flush joints.

See also [../ai-skills/README.md](../ai-skills/README.md) for the skill
proposals this research produced, and which are already shipped.

## Key top-line finding

The single most relevant discovery is **`chemrich/cabinet-mcp`**: an MCP server
that does, for general cabinetry, almost exactly what our own (now-removed) CAD
Lab experiment was reaching for — parametric presets, graded (non-binary)
validation, real hardware catalogs, cutlist/BOM export, and 23 AI-callable tools
— except it's mature, tested (283 scenarios / 940 assertions), and already
production-shaped. It's strong external validation that the tool-registry /
graded-validation pattern is the right one; see
[open-source-landscape.md](open-source-landscape.md#cabinet-mcp) for the detail.

## Key gap found

No open-source, parametric, engineering-grade tool exists specifically for
**wardrobes/walk-in closets** or for **cabinet hardware as structured data**
(hinge/slide/pull catalogs are locked inside vendor product pages, not a
database or API). Both are real opportunities for Furni AI to build knowledge
no one else has published in reusable form — see the gap notes in
[hardware-specifications.md](hardware-specifications.md) and
[open-source-landscape.md](open-source-landscape.md#wardrobe--walk-in-closet).
