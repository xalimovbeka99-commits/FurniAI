# Lineage audit — `wardrobeModelAdapter.js` and `componentOutcomes.js`

**Audited:** `c46ba83`, and the surrounding refs. **Date:** 2026-09-18.
No code changed by this audit. CNC remains NOT QUALIFIED; drilling BLOCKED.

---

## 0. `c46ba83` is not the tip of `integ/part-graph-compiler`

| Ref | Tip |
|---|---|
| `origin/integ/part-graph-compiler` | **`c48e108`** — 3 commits ahead of `c46ba83` |
| `origin/integ/m2-integration-lead` | `3fab34a` — 8 commits ahead |

The three commits between `c46ba83` and `c48e108` (`f4fd28c`, `c06c13f`,
`c48e108`) touch UI and docs only: `git diff c46ba83 c48e108 -- src/lib/partgraph/
src/lib/rules/` is **empty**. So for the two modules named in this audit,
`c46ba83` and the branch tip are byte-identical and the audit holds for both.

It does **not** hold for the integration lead. `3fab34a` is 8 commits ahead and
carries the PL-006 work. Anyone reading `c46ba83` as "the tip" will miss it.

## 1. Single-source-of-truth conformance: both files PASS

| Check | `wardrobeModelAdapter.js` | `componentOutcomes.js` |
|---|---|---|
| Imports `buildStructuralPartGraph` | no | no |
| Emits `PART_ROLES` parts | no | no |
| Exports a second compiler entry | no — one function | no — ledger only |
| Mentions the compiler | doc comment only | doc comment only |

Neither introduces a duplicate compiler path. The adapter produces a FurniSpec
and stops; the ledger records outcomes and stops. `buildStructuralPartGraph`
remains the single place a part is created. **Architecturally this is correct
and should not change.**

## 2. Four defects inside the adapter, none of them structural

Conformance is not correctness. Reading `wardrobeModelAdapter.js` line by line:

### 2.1 It invents `doorsPerBay`, which the catalog refuses to supply

```js
let doorCount = doorLeavesSpecified > 0
  ? doorLeavesSpecified
  : (widthMm >= 1800 ? 4 : (widthMm >= 1000 ? 2 : 1));
```

`doorsPerBay` is registered `REQUIRES_BEKZOD_RULING` with the note *"no Rulebook
rule states it. Must be asked."* — `resolve()` throws on it **by design**. This
ladder is precisely the unapproved rule, hard-coded, with two further invented
thresholds (1800, 1000). It is the single most direct violation of the
rule-authority contract in the file.

**Fix:** when no DOOR component states `leaves`, this is a clarification gap, not
a default. Raise it rather than answer it.

### 2.2 It silently changes a customer's section width

```js
// Add discrepancy to the last bay to guarantee exact closure
bays[bays.length - 1].clearWidthMm = Math.round((... + diffWidth) * 10) / 10;
```

When the sections do not close against the interior width, the adapter widens or
narrows the **last** bay until the validator passes, and rounds to 0.1 mm while
doing it. A customer who specified two 873 mm sections can receive 873 and 874.2
without being told. This inverts the kernel's own policy — everywhere else a
derivation that does not close exactly throws rather than rounding.

**Fix:** refuse with the discrepancy named. Closure failure is the customer's
information, not the adapter's to absorb.

### 2.3 Approved values written as literals

`revealTopMm = 2.0`, `revealBottomMm = 2.0`, `revealPerimeterMm = 2.0`,
`revealInterMm = 2.0`. All four are WR-008's `doorRevealMm`. They carry no rule
ID and will not track a rule change. Same pattern as `offsetBelowShelfMm: 100.0`
(WR-012), `depth - 20.0` (GF-SHELF-REAR) and the `350.0` fallback opening
(GF-TOP-OPENING) flagged in the earlier reconciliation.

**Fix:** `resolve()` each one. Mechanical, low risk.

### 2.4 It does not validate what it promises

The header says the output is *"consumable by buildStructuralPartGraph()"*, and
nothing checks it. `validateFurniSpec` appears only in a comment. A malformed
spec therefore surfaces as a kernel error naming the kernel, which sends the
next person to the wrong file.

**Fix:** validate before returning and raise an adapter-level error.

### 2.5 Coverage

`wardrobeModelAdapter.test.js` holds **3 tests** for a 292-line module carrying
the four defects above. That ratio is itself the finding.

## 3. A duplicate RULE source, which is the real answer to "duplicate paths"

There is no duplicate *compiler*. There is a duplicate *rule table*.

`src/lib/partgraph/drawerPackContract.js` declares:

```js
export const DRAWER_PACK_POLICY = Object.freeze({
  BALL_BEARING_SIDE_CLEARANCE_MM: 12.7,
  CONCEALED_UNDERMOUNT_TOTAL_REDUCTION_MM: 21.0,
  PERIMETER_REVEAL_MM: 2.0,
  ...
```

under a header reading *"Policies (BEK rulings 2026-09-15)"*.

- `21.0` and `2.0` duplicate `drawerSlideWidthDeductionMm` and
  `drawerFrontRevealMm`, which are in the catalog with rule IDs. Two sources for
  one rule is the defect `physicalLimitRegistry` exists to detect.
- **`12.7` was never ruled.** The 2026-09-15 ruling named
  `UNDERMOUNT_CONCEALED_21MM` and nothing else. 12.7 mm appeared in an earlier
  task brief as a proposed ball-bearing figure and has been written into the
  repository as a Bekzod ruling.

This is the second instance of the same attribution error — the first being
`emitDrawerBankParts.js`'s header, which credits 15 mm, 50 mm and 10 mm to the
same ruling. Neither is a calculation error; both are provenance errors, and
provenance errors are the ones that reach a workshop looking approved.

**Fix:** `drawerPackContract.js` should read its two real values through
`resolve()`, and `BALL_BEARING_SIDE_CLEARANCE_MM` should either be registered as
`PROVISIONAL_PENDING_BEKZOD_REVIEW` or deleted. It has no runtime consumer today,
so deleting it costs nothing.

## 4. Regression

`npx vitest run src/lib/partgraph/` on the current integration lead plus the
PL-006 fix: **75 passed, 5 files, 0 failed.**

| File | Tests |
|---|---|
| `buildStructuralPartGraph.test.js` | 28 |
| `pl006DegenerateGeometry.test.js` | 19 |
| `componentOutcomes.test.js` | 16 |
| `validatePartGraph.test.js` | 9 |
| `wardrobeModelAdapter.test.js` | 3 |

**Zero architectural drift** on the single-source question: one compiler, one
part-creating module, no second geometry stack. The drift that exists is in
provenance, not structure — three files now assert values as Bekzod rulings that
no ruling contains.
