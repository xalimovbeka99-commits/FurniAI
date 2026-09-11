# EXP-01 serialization vs base 337c7bf

## Structural parts and operations (field-level)
- Parts identical: **True**
- Operations identical: **True**
- Part counts: 19 -> 19
- Operation counts: 4 -> 4
- Mismatched part ids: (none)

## Canonical graph serialization
serializeCanonicalPartGraph is JSON.stringify(partGraph, null, 2) over the **entire** object.

Base graph keys: partGraphVersion, sourceSpecId, sourceRevision, unitScale, qualificationStatus, parts, operations, warnings, summary.

EXP-01 adds:
- previews (visual-only HANGING_RAIL entries)
- summary.totalPreviewParts

Canonical bytes: 18509 -> 20098 (equal=False).

**No structural panel or operation field drift** — only preview-related keys change the full-graph stringify.

## Integrator note (Claude / Antigravity)
- Manufacturing/regression authority remains parts + operations.
- previews must not enter CNC / BOM.
- Both partgraph-runtime-bridge.js and i-designer-transport.js bundle uildStructuralPartGraph — after kernel or adapter edits run 
pm run build:legacy and commit both regenerations together.
