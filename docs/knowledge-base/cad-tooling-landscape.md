# CAD Tooling Landscape — Research Batch 3

Third pilot batch: SketchUp extensions/cabinet plugins, AutoCAD furniture
tooling, Fusion 360 furniture add-ins, Blender furniture add-ons, general
open-source woodworking software. Chosen to check whether the desktop-CAD-
plugin world has solved anything the live site's own cutlist/hardware/
joinery logic hasn't — mostly a validation pass this time, less a "new gap
to fill" pass than batches 1-2.

## SketchUp

**Cutlister** ([danawoodman/Google-Sketchup-Cutlister-Plugin](https://github.com/danawoodman/Google-Sketchup-Cutlister-Plugin),
unmaintained) and **OpenCutList** — both open-source, both do one thing:
turn a SketchUp model into a printable cut list. **SketchUp-Parametric-
Modeling-Plugin** ([SamuelTallet](https://github.com/SamuelTallet/SketchUp-Parametric-Modeling-Plugin))
adds a node-graph (Blueprints-style) parametric layer on top of SketchUp.
**ArchiWood** and **CabMaker** are commercial full cabinet-design systems
with nesting/CNC output built on SketchUp.

**What Furni AI can learn**: nothing architecturally new — these are all
"model in a GUI, then extract a cutlist," the same one-way flow
`generatePanelList()`/`generateHardwareList()` already do, just from a
different starting CAD tool. Confirms cutlist-from-parameters is the
standard shape of this problem industry-wide, not a Furni AI-specific
simplification.

**Can this become a skill?** No — reference/confirmation only.

## AutoCAD

Mostly free LISP-routine collections ([fbrandao2k/Autocad-lisp](https://github.com/fbrandao2k/Autocad-lisp),
[CADstudioCZ/VisualLISP](https://github.com/CADstudioCZ/VisualLISP)) for
general CAD automation, plus real forum threads (BricsCAD/CADTutor) of
individual developers independently building "parametric wardrobe/kitchen/
cabinet generator" tools in AutoLISP for BricsCAD Mechanical — handling
corpus, fronts, drawers, shelves, partitions. No finished, published
open-source repository found for any of these; they're WIP forum projects,
not something to extract architecture from.

**What Furni AI can learn**: the demand signal itself is notable — multiple
independent developers, unconnected to each other, are solving "generate a
parametric wardrobe/kitchen from parameters" as a real, recurring problem in
the CAD world. That's third-party validation that Furni AI's core premise
(parametric furniture generation from a config) is solving a genuine,
widely-felt gap, not a niche one.

**Can this become a skill?** No — confirmation only.

## Fusion 360

**WoodWorkingWizard** ([fabio1994/WoodWorkingWizard](https://github.com/fabio1994/WoodWorkingWizard))
is the most detailed find here: a Fusion 360 add-in for parametric cabinets/
bases/toekicks with a genuinely relevant feature set —

- **5-piece drawers** with automatic groove cutting, custom depth
  validation, and configurable slide clearances
- **Intelligent height distribution** when drawer heights are customized
  individually rather than uniform
- **Correct hinge-side logic on double doors** — left door hinges left,
  right door hinges right

**Direct cross-check against the live site**: that exact hinge-side
convention (`hinge=(i%2===0)?'left':'right'` in `index.html`'s `wall()`/
`kitchenRun()`) is already what Furni AI does — this is independent
third-party confirmation it's the standard, correct convention, not an
oversimplification. The "custom depth validation" / "intelligent height
distribution" ideas are a real, not-yet-covered extension of the
**Construction Validator** (skill #1): today's schema only takes a drawer
*count*, not per-drawer custom heights, so this doesn't apply yet — worth
remembering if the config schema ever grows to support non-uniform drawer
heights.

**Also found**: "Furniture for Fusion 360" (CAD Studio) and **JoinerCAD**
— both commercial, both auto-generate hardware holes + a full BOM from a
parametric model, same shape as skill #2 (Hardware Recommendation & BOM),
already shipped.

**Can this become a skill?** Not new — validates #1 and #2 as already
correctly scoped; one concrete future-version note added to #1's doc.

## Blender

**blender_furniture_builder** ([mikhailefimov](https://github.com/mikhailefimov/blender_furniture_builder))
is the closest architectural cousin to Furni AI's own approach found in this
batch: a Python builder-pattern API — `Cabinet(...).section(0.8, doors=2,
shelves=1).make()` — that generates real cabinet construction (panels,
shelves, doors, hardware points) and **two separate BOM files**:
`bom_hardware.csv` and `bom_sheet.csv`.

**What Furni AI can learn**: the hardware/sheet-material BOM *split* is a
clean pattern worth naming explicitly, even though the live site's factory
order sheet already effectively does this (separate Panel List and Hardware
List sections in `openOrderModal()`/the print output) — this batch confirms
that's the right structure, not something to merge into one table.

Other Blender finds: **Furnimatic** (commercial parametric kitchen/wardrobe/
TV-unit generator), **Craftsman Cabinet Creator** (Geometry Nodes-based,
GPL-3.0), **blender-woodworking-addon** ([itzg](https://github.com/itzg/blender-woodworking-addon),
measurement overlay + cutlist + board-foot calculator), **archimesh**
(built-in Blender add-on with a kitchen generator) — all consumer/maker
tools, none introducing a construction-knowledge concept Furni AI doesn't
already have.

**Can this become a skill?** No — the BOM-split confirmation is noted as a
design-validation point, not a new skill.

## General woodworking software

**dprojects/Woodworking** ([FreeCAD workbench](https://github.com/dprojects/Woodworking))
is the most feature-rich open-source find in this whole batch: `magicStart`/
`magicMove`/`magicResizer` for rapid structural editing, `magicDowels`
(automated dowel/mounting placement — comparable to the live site's
confirmat-joinery spec in `production.js`), `magicDriller` (holes,
countersinks, counterbores, pocket holes), and a `getDimensions` → cutlist
export step supporting **csv, json, html, and markdown** via a `sheet2export`
step, plus wood weight/cost estimates.

**What Furni AI can learn**: the live site's factory order sheet currently
exports **CSV and an HTML print view** only (`cutListToCSV()`, `openOrderModal()`'s
print output) — this is real precedent that a **JSON export** is a natural,
low-effort addition for any downstream system (a factory's own software,
BAZIS, a spreadsheet macro) that wants structured data rather than parsing
CSV or scraping HTML. Worth a small future addition, not urgent.

**Can this become a skill?** Not a skill exactly — a small, low-priority
future enhancement to the existing production-document export, noted here
rather than invented a whole new proposal for a one-line JSON.stringify.
