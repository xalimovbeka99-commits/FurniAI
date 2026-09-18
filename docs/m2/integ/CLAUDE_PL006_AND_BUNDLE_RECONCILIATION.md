# PL-006 proof and part-graph bundle reconciliation

**Branch:** `review/claude-reconcile`, off `origin/integ/m2-integration-lead @ 3fab34a`
**Bundle under review:** `claude/part-graph-bundle @ 19ee058` (prereq `cb5f110`)
**Date:** 2026-09-18

No fingerprint refresh, no main merge, no production deployment. CNC remains
NOT QUALIFIED and hardware drilling remains BLOCKED.

---

## 0. Ancestry, and why the bundle exists at all

Every candidate descends from `cb5f110`. **None contains `19ee058`.**

| Ref | Tip | Contains `cb5f110` | Contains `19ee058` |
|---|---|---|---|
| `origin/integ/m2-integration-lead` | `3fab34a` | yes | no |
| `origin/integ/m2-reproduction-combined` | `c51af19` | yes | no |
| `origin/integ/part-graph-compiler` | `c48e108` | yes | no |
| `origin/fix/mfg-boot-crash-and-nesting-report` | `bdafb42` | yes | no |

The bundle was built in a container that could not see those branches — they
were pushed after its last fetch, and its own pushes are refused by the proxy.
It is therefore an **independent reimplementation of the same scope**, not a
patch on top of the team's work. That is the whole reason there are two drawer
compilers, two boring modules and two adapters.

**One collision worth naming:** `origin/integ/part-graph-compiler` already
exists at `c48e108`. The bundle's branch carried the same name. It has been
renamed locally to `claude/part-graph-bundle`; a push under the old name would
have overwritten the team's branch.

---

## 1. Does the bundle supersede `emitDrawerBankParts`? — **No. Retire the bundle's drawer compiler.**

`emitDrawerBankParts.js` is wired end to end and the bundle's `drawerPack.js` is
not: conversational `Add drawers` (`3373fb5`), the `DRAWER_BANK_WITH_SHORT_HANGING`
bay layout, the viewer's drawer boxes and scribes (`64a22bd`), the kernel tool
path, and the exporters all reach it. The bundle's version reaches nothing but
its own tests. **Keep `emitDrawerBankParts` as the single authoritative drawer
implementation** (item 6) and delete `drawerPack.js` rather than merging them.

That is not a test-count judgement — the bundle has more drawer tests and still
loses. It loses because supported customer behaviour lives on the other side.

Three things in the bundle should be **ported into `emitDrawerBankParts`**
rather than discarded, and one bundle decision is simply wrong:

| Port | Why |
|---|---|
| Provenance for the four unruled constants (§2) | The emitter's header attributes dimensions to Bekzod that he did not rule |
| Exact-division refusal on `bankHeight % rows` | The emitter computes `bankHeight / rows` and lets a fractional row height through |
| `DEGENERATE_DRAWER_GEOMETRY` source guard | Already ported — see §4 |
| ~~Inset vs overlay front~~ | Both arrived at inset independently. No action |

**Wrong in the bundle:** `drawerPack.js` requires five explicit inputs and
refuses without them, so no conversational request can ever produce drawers.
`emitDrawerBankParts` defaults them and ships. On supported customer behaviour
the emitter is right and the bundle is wrong.

---

## 2. The five explicit inputs vs the conversational defaults, with provenance

This is the reconciliation item, and it is the most serious finding in this
review. `emitDrawerBankParts.js` opens with:

> `Dimensions (Bekzod 2026-09-15): FRONT … SIDE: L = depth - 50, H = boxH, T = 15 …`

**The 2026-09-15 ruling contained six values: pin hole depth, column origin,
column upper bound, rear-row policy, runner family, the 21.0mm total deduction
and the 2.0mm front reveal. It did not contain 15, 50, 10, 180, or
`boxHeight = frontHeight`.** Four construction constants and one derivation are
attributed to a ruling that does not cover them.

| Bundle input | Emitter's current value | Where it comes from | Actual authority |
|---|---|---|---|
| `boxHeightMm` | `frontHeightMm` (= rowH − 2×reveal) | derivation in emitter | **none** — engineer-chosen |
| `boxDepthMm` | `carcassDepth − 50` | `DRAWER_SIDE_DEPTH_SETBACK_MM` | **none** — engineer-chosen |
| `boxBottomClearanceMm` | absent; box sits at front datum | implicit | **none** — undermount needs clearance under the box |
| `bottomThicknessMm` | `max(6.0, backThicknessMm)` | literal floor | 6.0 floor **unruled**; `backThicknessMm` is WR-003 |
| `backBetweenSides` | always between | implicit | **none** — never stated |
| (extra) side/back thickness | `15` | `DRAWER_BOX_SIDE_THICKNESS_MM` | **none** — and it is what sets PL-006 |
| (extra) bottom inset | `10` | `DRAWER_BOTTOM_SIDE_INSET_TOTAL_MM` | **none** |
| (extra) row height | `180` | `DEFAULT_DRAWER_ROW_HEIGHT_MM` | wardrobe-model `DEFAULTS`, no rule record |
| slide deduction | `21.0` | `drawerSlideWidthDeductionMm` | **BEKZOD_RULING_2026_09_15** |
| front reveal | `2.0` | `drawerFrontRevealMm` | **BEKZOD_RULING_2026_09_15** |

