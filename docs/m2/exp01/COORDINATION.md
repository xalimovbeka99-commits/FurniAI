# EXP-01 coordination — Claude kernel + Antigravity materials

## Shared baseline
- Experiment branch: `exp/hanging-rail-preview`
- Checkpoint parent: `337c7bfd2fd1f040b44ccbcd07ec94141cae59cd`
- Draft PR: https://github.com/xalimovbeka99-commits/FurniAI/pull/2 (base: `antigravity/unified-chat-ai-transport`)

## Why both bundles change
`npm run build:legacy` regenerates:
- `partgraph-runtime-bridge.js` (from `browserBridge.js` → includes PartGraph builder + `partGraphToThree`)
- `ai-designer-transport.js` (from `aiDesignerTransport.js` → also bundles `buildStructuralPartGraph`)

So **any** Claude kernel edit to `buildStructuralPartGraph.js` and **any** Antigravity edit to `partGraphToThree.js` / `browserBridge.js` must rebuild **both** artifacts in the same PR/commit set. Do not hand-edit the bundles.

## Ownership boundaries (no duplication)
| Agent | Keep | Coordinate with EXP-01 |
|---|---|---|
| **Claude** M2-OMIT-01 | Fail-closed unsupported components | If you add `else` on component loop, preserve HANGING_RAIL as DATUM_ONLY + `previews[]` emit (or call shared helper). Do not treat `previews` as structural parts. |
| **Antigravity** M2-MAT-01 | materialCode / materialKey / Undo | `updateParametricMaterial` must **not** recolor `materials.HANGING_RAIL` (chrome preview finish). Expose `userData.assumed` / `finishIntent` if you surface part details in UI. |
| **Grok** EXP-01 | Visual hanging-rail previews | Evidence + draft PR only; no production merge |

## Serialization contract
See `docs/m2/exp01/SERIALIZATION_DIFF.md`:
- `parts` + `operations` field-identical to base `337c7bf`
- Full `serializeCanonicalPartGraph` text changes only because of `previews` + `summary.totalPreviewParts`
