# ADR-003 - Golden Wardrobe plinth side inset authority

**Status:** Accepted 
**Date:** 2026-09-09 
**Decider:** Bekzod Khalimov (BEK) 
**Recorded by:** Grok (Mission #1)

## Context

During Grok's initial FurniAI reconnaissance, the mission onboarding brief stated a Golden Wardrobe plinth side inset of **50 mm**.

The repository-approved Golden Wardrobe authority states **0.0 mm** (frame-aligned plinth):

- `src/lib/furnispec/goldenWardrobe.fixture.json` - `plinth.sideInsetMm: 0.0`, `sideInsetStatus: "BEKZOD_APPROVED"`
- `docs/WARDROBE_RULEBOOK_V0.1.md` - WR-007 frame-aligned plinth (`X ∈ [0, 1800]`)
- `src/lib/rules/wardrobeRuleCatalog.js` - `plinthSideInsetMm` rule value `0.0`
- PartGraph golden schedule - plinth side returns at the outer carcass faces (no 50 mm inset)

A `50.0` value appears only as a non-golden mutation/warning test case, not as the approved golden constant.

## Decision

**For FurniAI Golden Wardrobe and all agents:**

> **Plinth side inset = 0.0 mm (frame-aligned) is authoritative.**

The 50 mm figure in the earlier onboarding brief was a mistake and must not be reintroduced into golden fixtures, rulebook text, or PartGraph golden expectations without a new BEK decision.

## Consequences

- Agents must not "fix" golden plinth inset to 50 mm.
- Future briefs that cite 50 mm should be challenged against this ADR and the golden fixture.
- Non-golden parametric experiments may still explore nonzero insets if explicitly scoped - they are not the golden oracle.

## References

- `src/lib/furnispec/goldenWardrobe.fixture.json`
- `docs/WARDROBE_RULEBOOK_V0.1.md` (WR-007)
- `docs/G2_2_PARTGRAPH_CONTRACT.md`
- FurniAI Mission #1 authorization from BEK (2026-09-09)
