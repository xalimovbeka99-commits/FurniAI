# GitHub Landscape — Learn / Reuse / Avoid

**Verification key:** ✅ = verified via web search 2026-07-23 · ◐ = high-confidence from prior knowledge, re-verify before any code adoption. License must be re-read from the repo's LICENSE file at the exact commit before reuse.

| Repo | License | Maintenance | Verdict | Why |
|---|---|---|---|---|
| dprojects/Woodworking | MIT ✅ | Active (release 2026-07) ✅ | **Learn** | Cabinet parameterization, dowel/drill/cut-list workflows. FreeCAD-bound; ideas transfer, code doesn't (FurniAI has no FreeCAD runtime). |
| lairdubois/opencutlist | GPL-3.0 ✅ | Active ✅ | **Learn only** | Best-in-class part semantics: material/grain metadata, edge-banding, cutting diagrams, labels. **GPL-3.0 = do not copy code into the commercial closed-source product.** Extract concepts (already done in batch 1). |
| FreeCAD/FreeCAD | LGPL-2.1+ ◐ | Very active ◐ | **Learn / defer** | Parametric history, TechDraw, CAM architecture. A server-side FreeCAD is a Phase-D+ option only if exact solids ever become required; today's factory contract (PDF+CSV→BAZIS) doesn't need it. |
| FreeCAD-library | Mixed/CC ◐ | Community ◐ | **Avoid as data source** | Parts unverified, licensing per-item unclear. Metadata organization ideas only. |
| neka-nat/freecad-mcp | MIT ✅ | Active, ~1.2k stars ✅ | **Learn** | Pattern for AI→CAD structured tool control. Arbitrary code execution = serious security boundary; never expose to customer traffic. |
| CadQuery/cadquery | Apache-2.0 ◐ | Active ◐ | **Learn / candidate reuse** | If a server-side exact-geometry proof of concept is ever needed (Phase D), CadQuery is the license-compatible, scriptable, testable choice over FreeCAD RPC. |
| cadquery-contrib | Apache-2.0 ◐ | Examples repo ◐ | Learn | NL→CadQuery experiment: evaluate determinism/security ideas. |
| openscad/openscad + BOSL2 | GPL-2.0 / BSD-2 ◐ | Active ◐ | **Learn** | BOSL2's attachment system is the best open model for "parts declare how they connect" — directly relevant to evolving `restsOnParts` into a general attachment grammar. BOSL2 (BSD) is copy-safe conceptually and legally; OpenSCAD core is GPL — concepts only. |
| Jack000/Deepnest | — | **Abandoned** (author unresponsive) ✅ | **Avoid** | Use deepnest-next (community fork, active builds Feb 2025+) if irregular nesting is ever needed. Verify fork license first. |
| Jack000/SVGnest | MIT ◐ | Dormant ◐ | Learn | NFP + genetic search reference. FurniAI parts are rectangles; irregular nesting is over-engineering today. |
| tamasmeszaros/libnest2d | LGPL-3.0 ✅ | Low activity; Ultimaker fork maintained ✅ | **Defer** | LGPL usable as dynamically-linked dependency if rectangular nesting ships in-product. Revisit at Phase F. |
| Google OR-Tools | Apache-2.0 ◐ | Very active ◐ | **Reuse candidate (Phase F)** | CP-SAT handles rectangular/guillotine sheet layout well — the right first nesting tool for melamine panel work if the factory wants utilization reports pre-BAZIS. |
| Open CASCADE | LGPL-2.1 w/ exception ◐ | Active ◐ | Defer | Only via CadQuery/FreeCAD, never directly. |
| chemrich/cabinet-mcp | **License not visible in search — must check repo** ✅(searched) | Recent | **Learn (validation)** | Already identified in `docs/knowledge-base/` as the strongest external validation of the graded-validation + tool-registry pattern. Confirm license before reading code closely. |

## Standing rules

1. No license ⇒ no reuse. GPL/AGPL ⇒ concepts only for FurniAI's closed-source product. LGPL ⇒ dynamic-link dependency only, with legal note.
2. Record repo, commit, license, and usage type in `source-registry.yaml` before any adoption.
3. Nothing here justifies changing the factory contract: FurniAI outputs PDF+CSV; BAZIS owns nesting and CNC today.

Sources: [Deepnest issues/fork status](https://github.com/deepnest-next/deepnest/), [Jack000/Deepnest](https://github.com/Jack000/Deepnest), [OpenCutList repo + LICENSE](https://github.com/lairdubois/lairdubois-opencutlist-sketchup-extension), [dprojects/Woodworking](https://github.com/dprojects/Woodworking), [libnest2d](https://github.com/tamasmeszaros/libnest2d), [Ultimaker fork](https://github.com/Ultimaker/libnest2d), [freecad-mcp](https://github.com/neka-nat/freecad-mcp), [cabinet-mcp](https://github.com/chemrich/cabinet-mcp)
