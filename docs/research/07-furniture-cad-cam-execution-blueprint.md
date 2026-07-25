# FurniAI Furniture CAD/CAM Deep Dive and Execution Blueprint

**Status:** engineering companion to the authoritative [master plan](../MASTER-PLAN.md)  
**Research refreshed:** 2026-07-25  
**Scope:** rectangular panel furniture: wardrobes, walk-ins, kitchens, vanities,
TV units, sideboards, shoe cabinets, bookcases and related fitted cabinetry  
**Not in the first production scope:** chairs, carved furniture, upholstery,
free-form solid wood, sculpture, or arbitrary five-axis work

## 1. The product decision

FurniAI must be an **AI-guided furniture compiler**, not a text-to-mesh system.

The AI is responsible for language, vision, intent, options and explanation.
The deterministic engineering system is responsible for dimensions, constraints,
panels, joints, hardware fit, machining features, drawings, nesting inputs and
manufacturing release.

```text
text / voice / image / sketch / PDF / room measurements
                         ↓
              evidence + intent extraction
                         ↓
        clarification / assumptions / alternatives
                         ↓
              versioned FSL design document
                         ↓
        deterministic parametric design compiler
                         ↓
     panels + hardware + joints + machining + assembly
                         ↓
      validation → 3D preview → drawings → cut list
                         ↓
            factory profile + release gate
                         ↓
        nesting job → machine-specific postprocessor
```

This split is non-negotiable. An LLM may propose “use four hinges,” but it may
not manufacture from that sentence. A hardware rule must resolve an exact
manufacturer SKU, door mass and dimensions, application, mounting plate,
drilling pattern and rule revision before exact machining is released.

## 2. What the current repository already has

The structured Next.js system has a useful beginning:

- FSL v1 for extracted requirements, assumptions, missing information and
  compatibility;
- a Furniture Brain that separates AI extraction from deterministic defaults;
- a configurator adapter that passes through the existing validation gate;
- a pure `FurnitureConfig → parts` geometry function;
- a basic cut-list/production pack;
- deterministic fixtures for part of the static-site construction validator.

The live static site is separate and must remain protected until the structured
system reaches feature parity. The Next.js/FSL code is the correct long-term
engineering foundation.

### Immediate gaps found in the audit

1. **Two sources of truth:** the live static builder and Next.js geometry engine
   can drift.
2. **Two unrelated validators:** `api/constructionValidator.js` works in cm and
   validates the static UI; `src/lib/fsl/validator.js` works in mm and validates
   FSL concepts. Neither validates the complete manufacturing model.
3. **Mixed units:** FSL uses mm, the geometry config uses metres, and the static
   app uses cm. This invites conversion and rounding errors.
4. **The design model is too shallow:** module counts exist, but joints,
   adjacency, edge treatment, machining features, installation conditions and
   hardware SKUs do not.
5. **Cut-list identity is lossy:** grouping parts by role and sorted dimensions
   loses instance lineage, face orientation, grain-match sequence and machining.
6. **No drawing engine:** there are no associative assembly/part drawings whose
   dimensions are derived from the same model.
7. **No factory profile:** stock sheets, actual board thickness, edge-bander
   allowances, tooling, coordinate conventions, labels and postprocessors are
   not versioned data.
8. **No manufacturing release gate:** previews and indicative cut lists have
   historically looked more mature than their evidence supports.
9. **No room/install model:** walls, openings, skirting, fillers, scribes,
   services, ventilation, appliance envelopes and access are absent.
10. **No stable project/version model:** a customer conversation must produce
    immutable revisions so drawings and shop-floor files are traceable to the
    exact approved design.

One concrete geometry fault was fixed during this audit: clear module widths
now subtract divider thickness before applying ratios. Previously the dividers
were added after distributing the entire internal width, allowing the last bay
to extend past the right side.

## 3. Capability levels: honesty before automation

Every output must carry a capability level:

| Level | Meaning | Customer/factory action |
|---|---|---|
| `conceptual` | intent is represented, but geometry or engineering is incomplete | discuss and clarify |
| `preview` | deterministic visual geometry exists and passes geometric invariants | customize and review |
| `validated` | selected construction and hardware profiles pass all implemented rules | technical approval |
| `production_released` | immutable revision, approved factory/machine profiles and human release | may manufacture |
| `unsupported` | FurniAI cannot safely perform the capability | use an external specialist |

