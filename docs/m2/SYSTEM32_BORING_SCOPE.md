# System 32 boring, drawers and the model adapter — v0.2

Branch `integ/part-graph-compiler`, off `cb5f110`. Supersedes v0.1, which was
written before the rulings and recorded four open questions in its section 6.
Bekzod answered them on 2026-09-15; this records what that changed and what it
did not.

**Manufacturing policy is unchanged. CNC remains NOT QUALIFIED and hardware
drilling remains BLOCKED.** The rulings settled *geometry*, not authorisation —
see section 2.

Full suite: **1,087 passed**, 4 skipped, 20 todo, 84 files. Baseline was 1,024.
Three pre-existing assertions changed; each is listed in section 6 with why.

---

## 1. What the rulings said, and where each value now lives

Six values entered `src/lib/rules/wardrobeRuleCatalog.js` under a new provenance
class, `BEKZOD_RULING_2026_09_15`. It is its own class rather than
`RULEBOOK_V0_1` because `docs/WARDROBE_RULEBOOK_V0.1.md` has not been updated —
the Rulebook is the record of what was ruled, and it has not caught up. Once it
is, these entries should be restamped and the class retired.

| Key | Value | Rule ID |
|---|---|---|
| `shelfPinHoleDepthByCarcassThicknessMm` | `{18: 13.0, 16: 11.5}` | BR-2026-09-15-PIN-DEPTH |
| `shelfPinColumnOriginDatum` | `BOTTOM_PANEL_UPPER_FACE_PLUS_64MM` | BR-2026-09-15-PIN-ORIGIN |
| `shelfPinColumnUpperBoundDatum` | `TOP_PANEL_LOWER_FACE_MINUS_64MM` | BR-2026-09-15-PIN-UPPER-BOUND |
| `shelfPinRearRowPolicy` | `BORED_MIRROR_FRONT_37MM` | BR-2026-09-15-PIN-REAR-ROW |
| `drawerRunnerFamily` | `UNDERMOUNT_CONCEALED_21MM` | BR-2026-09-15-RUNNER-FAMILY |
| `drawerSlideWidthDeductionMm` | 21.0 **total** | BR-2026-09-15-RUNNER-DEDUCTION |
| `drawerFrontRevealMm` | 2.0 | BR-2026-09-15-DRAWER-REVEAL |

**Hole depth is stored as a table, not a number.** The ruling gave two figures
for two board thicknesses. Storing 13.0 alone would have lost the 16mm case and,
worse, would have silently applied a 13mm hole to a board the ruling never
covered. `shelfPinHoleDepthFor(thicknessMm)` throws on any other thickness — a
pin hole deeper than the board is a hole through the customer's wardrobe.

The unruled-rule roster is back to the three it held before this work
(`bayCountForWidth`, `doorsPerBay`, `unevenBayWidthDistribution`). It briefly
held six while the boring inputs were open.

## 2. Geometry is DEFINED. Drilling is still BLOCKED.

`src/lib/partgraph/system32Boring.js` now reports two independent statuses
where it previously reported one:

- `geometryStatus: "DEFINED"` — every hole has a position and a depth.
- `status: "BLOCKED_PENDING_HARDWARE_APPROVAL"` — on every operation, always.

The second did not move, and nothing in the brief asked it to. WR-009 gates
production drilling coordinates on **pin SKU sign-off**, no SKU is recorded
anywhere in the repository, and the standing manufacturing policy is unchanged.
The plan still reports `shelfPinSku` as an outstanding input.

Splitting the field is what allowed the schema to be finished without anything
downstream reading it as a machining release. Tests assert
`approvedOperations === 0` under every option, that `machineOutput` and
`toolPath` are null on a walk of every value in the plan, and that compiling
against a `CNC_QUALIFIED` graph throws.

**What changed in the boring output:** holes are enumerated by default (the
provisional-origin machinery and its opt-in flag are gone — there is nothing
provisional left to guard); the rear row is emitted, mirroring the front at
37mm from the rear datum; depth is read per part from the board being bored.
The golden wardrobe now yields 8 operations instead of 4, because each bored
face carries a front row and a rear row.

**A coordinate bug this work caught.** v0.1 placed the front row at
`maxZDmm - setback`. Z increases toward the **rear**, so a panel's front edge is
its `minZ` — v0.1 would have put the "front" row 37mm from the back of the
wardrobe. It was never drillable, so nothing was at risk, but it was wrong. The
test now asserts row positions against each part's own placement rather than
restating the formula.

## 3. Drawers compile — but not from a conversation, and that distinction is load-bearing

`src/lib/partgraph/drawerPack.js` compiles a `DRAWER_BANK` into five parts per
row: `DRAWER_FRONT`, `DRAWER_SIDE_L`, `DRAWER_SIDE_R`, `DRAWER_BACK`,
`DRAWER_BOTTOM`. All five are declared in `PART_ROLES`. There is deliberately
no `DRAWER_BOX_FRONT`: in this decomposition the front is the front of the box.

Three dimensions are derived, each from values the spec already states:

| Derived | Formula |
|---|---|
| row height | the bank's own `heightMm` / its own `rows` |
| box width | bay clear width − the ruled 21.0mm **total** |
| front width | bay clear width − 2 × the ruled 2.0mm reveal |

The front is **inset in the bay opening**, not overlaid on the carcass. This is
a hinged-door wardrobe and the drawers sit behind the doors, so an overlay front
would occupy the doors' own plane — the validator's collision check proves it.
Inset also removes any need to decide how a front tiles across a divider, which
no rule states.

### Five inputs the ruling did not settle

