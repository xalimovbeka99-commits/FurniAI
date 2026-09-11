# M2-OMIT-01 — every accepted component is accounted for

**Status:** implemented
**Branch:** `claude/design-engine-reliability`
**Base:** `antigravity/finish-visible-designer @ 206ee06efb30733da4fe0638ff6e5ccd5039ee6e`

## The failure this closes

`buildStructuralPartGraph` walked each bay's components through an
`if / else if` chain and had no final `else`. FurniSpec validation accepted a
`DRAWER_BANK`; the kernel matched no branch; the component produced no part, no
preview, no warning and no diagnostic. The customer's request was accepted and
then silently dropped — the system looked like it had agreed.

Silence is the worst available failure for a design tool. A refusal loses one
feature; silence loses the customer's trust in everything else on the screen.

## The rule

Every accepted component now carries exactly one outcome:

| Outcome | Meaning | Counted in |
|---|---|---|
| `STRUCTURAL` | Real manufacturing parts were emitted. `partIds` lists them. | `totalStructuralParts` |
| `PREVIEW` | Represented visually and/or as a documented placement datum. Not a cut part. | `previewComponents` only |
| `UNSUPPORTED` | Not represented. Carries a diagnostic, a customer-language explanation and an unapplied alternative. | `unsupportedComponents` |

The ledger is a **report**, not a decision. It records what the deterministic
kernel did. It never alters geometry and never introduces a construction rule.

## Where it lives

- `src/lib/partgraph/componentOutcomes.js` — outcome enum, diagnostic codes,
  the declared per-type policy, the ledger, and
  `unsupportedComponentsForCustomer()` which maps to the `unsupported[]` shape
  the published transport contract already carries.
- `src/lib/partgraph/buildStructuralPartGraph.js` — records an outcome in each
  branch, plus a catch-all `else` that records `UNSUPPORTED`.
- `partGraph.componentOutcomes[]`, new `summary` counts, and one warning per
  unsupported component.

## Why completeness, not a list of known types

The guard is an invariant — *every accepted component appears exactly once* —
rather than an enumeration of types the kernel handles. A component type added
to FurniSpec later and never wired up fails `componentOutcomes.test.js` instead
of vanishing. Two layers of defence:

1. `validateFurniSpec` rejects a type in no enum (`UNSUPPORTED_COMPONENT_TYPE`);
   it never reaches the kernel.
2. A type that *is* in `COMPONENT_TYPES` but has no policy or branch is recorded
   as `UNDECLARED_COMPONENT_TYPE` — an honest refusal, never silence.

## Hanging rails are PREVIEW, not unsupported

Rails are bought, not cut, so they are correctly absent from
`totalStructuralParts`. The older kernel used a rail only as a positioning
datum (it sets the clear drop below it). That is a reason to **record the
datum**, never a reason to call the rail unsupported.

Each rail outcome carries `previewKind: "HANGING_RAIL"` and a `placementDatum`
(`railCenterYDmm` plus the bay span). This composes with `exp/hanging-rail-preview`
(EXP-01): where that branch's `previews[]` lane is present the same components
also gain PREVIEW_ONLY visuals, and `previewKind` is the join. Nothing here
changes EXP-01's contract or its counts.

## Golden wardrobe — unchanged

19 structural parts, 4 operations, identical dimensions. 6 accepted components:
4 `STRUCTURAL`, 2 `PREVIEW` (the rails), 0 `UNSUPPORTED`. Previews are counted
separately and contribute no `partIds`.

## Drawer banks specifically

`DRAWER_BANK` is `UNSUPPORTED` with `COMPONENT_NOT_REPRESENTED`. The engineering
reason: PartGraph v0.1 has no drawer part roles, and drawer box dimensions
depend on a runner family that has not been approved. Emitting geometry would
mean inventing a construction rule, which is not ours to invent.

The customer is told, in ordinary language, that drawers are not available yet
and that the rest of their wardrobe is unchanged, and is offered a fixed shelf
at the same height. **The alternative is offered, never applied**
(`suggestedAlternative.applied === false`, asserted by test).

Lifting this is the M2 drawer slice and needs a ruling on the runner family
first.

## What must not change

Golden dimensions (1800 / 2300 / 100 / 2400 / 18 / 2264, bumper 2.0, plinth
side inset 0.0 per ADR-003); the 19-part golden count; drilling BLOCKED;
`WORKSHOP_REVIEW_NOT_CNC_QUALIFIED`; `vercel.json` framework null.