No global “production ready” badge is allowed. Capability must be reported
separately for geometry, cut list, drawings, hardware, machining, nesting, CNC,
pricing and installation.

## 4. The canonical FurniAI model

FSL should evolve into the permanent design document; adapters should be
generated from it. Millimetres are canonical. Floating-point metres may exist
only at the Three.js rendering boundary.

### 4.1 Project and evidence

- project ID, revision ID, parent revision and timestamps;
- customer intent and use case;
- evidence items: text span, audio transcript, image region, PDF page, manual
  measurement or imported CAD entity;
- explicit values versus defaults versus AI inference;
- confidence and confirmation status per field;
- locale, market and applicable standard profile;
- room/site survey revision;
- selected factory profile;
- approval and release history.

### 4.2 Room/site model

- wall planes and run baselines;
- floor and ceiling levels, slopes and out-of-square observations;
- doors, windows, architraves and skirting;
- columns, beams, niches and obstructions;
- electrical, plumbing, gas, HVAC and lighting services;
- appliance model/envelope and manufacturer clearances;
- access path, lift/stair limits and installation segmentation;
- scribe/filler zones and installer tolerances.

Never infer an exact room dimension from a photograph. Images can classify
objects and suggest proportions; production dimensions require scale evidence
or confirmation.

### 4.3 Assembly graph

Furniture is an assembly graph, not a flat list of boxes:

- `assembly`: cabinet, run, island, tower, drawer box, door set;
- `part`: stable identity, role, local frame, finished size and material;
- `joint`: connects two part faces with a construction method;
- `attachment`: parent/child transform and motion constraints;
- `hardwareInstance`: exact catalog SKU plus application parameters;
- `machiningFeature`: bore, line-bore, pocket, groove, dado, rabbet, cutout or
  contour;
- `edgeTreatment`: edge ID, band material, finished thickness and allowance;
- `finish`: face/edge finish and grain or pattern direction;
- `operation`: cut, mill, drill, edge-band, finish, label, pack and assemble.

Every derived object must keep lineage:

```text
requirement → assembly → part → face/edge → machining feature
            → drawing entity → nesting placement → machine operation
```

That lineage is what lets FurniAI answer “why is this hole here?”, update all
outputs after one dimension changes, and locate the affected pieces after a
factory correction.

### 4.4 Minimum part record

```json
{
  "part_id": "WARD-A/CARCASS/LEFT-SIDE",
  "revision": 7,
  "role": "side_panel",
  "frame_mm": {
    "origin": [0, 0, 0],
    "x_axis": [1, 0, 0],
    "y_axis": [0, 1, 0],
    "z_axis": [0, 0, 1]
  },
  "finished_size_mm": [600, 2400, 18],
  "blank_size_mm": [602, 2402, 18],
  "material_ref": "board:egger-u708-st9-18",
  "grain_axis": "y",
  "edges": {
    "front": {"band_ref": "abs-2mm-u708", "finished": true},
    "rear": null,
    "top": null,
    "bottom": null
  },
  "joints": ["joint-carcass-left-top", "joint-carcass-left-bottom"],
  "features": ["linebore-left-01"],
  "source": {"kind": "compiler", "rule_set": "wardrobe-carcass@1.0.0"}
}
```

`blank_size_mm` and `finished_size_mm` must be separate. Whether the blank is
larger depends on the material, process and factory; it is not a universal
edge-banding formula.

## 5. Furniture knowledge architecture

Knowledge belongs in versioned, testable modules, not one giant prompt.

### 5.1 Category grammar

Start with reusable cabinet grammar:

- straight carcass;
- base, wall and tall cabinet;
- vertical bay;
- shelf bay;
- hanging bay;
- drawer bank;
- hinged front;
- sliding front;
- open bay;
- corner transition;
- appliance housing;
- filler, scribe and end panel;
- plinth, legs and wall suspension;
- worktop and splashback.

Compose products from this grammar:

- wardrobe and walk-in;
- kitchen run, L/U run and island;
- vanity;
- TV unit/sideboard;
- shoe cabinet;
- bookcase/office storage.

This avoids a separate geometry engine for every catalog label.

