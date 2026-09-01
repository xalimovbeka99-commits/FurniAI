# FurniAI Remote Master Plan 2026

## Governing mission

FurniAI will become a furniture-specific AI CAD/CAM platform. A customer can describe a furniture item in text, upload a PDF, drawing, hand sketch, photograph, or specification, and FurniAI will:

- understand the request without pretending uncertain details are known;
- ask the smallest set of useful furniture questions;
- produce a versioned, user-approved furniture specification;
- generate deterministic parametric furniture geometry;
- display an editable 3D model;
- decompose that model into real manufactured parts;
- generate dimensioned workshop and assembly drawings;
- define holes, grooves, rebates, edging, fittings, and assembly relationships;
- later export machine-specific CNC data only after physical factory qualification.

The first product is not "all furniture." The first product is one professional straight hinged wardrobe vertical slice. Kitchens, sliding wardrobes, L/U wardrobes, vanities, beds, and offices follow only after the wardrobe foundation is proven.

Pricing, payments, marketplaces, and broad factory automation are excluded from the first milestone.

---

## Product law

The AI interprets intent and proposes a specification. Deterministic engineering code creates and validates geometry, parts, machining, drawings, and manufacturing outputs.

**The language model must never directly invent trusted coordinates, drilling points, toolpaths, or CNC commands.**

One approved design revision must be the source for every representation:

```
Customer evidence
  → AI interpretation and clarification
  → approved FurniSpec revision
  → deterministic wardrobe engine
  → part graph
  → 3D preview
  → cut/panel list
  → workshop drawings
  → machining map
  → assembly package
  → qualified CNC post-processor (future, blocked)
```

Nothing may appear in 3D unless it exists in the part graph. Nothing may appear in a cut list, drawing, or machining export unless it belongs to the same immutable design revision.

---

## What we learn from established CAD/CAM systems

FurniAI must learn workflows and architectural patterns, not copy proprietary source code, protected catalogs, interfaces, or file formats without permission.