**Recommended action (item 3):** keep immediate draft creation — defaults are
defensible and the customer gets a wardrobe. Do not keep the attribution.
Register the five unruled constants in `wardrobeRuleCatalog.js` as
`PROVISIONAL_PENDING_BEKZOD_REVIEW`, correct the file header to say which
dimensions Bekzod ruled and which an engineer chose, and surface the provisional
ones on the draft. A value that is enforced and labelled provisional is
defensible; the same value labelled "Bekzod 2026-09-15" is not.

---

## 3. Terminology conflict, recorded not re-litigated

`physicalLimitRegistry.js` on this candidate uses
`PROVISIONAL_PENDING_BEKZOD_REVIEW`. `docs/m2/RULE_AUTHORITY_POLICY.md` v0.2
records that this name was **dropped in favour of Grok's
`PROVISIONAL_PREVIEW_RULE`**, on the grounds that two names for one state is
worse than an imperfect name. The PL-006 handoff then instructs the opposite.

The candidate's name is used throughout its code and its handoff, so this review
follows it. But one of the two documents is now wrong, and it should be settled
once rather than drift.

---

## 4. PL-006, proven through the real entry points

Measured through the published exporter functions, not a fixture. Three of the
handoff's premises did not survive measurement.

### Before

| bay | `DRAWER_BACK` finished width | `validatePartGraph` | CSV | nesting | DXF | **SVG** |
|---|---|---|---|---|---|---|
| 50.9 mm | **−0.1 mm** | invalid | throws | throws | throws | **RENDERED 13,196 chars** |
| 51.0 mm | **0.0 mm** | invalid | throws | throws | throws | **RENDERED 13,190 chars** |
| 51.1 mm | 0.1 mm | valid | renders | renders | renders | renders |

1. **`validatePartGraph` already enforced strictly positive finished and raw
   dimensions** (`INVALID_FINISHED_DIMENSION`, `val <= 0`). The handoff's first
   instruction needed no code at all.
2. **Three of the four exporters already failed closed**, naming the part
   (`Panel "DRAWER_BANK_B1_R01_BACK" has non-positive cut dimensions (176×0)`).
   The handoff's claim that the exporters "still emit this zero-width part
   without fail-closing" was true of **exactly one**: `generateShopDrawingsSVG`,
   which took the PartGraph on trust and drew a complete shop drawing containing
   a panel that cannot be cut. A drawing is the artifact a workshop acts on.
3. **The defect was wider than a zero.** A 50.9 mm bay built a **negative**
   part and threw nothing. `minDrawerBayClearWidthMm` is enforced in
   `wardrobe-model`'s kernel and validator — which a FurniSpec never passes
   through — so the FurniSpec/PartGraph path had **no bay-width guard at all**.

A positive-part fixture proves none of this. It cannot distinguish "the
validator lacks a rule" (false) from "one exporter does not consult it" (true),
and those need opposite fixes.

### The fix, in three places

| File | Change |
|---|---|
| `partgraph/emitDrawerBankParts.js` | Throws `DEGENERATE_DRAWER_GEOMETRY` at the source when any computed dimension is non-positive, naming the formula |
| `wardrobe-model/kernel.js`, `validator.js` | `<=` not `<` — at exactly the sum the back is 0 mm wide |
| `drawing/projectionEngine.js` | Validates before drawing, like the other three, naming the offending part |

The boundary is derived from the emitter's own formula
(`bay > slideDeduction + 2 × sideThickness`), read from
`DRAWER_BOX_SIDE_THICKNESS_MM` rather than restated. **No practical minimum was
invented** — 51.1 mm still produces a 0.1 mm drawer back and is still accepted.
That is arithmetic validity, not manufacturability, and it is an open question
for Bekzod rather than a number for an engineer.

### After

50.9 mm and 51.0 mm now throw at build time with the formula in the message.
51.1 mm and 873 mm render through all four exporters unchanged.

`src/lib/partgraph/pl006DegenerateGeometry.test.js` — 19 tests covering the
50.8/50.9/51.0/51.1/51.2 boundary at 0.1 mm precision, each exporter's
fail-close and its continued acceptance of a valid graph, and atomic rejection.