### 5.2 Construction profiles

Never treat “18 mm MDF” as the whole construction system. A versioned profile
must define:

- nominal and measured board thickness;
- carcass topology: tops/bottoms between or over sides;
- back type: overlaid, rebated, grooved or planted;
- plinth/leg/suspension system;
- face overlay/inset rules;
- reveals, gaps and door/drawer clearances;
- fixed versus adjustable shelf construction;
- joint family and connector rules;
- edge-banding rules and finished-size convention;
- allowed spans and load classes;
- segmentation and site-assembly rules;
- tolerances owned by design, factory and installation.

### 5.3 Hardware catalog

Each hardware family needs:

- manufacturer, series, SKU, revision and source document;
- supported material/thickness range;
- dimensions and keep-out envelope;
- load/door weight class;
- allowed application types;
- drilling template in a defined part-face coordinate system;
- compatible plates, runners, connectors or accessories;
- adjustment range;
- collision envelope and motion;
- substitution rules;
- effective dates and market availability.

The catalog is not “learned” automatically from Reddit or an LLM. Manufacturer
documents are authoritative; an engineer reviews and versions extracted data.

### 5.4 Materials and finishes

- substrate and grade;
- nominal and measured thickness;
- sheet size and usable trim;
- density for part/door mass;
- grain/pattern direction;
- decor and surface side;
- machining/finish restrictions;
- edge-band compatibility;
- cost, supplier, lead time and market;
- moisture/fire/emissions information where required.

## 6. Parametric geometry engine

For the MVP categories, rectangular panels do not require a heavyweight solid
modeling kernel. A precise JavaScript panel/assembly kernel is appropriate if
it follows CAD discipline.

### Required rules

1. mm internally; convert once at rendering/export boundaries.
2. No early rounding. Round only display or machine fields according to the
   selected profile.
3. Explicit coordinate system and handedness.
4. Local frames per assembly and per part.
5. Dimensions come from named constraints, never repeated arithmetic.
6. A panel has face and edge identity; sorting three dimensions is not enough.
7. Visual clearances, finished sizes and machining allowances are separate.
8. The same compiled parts feed the viewer, drawings, BOM, price and production
   package.
9. Motion is constrained: hinge axis/angle, slide travel, collision envelope.
10. Every compile runs geometry invariants.

### Geometry invariants

- all values finite and all sizes positive;
- panels stay inside their parent envelope unless an explicit projection is
  allowed;
- bay widths plus dividers equal the usable opening;
- fixed parts meet their supports within tolerance;
- no unintended solid intersections;
- moving parts do not collide through their motion range;
- front reveals and overlays resolve exactly;
- hardware keep-out zones do not intersect other machining/features;
- minimum residual material around bores, grooves and edges;
- assembly extents equal the approved overall dimensions.

An optional CadQuery/Open CASCADE service becomes useful later for STEP solids,
non-rectangular profiles, boolean features and exact B-rep exchange. It is not a
reason to postpone a correct rectangular-panel kernel.

## 7. Validation and self-repair

Validation must return findings with:

- stable code;
- severity: info, warning, error or release blocker;
- affected entities;
- expected versus actual values;
- source rule and version;
- evidence/citation;
- safe deterministic repair, when one exists;
- whether user/factory confirmation is required.

Validation layers:

1. request/schema;
2. dimensional and constraint consistency;
3. assembly topology;
4. geometry and collision;
5. category ergonomics;
6. structural/load heuristics;
7. material/process compatibility;
8. hardware application and collision;
9. machining feasibility;
10. nesting feasibility;
11. installation/site fit;
12. document completeness;
13. factory/machine release.

Self-repair may change only deterministic, explainable values. FurniAI must
show the delta and preserve the previous revision. Ambiguous repairs become
questions or alternatives.

## 8. Conversation and multimodal behavior

The conversation should be a design review, not a questionnaire dump.

### Evidence priority

1. explicit confirmed dimension;
2. calibrated drawing/PDF/CAD dimension;
3. manufacturer appliance/hardware data;
4. approved factory profile;
5. user-confirmed default;
6. AI inference for visualization only.

### Clarification groups

