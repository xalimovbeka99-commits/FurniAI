# Open-Source Landscape — Pilot Research

Per-repository extraction. Format: Purpose → Main Skills → Architecture → What
Furni AI can learn → Can this become a skill? → Integration path. Nothing here
was copied; this is engineering-knowledge extraction only.

## cabinet-mcp

[github.com/chemrich/cabinet-mcp](https://github.com/chemrich/cabinet-mcp)

**Purpose**: Parametric cabinet design toolkit, conversational via an MCP server
— a user talks to an LLM, the LLM calls tools, the toolkit returns validated
designs, 3D previews, and production cutlists.

**Main skills**: parametric geometry generation from named presets; multi-level
design evaluation (clearances, structural deflection, hardware fit, joinery
compatibility) graded by severity rather than pass/fail; cutlist/BOM generation
with sheet nesting; auto-repair of common construction errors; multi-cabinet
project consistency checking.

**Architecture**: layered — parametric core → evaluation engine → cutlist/BOM
generator → optional CadQuery 3D layer → MCP server exposing 23 tools over
stdio/HTTP-SSE. Pure-Python core with an optional heavier dependency tier
(CadQuery + rectpack) for 3D/nesting. 283 scenario / 940 assertion test suite
runs in under a second — the evaluation logic is the load-bearing part, not the
3D rendering.

**What Furni AI can learn**:
- *Graded, non-binary validation* is the right model — a design can be "valid
  but tight" rather than pass/fail. `production.js` currently has no validation
  layer at all (it assumes the config is already good by the time it reaches
  the factory pack); a graded checker ahead of that step is a real gap.
- *Auto-repair* (a single pass that fixes common, mechanical errors before
  presenting a design) is a pattern nothing in Furni AI does yet — right now if
  a customer's request produces an awkward config, nothing corrects it.
- *Hardware selection driven by load/geometry*, not just customer choice — see
  [hardware-specifications.md](hardware-specifications.md).
- The MCP-tool-per-capability shape (creation, modification, validation, export
  as separate, independently callable tools) is exactly the shape `api/chat.js`
  should grow into as it gains more AI capabilities, rather than one monolithic
  prompt.

**Can this become a skill?** Yes — directly informs the **Furniture
Construction Validator** and **Hardware Recommendation & BOM** proposals in
[../ai-skills/proposed-skills.md](../ai-skills/proposed-skills.md).

**Integration path**: not a dependency to install (it's a standalone MCP
server, and pulling in CadQuery/Python is out of scope for a Node/Next.js
site) — the value is the *rule content* (joinery feasibility conditions,
hinge/slide placement formulas, severity grading scheme), re-expressed as
plain JS data + functions alongside `knowledgeBase.js`.

---

## Cubinets

[github.com/foreachidea/Cubinets](https://github.com/foreachidea/Cubinets)

**Purpose**: FreeCAD workbench for parametric cabinet templates → instant cut
lists.

**Main skills**: template-based parametric assembly (a "template" is a FreeCAD
document with a parameters spreadsheet + Cube-object panels); spatial layout
of units from a spreadsheet of directives (`void`, `cubinet 400 700 300 18`,
row breaks).

**Architecture**: notably low-tech and effective — parameters live in a plain
spreadsheet (name, value, unit columns), panels are literally `Part::Cube`
objects, and the cut list is just an extraction of Cube dimensions. No custom
DSL, no code-first modeling.

**What Furni AI can learn**: the "spreadsheet of directives" idea is a good
mental model for how non-developers (a factory operator, a designer) could
define new preset layouts without touching code — worth keeping in mind if
Furni AI ever exposes a preset-authoring UI, but not an immediate priority.

**Can this become a skill?** Not directly — FreeCAD-specific, GUI-oriented.

**Integration path**: knowledge only, no direct integration.

---

## Home Builder / kitchen-kreation

[Home Builder (Hackster.io writeup)](https://www.hackster.io/news/home-builder-5-1-is-open-source-software-for-diy-cabinet-projects-19d64626b7ca) ·
[github.com/mr-akashdesai/kitchen-kreation](https://github.com/mr-akashdesai/kitchen-kreation)

**Purpose**: DIY-oriented cabinet/kitchen design tools (desktop app; JS 2D/3D
planner respectively).

**What Furni AI can learn**: both are consumer-facing planners, not
engineering-knowledge sources — confirms that the *engineering* rigor (real
joinery/hardware feasibility) is concentrated in tools like cabinet-mcp, not in
consumer kitchen planners, which mostly optimize for visual layout speed.

**Can this become a skill?** No — reference only.

---

## Wardrobe / walk-in closet

Searched specifically for open-source parametric wardrobe/closet-cabinetry
tools. **None found.** Every wardrobe/closet result on GitHub is a personal
clothing-inventory app (OpenWardrobe, Libre-Closet, My-Closet, ai-closet) —
useful for a completely different product (a "what should I wear" app), not
furniture engineering.

**What this means**: wardrobes aren't a distinct engineering discipline from
cabinets — cabinet-mcp itself treats them as a "bedroom" preset category
(`bedroom_armoire`, `armoire_2col`, `bedroom_gentleman_chest`, etc. — see
[construction-standards.md](construction-standards.md) for the full preset
list). This validates the live site's own modeling choice: wardrobes and
kitchen cabinets already share one construction model (`buildGeometry.js`,
`furnitureConfig.js`) rather than needing separate systems. No change
indicated — this is a confirmation, not a gap to fill in code.

---

## Parametric modeling frameworks

From [mlightcad/awesome-cad](https://github.com/mlightcad/awesome-cad) and
direct search: **build123d**, **CadQuery** (Python, OpenCascade-based
code-first parametric solids), **OpenSCAD** (script-based solids),
**chili3d** (browser-native parametric sketch editor), **O-LAP**
([o-lap.org](https://o-lap.org/)) — a general parametric-furniture community
with a `starter_project` template repo.

**What Furni AI can learn**: all the serious parametric-solid tooling is
Python/OpenCascade-based, not JavaScript — confirms that Furni AI's own
approach (plain-JS parametric functions producing part arrays, as
`buildGeometry.js` already does) is the pragmatic choice for a Next.js/Vercel
stack, not a missing piece. There is no mature JS equivalent of
CadQuery/build123d worth adopting.

**Can this become a skill?** No — this is a stack-validation finding, not a
skill.

---

## DXF / nesting tooling

**nest2D** ([github.com/VovaStelmashchuk/nest2D](https://github.com/VovaStelmashchuk/nest2D)):
real no-fit-polygon nesting (via the Rust `jagua-rs` engine), a materially
better algorithm than simple guillotine/shelf bin-packing for minimizing sheet
waste. **Deepnest** ([deepnest.io](https://deepnest.io/)): the established
open-source desktop nesting tool most cabinet shops already know. **Maker.js**
([github.com/microsoft/maker.js](https://github.com/microsoft/maker.js)): a
JS library representing 2D CAD geometry (lines/arcs/circles → models → DXF/SVG
export) — notably the one CAD-adjacent library here that's actually
Node-compatible. **ezdxf** (Python) and **LibreCAD/QCAD** (desktop apps) round
out the DXF ecosystem.

**What Furni AI can learn**: the live site deliberately has **no DXF/nesting
step today** — `production.js` explicitly documents "no CAD, no 3D-mesh
export — BAZIS or the operator works from PDF + CSV" (see
`src/lib/production.js:11-12`). That's a scope decision, not an oversight. If
that scope ever changes, `maker.js` is the one option here that would actually
fit the existing Node/Next.js stack without introducing a Python subprocess —
worth remembering, not worth adopting now.

**Can this become a skill?** Not for this pilot — no current product need
(the factory already works from PDF/CSV via BAZIS). Noted for the future
version of a possible **DXF/Nesting Export** skill if the factory workflow
ever asks for it.