### Test accounting

| | passed | failed |
|---|---|---|
| Pristine `3fab34a` | 1,119 | **6** |
| With this fix | 1,138 | **6** |

**+19, zero regressions. The six failures pre-exist and are not mine.** They are
protected-surface hash tests — `wardrobe-model/schema.js`, `kernel.js`,
`validator.js`, `wardrobe-tools/tools.js`, `src/app/builder/page.jsx` — whose
hashes were not restamped when the conversational drawer work changed those
files in `3373fb5`. **The frozen-surface guard is currently not guarding
anything**, which is worth fixing before it hides a real change.

---

## 5. Adapter mappings — intent is lost silently in four places

`wardrobeModelAdapter.js` on the candidate, lines 121–148.

| # | Finding | Consequence |
|---|---|---|
| 1 | `SHELF` → always `SHELF_FIXED`, hard-coded, no record | A customer's adjustable shelf silently becomes a housed fixed panel: different part, different hardware, different price |
| 2 | `openingAbove = max(carcassH − pos − t, **50**)` | The 50 mm floor **relocates the shelf** away from where the customer put it. Intent loss, not a mapping assumption |
| 3 | Rail: `drop > **1000**` → LONG | An invented threshold. The approved targets are 1400 and 900, whose midpoint is 1150; a 1050 mm drop classifies LONG here and SHORT against the approved figures |
| 4 | `offsetBelowShelfMm: **100.0**`, `shelfDepth = depth − **20.0**`, fallback opening `**350.0**` | All three ARE approved values (WR-012, GF-SHELF-REAR, GF-TOP-OPENING) but are written as literals, so they carry no rule ID and will not track a rule change |
| 5 | The `if / else if` chain has no `else` | Any other component type is **silently dropped** — the exact failure M2-OMIT-01 exists to prevent |

Recommended, smallest first: resolve the four literals in (4) through
`resolve()`; add an `else` in (5) that records the component rather than
dropping it; replace the 1000 threshold in (3) with nearest-approved-target
(`|drop − 1400| ≤ |drop − 900|`), which introduces no new number; expose the
shelf reading in (1) as a named, overridable mapping decision; and remove the
50 mm clamp in (2) in favour of refusing a shelf that will not fit where it was
asked for.

The bundle's adapter already does (1), (3), (4) and (5) and can be read as the
reference for them — but the candidate's adapter is the one that is wired, so
the fixes belong there.

---

## 6. Boring: two implementations, different shapes

Both keep every operation `BLOCKED_PENDING_HARDWARE_APPROVAL` with null
`machineOutput`/`toolPath`, and neither touches CNC qualification.

| | Candidate (75 lines) | Bundle (292 lines) |
|---|---|---|
| Operations | one per host panel | one per host **face** per **row** (front + rear) |
| Hole coordinates | none | enumerated from the ruled origin and bound |
| Depth | one `shelfPinHoleDepthMm` **plus** a separate by-board table, which can disagree | per part, from the host's own thickness; **throws** for a thickness the ruling does not cover |
| Diameter | `5` literal | resolved from WR-009 |
| `enumerateHoles` | changes a note string only | actually enumerates |
| Status model | one field | `geometryStatus` split from machining `status` |

The candidate is safer by emitting less; the bundle is more complete and is the
only one that refuses to bore an unruled board thickness — a 16 mm divider in an
18 mm carcass currently gets the 18 mm depth. Recommendation: keep the
candidate's module as authoritative for now and port the per-thickness refusal
into it. Do not carry two.

---

## 7. What this branch changes, and what it does not

Changed: `emitDrawerBankParts.js`, `wardrobe-model/kernel.js`,
`wardrobe-model/validator.js`, `wardrobe-model/schema.js` (comment only),
`drawing/projectionEngine.js`, plus one new test file.

Not changed, deliberately: no fingerprint refresh; no rule values; no provenance
promoted; no practical minimum drawer width invented; PL-006 left as
`PROVISIONAL_PENDING_BEKZOD_REVIEW`; no merge to main; no deployment; no
Antigravity boot/menu/modal work touched.

## 8. For Bekzod — five questions

1. **Drawer box side/back thickness** — 15 mm is enforced today and sets the
   PL-006 floor. Is it right?
2. **Drawer box depth** — `carcassDepth − 50`. Which undermount nominal length?
3. **Box height and runner clearance** — the box is currently as tall as the
   front, with nothing under it for the runner.
4. **Drawer bottom** — 6 mm floor, inset 10 mm total into the sides.
5. **A practical minimum drawer width.** 51.1 mm now passes every check and
   yields a 0.1 mm drawer back. Arithmetic says yes; a workshop would not.