- space: overall envelope and room/site restrictions;
- function: users, storage types, loads and access;
- layout: bays, drawers, shelves, hanging, appliances;
- construction: built-in/free-standing, carcass/front/back/plinth;
- appearance: style, color, finish, grain, handle and lighting;
- production: factory, materials, hardware, tolerances and installation.

Ask the smallest question that unlocks the next deterministic step. Offer
three concrete choices with consequences when the user does not know the
technical term. A missing production-critical value may receive a preview
default, but never a production default without confirmation.

### Images, PDFs and sketches

The AI layer may:

- identify category and visible components;
- extract text/dimensions and keep page/region provenance;
- estimate proportions with uncertainty;
- detect style, color and material candidates;
- propose a parametric topology.

It may not:

- claim exact scale from an uncalibrated image;
- infer hidden joinery or hardware as fact;
- copy a copyrighted design for manufacture without a rights check;
- send an unvalidated mesh directly to production.

## 9. Drawings and production documents

Drawings are views of the canonical model, not independently authored pictures.

### Customer set

- rendered and line isometric;
- front/side/top views;
- overall dimensions;
- door/drawer opening visualization;
- material/finish schedule;
- assumptions and items needing confirmation.

### Technical set

- project/revision/factory profile on every sheet;
- assembly views and section cuts;
- module and opening dimensions;
- part drawings for machined/non-rectangular parts;
- edge-band and grain symbols;
- hardware schedule;
- machining feature table;
- labels/QR or barcode identifiers;
- assembly sequence;
- installation plan and scribe/filler notes;
- validation/release summary.

DXF is appropriate for neutral 2D profiles/drawings, but it is not the source
of truth. DWG generation may be an AutoCAD Automation adapter. STEP is useful
for exact solids and hardware exchange. glTF is the preferred web-preview
asset. PDF is the human contract. A machine-neutral JSON/CSV job package is the
factory integration contract before any proprietary machine code.

## 10. Nesting

Nesting is more than putting rectangles on a sheet.

### Inputs

- part finished/blank dimensions;
- material, thickness, decor and batch;
- quantity;
- grain/pattern axis and allowed rotations;
- trim margins, kerf/router diameter and part spacing;
- edge-banding/machining allowance convention;
- grain-match groups and order;
- keep-together production groups;
- label data;
- stock and reusable offcuts;
- machine bed and hold-down limits.

### Outputs

- deterministic nest ID and input hash;
- sheet placements and utilization;
- waste/offcut geometry;
- unresolved parts/reasons;
- label order and part traceability;
- machine-neutral toolpath intent;
- preview image and operator report.

Start with rectangular sheet optimization. Irregular no-fit-polygon nesting is
unnecessary for most MVP panels. Preserve grain match and production grouping
even when a theoretically tighter nest exists. Practitioner reports repeatedly
show that labels and keeping related parts findable can matter more than the
last percentage of material yield.

## 11. CNC and postprocessors

FurniAI should first emit manufacturing **features**, not raw G-code:

```text
part face + local origin
  ├─ bore(diameter, depth, x, y, side)
  ├─ line_bore(pattern, pitch, start, end)
  ├─ groove(width, depth, path)
  ├─ pocket(depth, closed_contour)
  ├─ contour(profile, allowance, lead strategy)
  └─ cutout(profile, corner treatment)
```

A postprocessor resolves these features using a versioned machine profile:

- controller/format (for example woodWOP/MPR, Biesse ecosystem or another
  verified target);
- axes, origin, face/side naming and units;
- tool library and diameters;
- feeds/speeds owned by the factory;
- compensation, lead-in/out and machining order;
- vacuum/hold-down and small-part strategy;
- supported operations and limits;
- simulator/test-piece evidence;
- postprocessor version and approval.

Commercial systems make this boundary explicit. HOMAG describes workpiece-
oriented machining and MPR/MPRXE workflows; Biesse separates 3D CAD/CAM,
nesting and machine modules; BAZIS-CNC generates programs from information-rich
panel models. FurniAI must not promise one universal “CNC file.”

## 12. Interoperability strategy

