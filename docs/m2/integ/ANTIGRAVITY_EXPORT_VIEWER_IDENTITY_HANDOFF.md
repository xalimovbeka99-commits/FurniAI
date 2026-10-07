# ANTIGRAVITY HANDOFF — Export ↔ Viewer PartGraph identity

**Assigned by:** Bekzod via Integration (CraZy)  
**Date:** 2026-09-20  
**Engineering candidate SHA (start here):** `0d8f3126c75a99ca88da12424ea022cc7c6c43eb`  
**Coordination/docs tip (do not confuse):** `1092de351e777dee991eedc2fd57ac86b376d4e1`  
**Fix branch (created for you):** `fix/ai-export-viewer-identity` (from `0d8f312` only)  
**Deadline:** checkpoint 45 min · fix + focused tests target 90 min  

## Ownership

| Role | Owner |
|---|---|
| **SPA identity fix** | **Antigravity** (this handoff) |
| Acceptance gate + combine | Grok Integration |
| Independent before/after | Grok Verifier |
| Journey rerun | Grok DemoTester |
| Live Anthropic | Claude (from `5041865`) — **do not** pull Claude into this UI fix |

Verifier and DemoTester are **forbidden** from competing implementations.

## Defect (REPRODUCED @ 60ba875 and STILL FAIL @ 0d8f312)

`getActivePartGraph()` never reads `aiWardrobeState.partGraph`. After a non-golden AI draft, Manufacturing export falls back to `goldenSpec` (~1800 mm) while the viewer shows the AI design. `ExportMenu.jsx` invents `wardrobe-${Date.now()}` + `revision: 1`.

### Exact repro

1. Open Design with AI  
2. Draft wardrobe with width ≠ 1800 (e.g. 2000 or 2200)  
3. Record on-screen: `specId`, revision, W/H/D, PartGraph identity if shown  
4. Manufacturing → export shop drawings / cut list / nesting  
5. **FAIL:** export envelope/identity ≠ draft  

### Code locus (Verifier)

- `index.html` ~3336–3343: `getActivePartGraph` → `currentPartGraph || buildStructuralPartGraph(currentFurniSpec||goldenSpec)` — no AI PartGraph  
- `ExportMenu.jsx` ~158–159: synthetic `wardrobe-${Date.now()}` + `revision: 1`  
- Introduced lineage noted since `f4fd28c7` for the SPA glue miss  

## Required fix behavior

1. `getActivePartGraph()` **must** use `aiWardrobeState.partGraph` whenever an AI wardrobe is active.  
2. Manufacturing Export must consume **that exact** active PartGraph.  
3. Do **not** invent `wardrobe-${Date.now()}`, revision `1`, dimensions, or fallback identity when real `specId`, revision, and PartGraph metadata exist.  
4. Viewer, summary, drawings, SVG, DXF, CSV, nesting → **same** accepted design.  
5. Golden fallback **only** when no customer design exists — and must be **explicit**, never silent.  
6. Undo must restore active **export** source to the restored PartGraph + revision.  
7. Unsupported/failed AI request → viewer **and** export source unchanged.  

## Required regression journey (automated preferred)

- Non-golden AI draft (e.g. width **2000** mm)  
- Record `specId`, revision, W/H/D, structural part count, fingerprint if exposed  
- Open Manufacturing Export → assert export PartGraph matches those fields  
- Apply another edit → repeat  
- Undo → repeat  
- Rejected request → viewer/export unchanged  
- Control: no AI design → golden still exports correctly (explicit)  

Compare at minimum: `specId`, revision, overall W/H/D, structural part count, stable fingerprint if available — **not width alone**.

## Next ExportMenu.jsx

If Next `ExportMenu` is on the pilot route: remove synthetic identity or pass authoritative identity in.  
If **not** on pilot route: document with routing evidence; mark as explicit follow-up — not an unverified assumption.

## Constraints

- Branch **only** from `0d8f312`. Isolated worktree recommended.  
- Do not overwrite Claude `claude/live-brain-prep` or unrelated CAM work.  
- No main merge, prod deploy, fingerprint refresh, CNC unlock.  
- Stop and report if required identity is unavailable from UI state — **do not manufacture** replacement IDs.  

## Handoff back to Integration

When done, push `fix/ai-export-viewer-identity` and reply with: tip SHA, files changed, test names, and confirmation of the journey above. Grok will merge/cherry-pick onto the candidate and run Verifier before/after + DemoTester rerun.
