# Handoff: EXP-01 rails → Antigravity

Rail tip: `5f416ce` on `exp/hanging-rail-preview`.
Candidate merges: `206ee06` + `5f416ce` + `dc94bda` safety-net.

## Files (Antigravity sole editor now)
- `src/lib/partgraph/buildStructuralPartGraph.js` (previews + resolveHangingRailTube)
- `src/lib/adapters/partGraphToThree.js`
- `src/lib/adapters/browserBridge.js` (do not recolor HANGING_RAIL)
- Regenerate both bundles with `npm run build:legacy`

## Assumptions (visual only)
OVAL_TUBE_15X30 → 15×30 mm; end inset 2 mm; mid-depth Z; Y = shelfBottom - offsetBelowShelfMm.
Unknown type → 15×30 fallback, tubeTypeResolved=false.

## Must verify
Rails in hanging bays; length tracks bay; material does not recolor rails; Undo/rebuild no dup/loss; previews ≠ structural/mfg.

Grok stops editing these files; verification only.