| Target | Use | Strategy |
|---|---|---|
| Three.js / React Three Fiber | interactive preview | compile part/assembly graph to meshes |
| glTF/GLB | portable visual model | export preview geometry + metadata |
| PDF | customer/factory review | associative generated document |
| CSV/JSON | neutral manufacturing job | stable schema, units and revisions |
| DXF | 2D contours/drawings | generated adapter with layers and mm units |
| STEP | exact solid exchange | later CadQuery/OCCT service |
| SketchUp | design ecosystem | plugin/importer reads neutral package; components preserve part identity |
| AutoCAD | drawings/DWG/PDF | DXF first; optional APS Automation adapter |
| BAZIS | factory handoff | validate documented import path; do not reverse-engineer proprietary B3D |
| CNC controller | machining | one validated postprocessor per machine/profile |

SketchUp’s component model is useful because a definition is reusable while
instances carry transformations. FurniAI needs the same definition/instance
separation. OpenCutList demonstrates the downstream value of correct component
identity, material, grain, edge and label metadata. Its GPL code must not be
copied into a closed-source product; the data concepts are still valuable.

## 13. Target repository architecture

```text
src/lib/fsl/
  schema, migration, provenance, revision

src/lib/furniture-knowledge/
  categories/
  construction-profiles/
  hardware-catalog/
  material-catalog/
  installation/
  standards/

src/lib/design-compiler/
  constraints/
  assemblies/
  panels/
  joints/
  machining/
  motion/

src/lib/validation/
  schema/
  geometry/
  construction/
  hardware/
  manufacturing/
  release/

src/lib/outputs/
  viewer/
  drawings/
  cut-list/
  labels/
  neutral-job/

src/lib/adapters/
  sketchup/
  autocad-dxf/
  bazis/
  nesting/
  cnc/

tests/
  golden-projects/
  property/
  regression/
  factory-acceptance/
```

The existing `buildGeometry.js`, `production.js`, FSL and configurator adapter
should migrate incrementally into these boundaries. Do not rewrite them all at
once.

## 14. Implementation roadmap and acceptance gates

### Phase 0 — protect and measure

- keep the static production deployment unchanged;
- record all capabilities explicitly;
- run existing tests on Windows and in CI;
- freeze 20–30 golden current projects;
- add geometry invariants and remove false manufacturing claims;
- select mm as the canonical design-kernel unit;
- record factory interview/profile inputs without blocking concept work.

**Exit:** no regression in the live site; every output declares its maturity;
all known geometry paths have repeatable tests.

### Phase 1 — exact wardrobe compiler

- FSL revision/provenance model;
- assembly/part/joint schema;
- straight wardrobe grammar;
- exact bays, dividers, reveals, shelves, hinged doors and drawer openings;
- room envelope, fillers and scribes;
- 3D viewer reads only compiled parts;
- associative cut list with stable part IDs;
- property-based tests across valid dimension ranges.

**Exit:** one wardrobe revision drives the same 3D, dimensions and cut list;
no part escapes its envelope; all sums reconcile to the overall size.

### Phase 2 — construction and hardware

- one approved MDF/particle-board construction profile;
- one verified hinge family;
- one drawer-runner family;
- one shelf support/joinery family;
- density/mass and door-weight checks;
- hardware keep-out and motion collisions;
- detailed part/assembly drawings.

**Exit:** a selected hardware SKU deterministically generates validated
features and drawings, but CNC remains blocked.

### Phase 3 — customer AI workflow

- typed and voice input;
- images/PDF/sketch evidence with provenance;
- conversational clarification;
- two or three ranked layout alternatives;
- editable parameters and revision comparison;
- assumptions/unsupported items visible in the UI.

**Exit:** benchmark prompts consistently produce correct topology and ask for
critical missing facts without inventing measurements.

### Phase 4 — neutral factory package

- immutable released revision;
- part IDs, labels, BOM and cut list;
- edge/grain/machining feature data;
- assembly and installation pack;
- machine-neutral JSON/CSV schema;
- pricing from materials, hardware and operations.

**Exit:** a factory engineer can audit every value and trace it to the model.

### Phase 5 — rectangular nesting

- material/stock/offcut inventory inputs;
- grain, rotation, trim, spacing and grouping constraints;
- reproducible optimization and utilization;
- labels linked to nest placements;
- manual adjustment with revalidation.

**Exit:** golden jobs reproduce placements and no constraint is silently
violated.

### Phase 6 — one CNC proof of concept

