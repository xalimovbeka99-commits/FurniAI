# Wardrobe AI verification test plan

**Owner:** Codex verification  
**Fixture version:** `wardrobe-ai-verification/1`  
**Current capability status:** `NOT IMPLEMENTED`

## Scope

This infrastructure verifies Claude's future Wardrobe AI implementation. It
does not define a second Wardrobe Model, repair product code, or treat existing
configurator tests as evidence that Wardrobe AI works.

## Fixtures

- `tests/wardrobe-ai/fixtures/canonical-model-contract.json` defines integer
  millimetre, stable-identity, deterministic-serialization, section-fit, and
  UI/Three.js/LLM-independence requirements without defining an implementation.
- `tests/wardrobe-ai/fixtures/tool-contracts.json` defines the shared validation,
  atomicity, structured-result, and exact-behavior cases for the agreed eight
  deterministic tools. All execution remains blocked until Claude publishes
  the real interfaces.
- `tests/wardrobe-ai/fixtures/golden-scenarios.json` stores semantic expected
  models, including asymmetric wardrobes with explicit absolute section widths.
  It intentionally contains no rendering coordinates.
- `tests/wardrobe-ai/fixtures/conversational-scenarios.json` specifies a
  five-turn edit sequence and requires one aggregate identity, increasing
  revisions, and stable component IDs.
- `tests/wardrobe-ai/fixtures/adversarial-scenarios.json` specifies invalid,
  unsupported, fabricated-tool, and raw-coordinate attacks. Every rejection
  must preserve the valid model and revision.
- `tests/wardrobe-ai/fixtures/frozen-surfaces.json` records SHA-256 hashes and
  the current default wardrobe's semantic configurator output.

## Harnesses

`tests/wardrobe-ai/determinismHarness.js` canonicalizes object keys and executes
an injected deterministic command function 100 times by default. The harness
itself is tested, but the Wardrobe kernel test remains `BLOCKED` until Claude
provides the implementation and contract entry point.

The frozen-surface suite checks the existing `/builder`, viewer bridge, store,
configuration, validation, and geometry sources without modifying them. It also
checks semantic default output, so source drift and behavior drift are both
visible. An approved minimal integration change requires an explicit baseline
review; hashes must never be refreshed merely to make CI green.

## Activation contract

When Claude hands off the implementation, Codex will add a narrow verification
adapter that invokes the documented public tool/kernel APIs. The currently
blocked tests may be activated only when they can prove:

1. golden prompts produce the expected canonical semantic properties;
2. conversational edits mutate the same aggregate and preserve stable IDs;
3. invalid and unsupported operations return explicit error codes and do not
   change the model or revision;
4. 100 identical deterministic command runs serialize identically; and
5. adapter output accounts for every supported canonical component shown in
   the existing viewer.

No Three.js coordinate is an accepted AI/model expectation. No pending test may
be relabeled as passing based on an existing FSL, config, geometry, or UI test.

## First execution result

The first run on 2026-08-11 detected changes made after capture in
`src/app/builder/page.jsx` and
`src/components/builder/FurnitureModel.jsx`. Their frozen checks remain failing
pending independent review; the recorded hashes were not refreshed. This is a
regression signal, not proof that either change is defective.