A runner family and a width deduction fix the box's **width**. They do not fix:

| Input | The question |
|---|---|
| `boxHeightMm` | How tall is the drawer box side, for a given row height? |
| `boxDepthMm` | Undermount runners come in nominal lengths — which one? |
| `boxBottomClearanceMm` | How much clearance does the runner need beneath the box? |
| `bottomThicknessMm` | What thickness is the drawer bottom? |
| `backBetweenSides` | Back between the sides, or behind them at full box width? |

A spec that states all five compiles into real parts — 15 of them for a
three-row bank, and the resulting PartGraph validates. A spec that does not is
recorded `UNSUPPORTED` / `COMPONENT_NOT_PLACED` with the missing field named.

**So `COMPONENT_REPRESENTATION_POLICY[DRAWER_BANK]` still declares UNSUPPORTED,
and that is correct rather than stale.** Nothing in the conversational intake
path can supply those five inputs, so a customer who asks for drawers still
cannot be given drawers — and that policy entry is what tells them so before the
request reaches a model. The entry carries a new `conditionallyStructural` field
naming the required inputs and the module that compiles them. The kernel records
`STRUCTURAL` at runtime when a spec does state them, overriding the default.

Flipping the policy outright was tried and reverted: it broke eleven tests
across `unsupportedRequestIntegration`, `unsupportedCustomerEntry` and
`capabilities`, all of which were right to break. The customer-facing promise
had changed without the capability changing.

## 4. The adapter, not a second compiler

`src/lib/partgraph/wardrobeModelAdapter.js` —
`adaptWardrobeModelToFurniSpec(wardrobeModel, options)` — translates a
WardrobeModel into a FurniSpec and hands it to the existing
`buildStructuralPartGraph`. `model.id` becomes `specId`; `revision` is
incremented by one.

This answers v0.1 section 2, which declined to write
`createPartGraphFromModel` because a second compiler would fork the geometry.
An adapter does not: there is still one compiler, one set of construction rules,
one place a bug can live. A golden-shaped model reproduces the golden carcass
numbers exactly — 2300 / 580 / 447.5 / 2296 — which is the test that would fail
first if the two paths ever diverged.

`conversation/assembleFurniSpec.js` was considered and rejected as the route:
its `bayLayouts` admits exactly two archetypes, so anything else in a model
would have been silently discarded — the failure the component ledger exists to
prevent.

It **refuses rather than approximates**. `adapterDiagnostics(model)` returns the
same list without throwing. It refuses when:

- no plinth height is supplied (a WardrobeModel has no plinth and no rule states
  one — it is passed as an option or it is not adapted);
- a component type has no FurniSpec expression;
- a hanging rail has no shelf above it to measure `offsetBelowShelfMm` from;
- a drawer bank has no row count;
- the spec it would emit fails `validateFurniSpec` — reported as an adapter
  failure, so the error names the adapter rather than the kernel.

Two mapping decisions are recorded rather than hidden, because a WardrobeModel
is less expressive than a FurniSpec:

- **SHELF → SHELF_FIXED.** The model has one shelf type; FurniSpec has two.
  Fixed is the conservative reading. It is a decision between two schemas, not a
  furniture rule, which is why it lives in the adapter and not the catalog.
  `options.shelfKindFor` overrides it per component.
- **HANGING_RAIL → LONG or SHORT**, classified against the two
  `GOLDEN_FIXTURE_BEKZOD_APPROVED` target clear drops (1400 / 900), whichever is
  nearer. No new threshold is introduced; the boundary is the midpoint of two
  approved figures.

Both are worth a confirmation from Bekzod, but neither blocks.

## 5. What is still open

1. **Pin SKU.** WR-009 names it as the gate on drilling coordinates. Until it
   exists, boring geometry is defined and drilling stays blocked.
2. **The five drawer box inputs** in section 3. Until they are ruled, drawers
   compile only for a spec that states them, and a customer asking for drawers
   is still told no.
3. **Which stack is canonical**, `wardrobe-model` or `FurniSpec`. The adapter
   makes the question less urgent — the model can now reach a PartGraph without
   a second compiler — but it does not answer it, and
   `RULE_AUTHORITY_POLICY.md` section 5 still records it as open.
4. **The Rulebook has not been updated** with the 2026-09-15 values. Until it
   is, `BEKZOD_RULING_2026_09_15` is doing the Rulebook's job.
5. **Adapter mapping confirmations**: the SHELF and rail readings in section 4.

## 6. Test accounting

1,024 → **1,087**. Sixty-three new tests across
`system32Boring.test.js` (25), `drawerPack.test.js` (19) and
`wardrobeModelAdapter.test.js` (19). Three pre-existing assertions changed:

- `wardrobeRuleCatalog.test.js` — the exact-equality roster of unruled keys went
  3 → 6 → 3 as the boring inputs opened and closed. Exact equality is kept.
- `validatePartGraph.test.js` and `capabilities.test.js` — both used
  `"DRAWER_FRONT"` as the sentinel for an undeclared part role. It became a real
  role, so the sentinel is now `"DRAWER_RUNNER_BRACKET"`. Without this change the
  tests would have passed while proving nothing.
- `componentOutcomes.test.js` — a drawer bank missing its box dimensions is now
  `COMPONENT_NOT_PLACED` (this instance could not be built) rather than
  `COMPONENT_NOT_REPRESENTED` (the kernel has no idea what a drawer is). The
  guarantee under test is unchanged: it is reported, never silently omitted.

No test was weakened or deleted.

Nothing in this branch is manufacturing evidence. No panel has been cut and no
machine has been run.