- select one real machine/controller;
- implement one feature-to-postprocessor adapter;
- simulate;
- air-cut and test on scrap;
- measure outputs and record approved tolerances;
- require human release and immutable hashes.

**Exit:** the partner factory signs off a bounded operation set. Unsupported
features remain blocked.

### Phase 7 — SketchUp, AutoCAD and BAZIS adapters

- SketchUp component importer/plugin if it removes a real workflow bottleneck;
- DXF/AutoCAD drawing export with layers/dimensions;
- documented BAZIS neutral import proof;
- round-trip tests that preserve part IDs and measurements.

**Exit:** each adapter is replaceable and cannot alter the canonical model.

### Phase 8 — expand categories

Expand in this order:

1. walk-in and sliding wardrobes;
2. base/wall/tall kitchen units and straight runs;
3. L/U corners, islands and appliance integration;
4. vanities and moisture-aware profiles;
5. TV units, sideboards, bookcases and shoe cabinets.

Every category repeats the same gate sequence: concept → exact geometry →
construction → hardware → documents → validated production.

## 15. Evaluation program

### Deterministic tests

- unit tests for each constraint/rule;
- property tests over dimension ranges and module combinations;
- metamorphic tests: increasing width changes only intended dimensions;
- golden JSON snapshots for assemblies, parts and features;
- drawing dimension reconciliation;
- nest non-overlap and constraint tests;
- adapter round-trip tests;
- release-gate negative tests.

### AI evaluations

- exact explicit requirements retained;
- no unsupported fact invented;
- correct clarification priority;
- reference-image topology;
- contradiction handling;
- change request applies a delta rather than rebuilding unrelated parts;
- explanation cites the exact rule/evidence;
- adversarial prompt cannot bypass validation/release.

### Factory acceptance

For every supported construction/hardware/machine profile:

- engineer review;
- first-article test;
- measured result versus model;
- assembly trial;
- installation feedback;
- nonconformance record and corrective action;
- signed profile/version approval.

Learning from a correction creates a proposed rule or test. It never silently
changes production behavior.

## 16. Highest-priority backlog from this audit

1. Finish the mm migration plan across FSL, config, geometry and UI.
2. Replace flat `partsToCutList()` grouping with stable part instances and
   explicit face/edge orientation.
3. Create the versioned capability/release schema in FSL, not only the
   production pack.
4. Merge the construction checks into one validation framework.
5. Add a real assembly graph and joint model for the wardrobe.
6. Create a factory-profile schema and sample unapproved profile.
7. Build a first approved material record from a real supplier sheet.
8. Build a first exact hinge application from a current manufacturer document.
9. Add room/run/filler/scribe geometry.
10. Generate an associative customer dimension sheet.
11. Add immutable project revisions and design-delta history.
12. Connect the generation API to the builder UI.

Do not begin CNC output, BAZIS proprietary output or automated “production
ready” claims before items 1–8 pass.

## 17. Research findings and source hierarchy

### Authoritative/product sources

