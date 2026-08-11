# Wardrobe production independent verification plan

**Owner:** Codex manufacturing verification  
**Version:** `wardrobe-production-verification/1`  
**Implementation status:** `NOT IMPLEMENTED`

## Scope

This harness verifies a future deterministic production derivation from the
approved Phase 1 `WardrobeModel`. It does not implement a production model,
panel engine, joinery, drilling, PDF generation, nesting, or CNC.

The source boundary is fixed:

```text
approved WardrobeModel -> deterministic derived production artifacts
```

The LLM may request production preparation but may not provide panel sizes,
connections, drilling coordinates, release status, or manufacturing files.

## Verification layers

1. Manufacturing-panel identity and traceability back to WardrobeModel IDs.
2. Integer-millimetre carcass and clear-section reconciliation.
3. Assembly-graph referential integrity.
4. Versioned joinery-rule provenance and applicability.
5. Machining bounds, face, depth, and mating-operation consistency.
6. Shelf bottom/centreline/top and clear-opening reconciliation.
7. Atomic production blocking on any validation error.
8. Panel, cut-list, BOM, drawing-data, and PDF-model reconciliation.
9. Determinism through canonical serialization across 100 identical runs.
10. Regression protection for the approved Phase 1 model/tool/viewer boundary.

## Evidence policy

Wardrobe 62 and Wardrobe 73 source PDFs are not present in the repository.
Consequently, no panel, drilling, or joinery fact from either wardrobe is
marked `VERIFIED`. The six Wardrobe 73 B2 shelf positions supplied in the
Phase 2 request are recorded as `CANDIDATE`, not factory authority. Reference
tests stay blocked until the source drawing, revision, page/detail, units, and
professional review are available.

Allowed rule states are `CANDIDATE`, `VERIFIED`, `APPROVED`, and `DEPRECATED`.
Only an applicable `APPROVED` rule backed by an approved factory profile and
physical qualification may contribute to `RELEASED_BY_FACTORY`. Phase 2
software output must otherwise remain a factory-review artifact with
`FACTORY_QUALIFICATION_REQUIRED` or a blocked state.

## Activation contract

Claude must publish versioned public derivation and validation interfaces
before Codex activates the blocked tests. Activation requires the tests to use
those real interfaces directly, not a Codex-owned parallel implementation.
Fixture expectations may not be weakened merely to make an implementation
pass; any contract discrepancy requires an explicit decision and review.

Phase 2 excludes nesting, CNC/DXF post-processors, pricing, ERP, orders,
inventory, kitchens, vanities, and viewer redesign.