### BAZIS-style furniture workflow
Study the furniture-native workflow: parametric cabinet construction, panels and edging, hardware/fittings, drawings, cutting/nesting, and CNC preparation. FurniAI should reproduce the useful product concepts through its own contracts and verified rules. Official product reference: [BAZIS](https://bazissoft.ru/).

### AutoCAD-style precision and extensibility
Adopt exact coordinate systems, layers, blocks/identifiers, dimensioned drawings, stable exchange formats, and automation boundaries. AutoCAD supports developer APIs such as ObjectARX/.NET and established drawing concepts; FurniAI should export interoperable drawings rather than depend on AutoCAD as its core engine. Official reference: [AutoCAD 2026 Developer and ObjectARX Help](https://help.autodesk.com/view/OARX/2026/ENU/).

### SketchUp-style interaction
Adopt an approachable 3D interaction model: orbit, select, manipulate through controlled parameters, components, scenes, and extension-friendly workflows. SketchUp exposes Ruby and C APIs, but FurniAI should keep its own canonical data instead of making a SketchUp file authoritative. Official references: [SketchUp Ruby API](https://ruby.sketchup.com/) and [SketchUp extension development](https://extensions.sketchup.com/developers).

### Solid-model kernel option
For later complex geometry and robust STEP/B-Rep exchange, evaluate Open CASCADE rather than building an industrial solid kernel from scratch. It provides topology/geometry and CAD exchange foundations. It is an evaluation candidate, not an automatic dependency for the first rectangular wardrobe. Official reference: [Open CASCADE Technology documentation](https://occt3d.com/dev/doc/overview/html/index.html).

---

## Current baseline

The accepted L0 application is the live legacy static Three.js r128 FurniAI builder at:

- https://furniai-topaz.vercel.app
- https://furniai-topaz.vercel.app/#/build/0

It is a protected visual baseline and must remain working while the new engineering foundation is built. Its reported 16 browser/WebGL tests are release guards.

It is **not yet a manufacturing authority.** Its preview meshes, catalog prices, approximate cut lists, and generated production language must not be treated as CNC-approved evidence.

Current Vercel project:
- name: `furniai-builder`
- project id: `prj_8tFr9kHJ0niYGkXATDp7648V7M1j`

The project must have a clean GitHub checkpoint before feature work continues.

---

## Target system architecture

### 1. Evidence intake

Accepted input types, introduced progressively:
- text description;
- guided form answers;
- reference photograph;
- hand sketch;
- PDF or image drawing;
- supplier/product PDF;
- DXF/DWG/STEP/SKP as later interoperability inputs.

Every extracted value must carry provenance:
```json
{ "value": 2400, "unit": "mm", "status": "explicit", "source": "customer_text", "confidence": 1.0 }
```

Allowed statuses:
- `explicit` — customer supplied or confirmed;
- `extracted` — read from a file with evidence;
- `defaulted` — approved workshop default;
- `inferred` — AI interpretation requiring confirmation;
- `unresolved` — cannot proceed safely.

Photos must never be treated as reliable dimensional evidence without a scale/reference or user confirmation.

---

### 2. Clarification engine

Ask one outcome-changing question at a time. Give a recommended answer and explain the trade-off briefly.

Wardrobe question order:
1. installation envelope: width, height, depth;
2. wardrobe type: freestanding, wall-to-wall/built-in, carcass/open system;
3. door system: hinged first; sliding later;
4. number and intended use of sections;
5. long hanging, short hanging, shelves, drawers;
6. plinth/legs/toe-kick and top/fillers/scribes;
7. material thickness and back construction;
8. door/handle/finish and LED, if relevant;
9. wall/floor/ceiling constraints;
10. confirmation of the generated design revision.

The engine must not ask what can be derived deterministically. It must not silently choose a construction rule that changes manufactured parts.

---

### 3. Canonical FurniSpec

FurniSpec is versioned JSON. It contains intent, sizes, counts, types, catalogs, and approved construction choices. It does not contain arbitrary AI-generated mesh coordinates.

Minimum wardrobe specification:
- contract version;
- project/design/revision IDs;
- units fixed to integer millimetres;
- installation envelope;
- wardrobe construction type;
- panel material and thickness references;
- back-panel system;
- plinth/base/legs;
- top and side fillers/scribes;
- ordered cabinet modules;
- ordered bays/sections per module;
- interior component intent;
- fronts and door system;
- handle and LED options;
- wall fixing requirements;
- explicit/defaulted/unresolved metadata;
- approval state.

---

### 4. Deterministic design engine

The engine converts FurniSpec into a PartGraph.

Each part requires:
- stable part ID and revision;
- role: side, top, bottom, divider, shelf, back, door, drawer part, plinth, filler, rail, etc.;
- material/catalog reference;
- finished length, width, thickness;
- grain direction;
- local coordinate frame and orientation;
- edge treatment per edge;
- quantity;
- parent module and assembly relationships;
- machining features;
- visibility and finish faces;
- warnings and validation status.

**No material, hardware, tolerance, clearance, or machining value may be invented by an LLM.** Unverified values belong in a controlled rule catalog as `UNQUALIFIED`, never as production truth.

---

### 5. Machining feature model

Machining must be semantic before it is machine-specific:
- drill blind;
- drill through;
- hinge cup;
- dowel;
- confirmat;
- cam/minifix;
- shelf-pin row;
- drawer-runner hole pattern;
- groove/dado;
- rebate/rabbet;
- pocket;
- contour;
- label/reference mark.

Each operation records part-local coordinates, face, diameter/width, depth, tool intent, hardware reference, and rule source. A later post-processor maps semantic operations to BAZIS/CNC-controller-specific layers or commands.

---

### 6. Constraint and inspection engine

A design cannot reach drawing release if any hard gate fails:
- required specification complete;
- positive and bounded geometry;
- openings and panels close to the approved envelope;
- parts do not collide illegally;
- shelf/door/front limits pass approved rules;
- hardware count matches machining features;
- holes/grooves remain within panels and do not break through unintentionally;
- every visible solid maps to a part;
- every drawing and list maps to the same revision;
- unresolved or unqualified rules are disclosed.

---

### 7. 3D renderer

The renderer consumes PartGraph; it does not calculate independent furniture logic.

Required first-slice features:
- accurate rectangular panel placement;
- select/highlight part;
- show stable part ID;
- orbit, pan, zoom, fit-to-view;
- front/side/top/isometric views;
- carcass/front/interior visibility modes;
- door and drawer animation for presentation only;
- measurement overlay;
- exploded assembly view later;
- visible validation warnings;
- WebGL failure and recovery handling.

---

### 8. Drawing engine

Generate from the same PartGraph:
- overall front elevation;
- side elevation;
- plan/top view;
- section/bay dimension chains;
- part drawings with finished sizes;
- machining face views with hole coordinates;
- edge-banding indicators;
- assembly identifiers and cross-references;
- title block with project, revision, units, rule-set version, date, and release status;
- PDF output;
- DXF drawing output after cross-checking.

Every dimension must be derived, never manually duplicated.

---

### 9. Manufacturing boundary

The first release produces DESIGN REVIEW or WORKSHOP REVIEW packages — not direct CNC production.

Future CNC release requires:
- selected machine/controller;
- tool library;
- post-processor version;
- coordinate/origin conventions;
- layer/operation mapping;
- material and hardware catalog qualification;
- calibration coupon;
- first-article cut and assembly;
- measured inspection record;
- responsible human release.

Until this passes, machine export remains disabled and the UI must never claim CNC READY.

---

## First wardrobe product scope

### Included
- straight rectangular wardrobe;
- hinged doors;
- 1–4 modules;
- configurable width, height, depth;
- configurable bay widths with exact closure;
- side/top/bottom/divider/back/plinth/filler parts;
- fixed and adjustable shelves;
- long/short hanging zones and rails;
- one drawer-bank system after its rules are supplied;
- material thickness selection from an approved small catalog;
- 3D and orthographic views;
- overall and per-part dimensions;
- workshop-review PDF;
- panel/cut list without pricing;
- semantic machining map after the relevant joint/hardware rule is approved;
- project save/load and immutable revisions;
- AI text conversation and structured edits.

### Explicitly deferred
- sliding systems;
- L/U/corner wardrobes;
- sloped ceilings;
- arbitrary custom freeform panels;
- kitchens;
- automatic pricing;
- payments;
- nesting optimization;
- production CNC post-processors;
- unverified supplier/hardware catalogs;
- fully automatic dimensions from photographs.

---

## Knowledge capture with Bekzod

Bekzod is Product Owner and Workshop Authority. Software agents must not guess his shop rules.

Create a versioned Wardrobe Rulebook through short interviews and physical examples:
- carcass construction style;
- standard panel thicknesses;
- back-panel construction;
- plinth/legs and floor clearance;
- top/side filler and scribe rules;
- maximum transportable module sizes;
- module/bay width rules;
- shelf span and clearance rules;
- hanging clearances;
- hinged-door gaps and overlays;
- hinge brand/model/count and drilling template;
- connector system and drilling template;
- shelf-pin system;
- drawer system and runner template;
- edge-banding rules;
- wall-fixing rules;
- LED/profile routing rules;
- tolerances and workshop checks;
- drawing conventions;
- assembly sequence.

Every rule records source, example, status, approver, version, and tests. Statuses are `DRAFT`, `BEKZOD_APPROVED`, `SUPPLIER_VERIFIED`, `PHYSICALLY_TESTED`, and `PRODUCTION_QUALIFIED`.

---

## Delivery roadmap

### Gate G0 — recoverable baseline
**Outcome:** the exact working live source is safely committed and pushed to the new GitHub repository.

Acceptance:
- clean main;
- correct remote;
- no secrets/caches/generated artifacts;
- build passes;
- 16/16 browser tests pass;
- deployed source SHA recorded;
- rollback possible.

> **No feature work before G0.**

---

### Gate G1 — wardrobe rulebook v0.1
**Outcome:** one real example wardrobe is fully described using Bekzod-approved construction choices.

Deliverables:
- glossary and coordinate convention;
- annotated reference wardrobe;
- rule catalog;
- unresolved questions;
- golden expected panel list;
- golden overall dimensions.

Acceptance: Bekzod signs off the example in plain language and drawings.

---

### Gate G2 — canonical contract and rectangular kernel
**Outcome:** one FurniSpec produces a deterministic PartGraph.

Acceptance:
- same input produces byte-stable normalized output;
- all panel dimensions close mathematically;
- stable IDs survive unrelated edits;
- invalid dimensions fail visibly;
- golden panel list matches Bekzod's expected result;
- no renderer dependency in kernel.

---

### Gate G3 — working 3D vertical slice
**Outcome:** the approved PartGraph renders inside the protected FurniAI experience.

Acceptance:
- default wardrobe visible;
- width/height/depth and bay changes update correct parts;
- selection exposes part ID and dimensions;
- dimension overlay agrees with PartGraph;
- nonblank pixel/browser/lifecycle tests pass;
- no regression to the existing catalog builder.

> This is the first major visible success.

---

### Gate G4 — drawings and panel list
**Outcome:** the same revision generates a workshop-review package.

Acceptance:
- overall elevation/plan/side views;
- exact module and bay dimensions;
- per-part drawings;
- panel list reconciles one-to-one with PartGraph;
- PDF title block and revision status;
- independent cross-artifact test catches any mismatch.

---

### Gate G5 — semantic holes and hardware
**Outcome:** approved joinery and hardware rules generate machining features.

Acceptance:
- holes and grooves shown on correct part face;
- local origins documented;
- no feature outside panel or accidental breakthrough;
- hardware count matches machining;
- every coordinate traceable to an approved rule;
- drawing read-back/cross-check passes.

Output remains workshop review, not CNC release.

---

### Gate G6 — AI wardrobe designer
**Outcome:** text conversation creates and edits the same canonical design.

Acceptance:
- asks critical missing questions;
- distinguishes explicit/defaulted/inferred values;
- tool/structured output only;
- cannot bypass validation;
- changes create new revisions;
- manual configurator works during provider failure;
- real-model evaluation uses recorded wardrobe scenarios.

---

### Gate G7 — file and image intake
**Outcome:** PDF/sketch/photo evidence enters the same clarification flow.

Acceptance:
- files are sandboxed and type/size checked;
- extracted facts retain source location/confidence;
- uncertain dimensions require confirmation;
- malicious document text cannot override system rules;
- output is never directly trusted geometry.

---

### Gate G8 — physical qualification pilot
**Outcome:** one selected wardrobe and machine profile is calibrated through a coupon and first article.

Acceptance requires real measured factory evidence. Only after G8 may a specific post-processor/profile be called production-qualified.

---

### Gate G9 — sliding wardrobe, corner wardrobe, then kitchen
Each new typology needs its own rulebook, golden examples, constraints, drawings, and physical qualification. No feature inherits production authority merely because it renders.

---

## Multi-AI operating model

### Bekzod — Product Owner and Workshop Authority
- supplies construction decisions and examples;
- answers rulebook questions;
- reviews visible 3D and drawings;
- approves workshop rules;
- decides product priority;
- never has to review raw code to approve furniture behavior.

### Google Antigravity — Visual and application implementation lead
- owns landing/catalog/builder UI;
- Three.js/WebGL rendering and interaction;
- visual regression and browser tests;
- integration of canonical PartGraph into the live experience;
- Vercel previews after gates pass;
- **may not invent manufacturing rules.**

### Claude Code — Deterministic engine and AI/backend lead
- owns FurniSpec, PartGraph, rule catalog, validators;
- drawing generator and semantic machining model;
- AI clarification/tools/file-intake services;
- unit, property, golden, and security tests;
- **may not redesign the protected UI without authorization.**

### Codex/ChatGPT — Technical supervisor and independent verifier
- decomposes milestones and writes bounded work orders;
- audits claims against commits and deployments;
- independently runs build/tests/browser/cross-artifact checks;
- prevents scope creep and unsupported manufacturing claims;
- reconciles handoffs and maintains the authoritative status;
- **does not accept screenshots or prose as the only evidence.**

---

## Branching and handoff rules

- `main` is always releasable.
- One bounded milestone branch at a time.
- Antigravity and Claude do not modify the same files concurrently.
- Every task begins from a recorded base SHA.
- Every handoff includes changed files, commit SHA, commands, results, screenshots/artifacts, limitations, and next risk.
- Codex reviews the exact commit, not an uncommitted workspace.
- **No force pushes.**
- **No remote deletion without Bekzod's explicit approval.**
- **No claim moves from NOT IMPLEMENTED to DONE without acceptance evidence.**

---

## Immediate 30-day sequence

### Week 1
- complete G0 Git checkpoint;
- freeze live builder tests;
- correct stale `3d_BUILDER_.md` facts;
- conduct Wardrobe Rulebook interviews 1–8;
- select one golden wardrobe.

**Visible result:** protected live builder plus an approved annotated reference wardrobe.

### Week 2
- implement FurniSpec v0.1 and PartGraph;
- generate the golden wardrobe's carcass panels;
- add mathematical/golden tests;
- create a developer-only part inspector.

**Visible result:** change width/height/depth and see the exact panel list change.

### Week 3
- render PartGraph in the live builder behind a safe feature flag;
- add part selection, IDs, dimensions, orthographic views;
- preserve the old catalog path;
- run browser parity and lifecycle tests.

**Visible result:** one engineering wardrobe in 3D whose displayed dimensions come from the same panel data.

### Week 4
- generate front/side/plan drawings;
- generate panel list and first PDF package;
- cross-check PDF/list/3D revision and counts;
- review package with Bekzod and record corrections.

**Visible result:** FurniAI produces its first workshop-review wardrobe package.

---

## Definition of the first real FurniAI product

FurniAI Wardrobe Alpha is complete when a user can describe a straight hinged wardrobe, answer FurniAI's questions, approve a versioned design, view and edit its 3D model, select every real panel, and download a dimensioned workshop-review PDF and matching panel list — all generated from one deterministic model and verified against Bekzod's approved golden wardrobe.

It is **not yet CNC-production-qualified.** That is a later measurable gate, not a marketing phrase.

---

## Master execution instruction for all agents

Before acting, read this document, the accepted baseline audit, `3d_BUILDER_.md`, and the current repository status. State the exact gate, base SHA, files owned, acceptance tests, and prohibited scope. Implement only the smallest end-to-end result for that gate. Preserve the live builder. Never import code blindly from old ZIPs. Never infer manufacturing rules from a demo engine. Never claim CNC readiness without a qualified machine profile and physical first article. Finish with an exact commit and evidence report suitable for independent review.