- [SketchUp Dynamic Components](https://help.sketchup.com/en/sketchup/making-dynamic-component):
  parametric component attributes and nested components are useful reference
  patterns, but dynamic-component authoring is complex and Pro-dependent.
- [SketchUp Ruby `ComponentDefinition`](https://ruby.sketchup.com/Sketchup/ComponentDefinition.html):
  reusable definitions, transformed instances and bounding-box/manifold checks
  inform FurniAI’s definition/instance model.
- [Autodesk Automation APIs](https://aps.autodesk.com/automation-apis):
  AutoCAD automation can create/process DWG and plot documents, so it belongs
  behind an adapter rather than inside the design kernel.
- [Autodesk DXF structure](https://help.autodesk.com/cloudhelp/2023/ENU/AutoCAD-DXF/files/GUID-D939EA11-0CEC-4636-91A8-756640A031D3.htm):
  DXF is an entity/block/layer exchange format; explicit units/layers and block
  identity are required.
- [BAZIS system](https://bazissoft.com/about),
  [BAZIS Cutting](https://bazissoft.com/preproduction/cutting) and
  [BAZIS CNC](https://bazissoft.com/preproduction/cnc):
  confirm the separation between information-rich furniture models, cutting
  optimization and machine-program generation.
- [BAZIS user guide](https://cdn.bazissoft.ru/documentation/ru/Bazis.pdf):
  documents exchange options including DXF/XML; an exact supported import
  contract still requires a controlled proof with the target factory/version.
- [HOMAG woodWOP](https://www.homag.com/en/software/woodwop-versions) and
  [intelliDivide](https://www.homag.com/en/product-detail/software/work-preparation/intellidivide-nesting):
  show workpiece-oriented macros, MPR/MPRXE, feature recognition, nesting and
  machine-specific workflow.
- [Biesse software](https://biesse.com/gb/en/software/) and
  [iX by imos](https://biesse.com/my/en/software/ix-by-imos/):
  show CAD/CAM, nesting, optimization and machine modules as connected but
  distinct stages.
- [Blum EASYSTICK manual](https://d2.blum.com/services/BEC003/me23483358_ma_dok_bau_%24sen-us_%24aof_%24v1.pdf):
  hinge quantity/application and 32 mm line drilling are selected in product
  context; the manual explicitly notes some checks are not automatic.
- [ISO 7170:2021](https://www.iso.org/standard/76864.html):
  current storage-unit strength, durability and stability test methods.
- [ISO furniture catalogue](https://www.iso.org/committee/52448/x/catalogue/):
  includes furniture hardware and storage test standards such as ISO 4769 and
  ISO 7170.
- [ASTM F2057](https://store.astm.org/f2057-23.html):
  relevant tip-over safety scope for free-standing clothing storage units in
  markets where it applies. Market/legal applicability must be selected, not
  assumed globally.

### Open-source implementation references

- [OpenCutList](https://github.com/lairdubois/lairdubois-opencutlist-sketchup-extension)
  (GPL-3.0, concepts only): parts, materials, cutting diagrams, labels, cost and
  weight.
- [CadQuery](https://github.com/CadQuery/cadquery) (Apache-2.0): server-friendly
  parametric B-rep, assemblies and STEP/DXF export candidate.
- [FreeCAD Woodworking workbench](https://www.freecad.org/addons.php): cabinet
  and woodworking workflows in a full parametric CAD environment.
- [Maker.js](https://maker.js.org/) (verify exact license/version at adoption):
  JavaScript 2D geometry and DXF/SVG export.
- [OR-Tools](https://github.com/google/or-tools) (Apache-2.0): bin packing and
  CP-SAT candidate for constrained rectangular nesting.
- [deepnest-next](https://github.com/deepnest-next/deepnest) (MIT at time of
  research): irregular nesting reference; unnecessary for the rectangular MVP.

### Practitioner signals (hypotheses, never production rules)

- [Grain-matched fronts discussion](https://www.reddit.com/r/cabinetry/comments/1akk2qm/):
  kerf, edge band, reveal, sequence and immediate labeling affect the result.
- [Keeping nested part sets together](https://www.reddit.com/r/CNC/comments/1f2itc7/):
  production grouping and labeling are shop-floor requirements.
- [Cabinet box cutting services](https://www.reddit.com/r/cabinetry/comments/1do42mr/):
  detailed labels communicate part identity and edge-banding operations.
- [Woodworking CNC proprietary formats](https://www.reddit.com/r/CNC/comments/18053ns/):
  reinforces the need for machine-specific postprocessors.
- [SketchUp/OpenCutList component issue](https://www.reddit.com/r/Sketchup/comments/1q89kjk/):
  incorrect component boundaries can corrupt cut-list identity even when the
  visible model looks right.
- [Cabinet nesting software discussion](https://www.reddit.com/r/CNC/comments/14e21uk/):
  shops use different CAD/CAM/nesting stacks; FurniAI needs adapters, not a
  hardcoded assumption about one universal workflow.

## 18. Non-negotiable engineering rules

1. Never manufacture directly from LLM output.
2. Never claim exact measurements from an uncalibrated image.
3. Never let the visual mesh become the production source of truth.
4. Never use hidden defaults for production-critical values.
5. Never generate machine code without an approved machine/postprocessor
   profile and physical test evidence.
6. Never modify a released revision; create a new revision.
7. Never learn a production rule automatically from user feedback.
8. Never copy code or datasets without recording license and version.
9. Never hide dropped/approximated fields when adapting between systems.
10. Never call an output “production ready” when only its geometry or cut list
    has been previewed.

