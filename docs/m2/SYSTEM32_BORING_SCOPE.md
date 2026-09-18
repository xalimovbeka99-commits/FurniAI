# System 32 boring — what was built, what was refused, and why

Branch `integ/part-graph-compiler`, off `cb5f110`. Nothing here records an
approval, changes a rule value, or alters manufacturing policy. CNC remains NOT
QUALIFIED; hardware drilling remains BLOCKED.

Inspected at `cb5f110627e1df589101f416fb34299ebb092bc0` on 2026-09-15.

---

## 1. `src/lib/part-graph/` was not created. The existing `src/lib/partgraph/` was extended.

The brief asked for a new `src/lib/part-graph/`. That directory differs from the
existing `src/lib/partgraph/` by a single hyphen, and both would have been
importable. A mistyped import would have resolved silently to the wrong
compiler.

It would also have been a second panel compiler. `src/lib/partgraph/` already
emits the Golden Wardrobe's 19 structural parts, and each part already carries
almost everything Objective 1 listed: `id`, `role`, `quantity`, `materialCode`,
`geometryType`, `finished`/`raw` dimensions in integer deci-mm, a `placement`
bounding box, `orientation`, `grainDirection`, per-edge banding under `edges`,
`status` and `sourceRuleIds`. A parallel implementation would have duplicated
that and then drifted from it.

So the work went into the existing directory. No new geometry stack exists.

## 2. `createPartGraphFromModel(wardrobeModel)` was NOT written, and here is the open question behind it.

The requested entry point takes a `wardrobeModel`. The existing compiler takes a
`FurniSpec`. Those are the two engineering stacks documented in
`docs/m2/RULE_AUTHORITY_POLICY.md` §1, and which of them is canonical is
recorded there as **open** — the same question Grok's acceptance report raised
as "Path B does not mirror Path A".

Writing a second compiler for the second stack would entrench that fork rather
than close it. If the entry point is wanted, the cheap and non-duplicating form
is an adapter — `wardrobeModel` → `FurniSpec` → the existing compiler — but that
is a decision about which stack is authoritative, not a coding detail. It is
listed in §6 rather than guessed at.

## 3. System 32 boring was built, in the only form WR-009 permits.

`docs/WARDROBE_RULEBOOK_V0.1.md` row WR-009 reads:

> System 32 Shelf Pins — 37 mm / 32 mm — Semantic grid on 32mm pitch, 37mm edge
> setback. Exact drilling coordinates are `MACHINING_BLOCKED` pending Bekzod pin
> SKU sign-off.

The grid is approved. The coordinates are not. `src/lib/partgraph/system32Boring.js`
compiles the approved half and refuses the unapproved half:

- Every operation carries `status: "BLOCKED_PENDING_HARDWARE_APPROVAL"`.
- `machineOutput` and `toolPath` are `null` on every operation, asserted by a
  walk over every value in the plan, not a substring match on key names.
- `qualificationStatus` is **copied** from the source PartGraph, never computed.
  Compiling against a `CNC_QUALIFIED` graph throws.
- `approvedOperations` is `0` under every option combination.

Three rule values were added to `wardrobeRuleCatalog.js` as `RULEBOOK_V0_1`.
None is new: `shelfPinFrontSetbackMm` 37.0 and `shelfPinDiameterMm` 5.0 are
transcriptions of the WR-009 row and of the already-approved
`SYSTEM_32_PIN_5MM` pin type, alongside the pitch that was already registered.

### It is a separate artefact, not a branch inside the structural builder

`buildStructuralPartGraph.test.js` case 16 asserts the structural operation list
holds exactly four `BACK_GROOVE` operations, all `APPROVED` — the standing proof
that hardware drilling is absent from the structural graph. Splicing boring into
that list would have meant weakening that assertion. Instead
`compileSystem32Boring(partGraph)` reads a graph and returns a separate plan.
The structural graph is not mutated and its canonical serialization is
byte-identical before and after, which is asserted.

### No holes are enumerated by default

A pitch and a setback do not locate a hole; you also need the column origin, and
WR-009 states none. Three inputs are registered as `REQUIRES_BEKZOD_RULING` so
that `resolve()` throws on each rather than a value being chosen:

| Key | Why it is unruled |
|---|---|
| `shelfPinHoleDepthMm` | The 12–14 mm figure in `docs/knowledge-base/construction-standards.md` cites Wikipedia, not a Bekzod ruling. |
| `shelfPinColumnOriginDatum` | WR-009 fixes pitch and setback but not where hole 0 sits. |
| `shelfPinRearRowPolicy` | The rear-row mirror is described in a knowledge-base note as a machine-retooling convenience. It is not a Rulebook rule, so no rear row is emitted. |

A fourth unresolved input is reported in the plan itself: WR-009 names **pin SKU
sign-off** as the gate, and no SKU is recorded anywhere in the repository.

`{ enumerateHoles: true }` produces a review preview under an origin named
`PROVISIONAL_COLUMN_ORIGIN`, and every such plan carries a non-empty
`assumptions[]` naming it. The preview exists for Bekzod to correct. The status
does not change.

## 4. Drawer slide deductions were REFUSED.

The brief asked for 12.7 mm per side for ball-bearing runners and 21 mm for
undermount. Neither figure appears in `docs/WARDROBE_RULEBOOK_V0.1.md`, in the
golden fixture, or anywhere else in the repository.
`docs/knowledge-base/hardware-specifications.md` names undermount runner families
(Blum Tandem, Movento, Salice) and gives no deduction figure.

`src/lib/partgraph/componentOutcomes.js` currently declares `DRAWER_BANK`
**UNSUPPORTED**, for this exact reason: "drawer box dimensions depend on a runner
family that has not been approved. Emitting geometry would require inventing
construction rules." Implementing a deduction would contradict that ledger and
move drawers from *honestly unsupported* to *silently built on an unapproved
number* — which is worse, because the customer would stop being told.

`PROVISIONAL_PREVIEW_RULE` does not apply either. That class covers a value that
is **already enforced** with nobody's approval. Nothing is enforced for drawers
today, so adding a value would not be labelling an existing decision honestly;
it would be making a new one.

Drawers stay UNSUPPORTED pending §6.

## 5. Test roster: 1,024 → 1,046. One assertion updated, none weakened.

22 new tests in `src/lib/partgraph/system32Boring.test.js`. Every prior test
passes unchanged except one, which was **extended, not relaxed**:

`wardrobeRuleCatalog.test.js` asserts exact equality on the list of rules that
still need a ruling. It held three keys and now holds six. Exact equality is
kept, so the roster still cannot grow or shrink silently; the three additions are
the boring inputs above. The separate guard that `resolve()` throws and the value
is `null` for every unapproved key passed unchanged for all six.

Full suite: **1,046 passed, 4 skipped, 20 todo**, 82 files.

## 6. For Bekzod — four questions

1. **Hole depth.** 12–14 mm is the trade-standard range. What is the FurniAI
   figure, and does it vary by board?
2. **Column origin.** Where does the first hole of a column sit — measured from
   what? Without this no column can be enumerated.
3. **Rear row.** Bored or not? If bored, does it mirror the 37 mm from the rear
   edge?
4. **Drawer runners.** Which runner family, and what side deduction? Until this
   is answered drawers remain UNSUPPORTED and the customer is told so.

A fifth, separate from boring: **which stack is canonical**, `wardrobe-model` or
`FurniSpec`? §2 is blocked on it, and so is the parity question in
`RULE_AUTHORITY_POLICY.md` §5.

Nothing in this branch may be treated as manufacturing evidence. No panel has
been cut and no machine has been run.
