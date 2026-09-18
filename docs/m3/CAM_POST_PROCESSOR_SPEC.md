# M3 — CAM post-processor architecture and qualification spec

**Status:** SPECIFICATION ONLY. Nothing here qualifies anything.
**Written against:** `c46ba83` (audited) and `3fab34a` (current integration lead).
**CNC remains NOT QUALIFIED. Hardware drilling remains BLOCKED.**

This document defines what would have to be true before FurniAI emits a file a
machine can run. It does not lift a single gate, and it deliberately specifies
verification procedure rather than file syntax: a post-processor written from
documentation alone is a guess, and the only authority on a controller's dialect
is a file that controller exported.

---

## 1. Where the line sits today, and what actually moves it

Three interlocking gates exist in code. This is worth stating precisely because
the M3 work is *not* "write an emitter" — the emitter is the easy part.

| Gate | Where | Current value |
|---|---|---|
| `qualificationStatus` | every PartGraph | `WORKSHOP_REVIEW_NOT_CNC_QUALIFIED` |
| `machiningPolicy.drilling` | every FurniSpec | `BLOCKED_PENDING_HARDWARE_APPROVAL` |
| operation `status` | every boring operation | `BLOCKED_PENDING_HARDWARE_APPROVAL` |

Two existing interlocks are load-bearing and must survive M3 unchanged in
character:

- `validatePartGraph` raises `CNC_QUALIFIED_FORBIDDEN` if a graph ever claims
  `CNC_QUALIFIED`. Today that makes the status unreachable by construction.
- `dxfCompiler.isSystem32DrillingApproved()` requires **both** an explicit
  caller flag **and** `qualificationStatus === "CNC_QUALIFIED"`. Neither alone
  opens the drill layer.

That is a good design and M3 should not replace it. What M3 adds is a third key:
a **machine profile** that is absent by default, so that even a qualified graph
with an explicit flag emits nothing until a specific, signed machine profile is
supplied. Three keys, none of which an agent can turn.

### The transition, as a sequence rather than a switch

```
WORKSHOP_REVIEW_NOT_CNC_QUALIFIED          today
  -> M3.1  neutral operation model complete and audited
  -> M3.2  post-processor emits files; every file marked DRY_RUN
  -> M3.3  first-article cut on scrap, measured, signed
  -> M3.4  machine profile signed and registered
  -> CNC_QUALIFIED_FOR <machineProfileId>   never globally
```

**`CNC_QUALIFIED` must never become a global boolean.** Qualification is per
machine, per material, per tool set. A graph qualified for a Homag with a 5 mm
drill in spindle 3 is not qualified for the Biesse next to it. The status field
should therefore carry the profile it was qualified against, and
`validatePartGraph` should keep rejecting the bare `CNC_QUALIFIED` string
forever.

---

## 2. The neutral operation model

FurniAI already has the right shape: `partGraph.operations[]` with `id`,
`hostPartId`, `type`, `face`, `vector`, geometry and `status`. M3 formalises it
as the single thing post-processors consume, so that adding a controller never
touches the kernel.

```
FurniSpec -> PartGraph -> operations[] (neutral, part-local, dmm)
                              |
              +---------------+---------------+
              |               |               |
          G-code post     MPR post        CIX post
```

**Rules for the neutral layer:**

1. **Part-local coordinates only.** Origin at the panel's lower-left on its
   reference face, X along `finished.lengthDmm`. A post-processor converts to
   machine coordinates; the kernel never knows about a table, a datum pin or a
   spindle.
2. **Integer deci-millimetre throughout**, as everywhere else in the kernel. A
   post-processor may round to its controller's precision **on output only**,
   and must record the rounding it applied.
3. **Face is symbolic**, not signed: `FACE_5` / `FACE_6` style naming belongs to
   the post-processor, not the kernel. The kernel says "inner face of the left
   side panel"; the post decides that is face 5 on this machine.
4. **Every operation names its tool by intent, never by number.** `SHELF_PIN_5MM`
   is kernel vocabulary; `T12` is machine vocabulary. The mapping lives in the
   machine profile.
5. **No operation is emitted without `sourceRuleIds`.** An operation that cannot
   name the rule that produced it cannot be cut.

**Operation types M3 must cover**, all of which the kernel can already describe
or nearly so: `BACK_GROOVE` (exists, APPROVED), `SHELF_PIN_LINE_BORING`
(exists, BLOCKED), `HINGE_CUP` (WR-010 semantic, no geometry yet),
`CONFIRMAT_PILOT` and `DOWEL` (GF-JOINERY semantic, no geometry yet),
`DRAWER_RUNNER_FIXING` (nothing yet — depends on the SKU in section 3).

Three of those five have no approved geometry. That is the real M3 backlog, and
it is a ruling backlog before it is a coding backlog.

---

## 3. Lifting `BLOCKED_PENDING_HARDWARE_APPROVAL` on System 32 boring

WR-009 states the gate in one clause: *"Exact drilling coordinates are
`MACHINING_BLOCKED` pending Bekzod pin SKU sign-off."* So the criteria below are
not an invention; they are what "SKU sign-off" has to mean to be checkable.

### 3.1 The SKU record

A hardware SKU is qualified when a record exists carrying **all** of:

| Field | Why it gates |
|---|---|
| `sku`, `manufacturer`, `productLine` | The thing that was bought, unambiguously |
| `pinDiameterMm`, `pinLengthMm`, `flangeDiameterMm` | Hole diameter and depth derive from these, not from a standard |
| `requiredHoleDiameterMm`, `requiredHoleDepthMm` | The manufacturer's own figures, transcribed |
| `depthToleranceMm` | What the workshop is allowed to miss by |
| `minimumBoardThicknessMm` | Refuses the SKU on board it would break through |
| `datasheetRef` | A document, not a memory |
| `approvedBy`, `approvedOn` | Bekzod, with a date |

`shelfPinHoleDepthByCarcassThicknessMm` (13.0 into 18 mm, 11.5 into 16 mm) is
already ruled and already refuses an unruled thickness. The SKU record must
either **agree** with those figures or supersede them by a new ruling. It must
never silently disagree: a test should fail when the SKU's
`requiredHoleDepthMm` and the ruled depth differ for the same board.

### 3.2 First-article physical verification

A SKU record alone is paperwork. Qualification also requires, per machine:

1. Bore a scrap panel of each qualified board thickness with the exact program
   the post-processor emitted — not a hand-typed equivalent.
2. Measure, on at least 5 holes spanning the column: hole diameter, hole depth,
   pitch between adjacent centres, and setback from the front edge.
3. Every measurement inside `depthToleranceMm` and the pitch within +/- 0.2 mm
   cumulative over the column, or the run fails.
4. Insert the actual pins. A shelf must sit without rock across all four
   supports.
5. Photograph the panel with the measurements visible; attach to the SKU record.

**Nothing in this repository can perform step 1 through 4.** They are workshop
acts, and no test suite, screenshot or scope document substitutes for them. This
is the point at which FurniAI's evidence classes A through D stop and class E
begins.

### 3.3 What lifting the gate actually changes

On sign-off, and only for the qualified (SKU, machine, board thickness) triple:

- the SKU record's `approvedOn` populates,
- `PL-00x` provisional entries covering pin geometry can move from
  `PROVISIONAL_PENDING_BEKZOD_REVIEW` to a ruled class with a rule ID,
- boring operations for that triple may carry
  `status: APPROVED_FOR <machineProfileId>`,
- operations for any other triple stay blocked.

It does **not** make drilling generally approved, and it does not touch hinge,
dowel or runner operations, which have their own SKUs and their own first
articles.

---

## 4. Multi-material nesting

### 4.1 The current defect, measured

`compileNestingManifest` calls `buildCutListRows(partGraph)`, expands every row
into one flat `items` array, and packs that array onto one stock sheet type.
**It does not group by material or thickness at any point.** On a wardrobe with
drawers that means an 18 mm melamine carcass panel, a 6 mm HDF back and a 15 mm
drawer side are nested onto the same sheet and reported as one yield figure.

The manifest is therefore not a cutting plan. It is an area estimate wearing a
cutting plan's clothes, and its yield percentage is meaningless the moment a
design contains more than one board.

### 4.2 The rule

**A nesting run is keyed by the tuple `(materialCode, thicknessMm)`, and parts
from different tuples never share a sheet.** `materialCode` alone is not enough:
the same code at two thicknesses is two different products on two different
pallets.

For the current part set that yields three runs:

| Run key | Parts | Typical stock |
|---|---|---|
| `MEL_WHITE_18 / 18.0` | carcass, shelves, dividers, doors, drawer fronts, plinth | 2440x1220 or 2800x2070 |
| `HDF_WHITE_6 / 6.0` | back panels, drawer bottoms | back-panel stock, usually a different sheet size |
| `BIRCH_PLY_15 / 15.0` | drawer sides and backs | ply stock, usually not the same supplier |

Note the drawer bottom: at `bottomThicknessMm = max(6.0, backThicknessMm)` it
lands in the 6 mm run, which is correct, but its **material code is currently
`matCarcass`** in `emitDrawerBankParts` — an 18 mm melamine code on a 6 mm part.
That mismatch must be fixed before grouping is switched on, or the bottom will
be nested onto 18 mm stock. **Grouping will expose this, not cause it.**

### 4.3 Per-run rules

Each run is packed independently and reported independently:

1. **Grain.** Grain policy is per run. A run whose material has no grain
   (melamine faced board, HDF) may rotate freely; a run on a grained material
   (birch ply, veneer) obeys the existing `GRAIN_DIRECTIONS` constraint and must
   not silently rotate to improve yield.
2. **Kerf and trim** are per run: a 6 mm back on a beam saw and 18 mm carcass on
   the same saw may share a kerf, but ply on a CNC router does not. Kerf must be
   a property of the run, not a global default.
3. **Stock selection** is per run. Choosing one sheet size for the whole job is
   the current behaviour and is wrong; each run selects from the stock list
   available for its own material.
4. **Yield is reported per run and never aggregated into a single number.** A
   combined figure hides the run that is wasting material.
5. **A part whose `materialCode` is absent or does not resolve to a known
   material fails the run closed.** It must not fall into a default bucket.
6. **Offcuts stay inside their run.** A usable offcut of 18 mm melamine is not
   stock for the 6 mm run.

### 4.4 Output shape

`compileNestingManifest` should return runs rather than one pack:

```
{
  runs: [
    { key: { materialCode, thicknessMm }, stock, sheetCount, yieldPct,
      grainPolicy, kerfMm, placements[], unplaced[] },
    ...
  ],
  unroutedParts: [],     // parts with no resolvable material - must be empty
  totals: { sheetCountByRun }   // never a single blended yield
}
```

This is a breaking change to the manifest contract and should land with the
exporters and the print view updated together, not ahead of them.

---

## 5. Post-processor targets

One emitter per controller, all consuming the neutral model, none permitted to
read a FurniSpec or a rule.

| Target | Extension | Confidence |
|---|---|---|
| Generic 3-axis G-code | `.nc` / `.tap` | High on structure, low on any specific machine's preamble and tool-change convention |
| Homag WoodWOP | `.mpr` | Known to be a structured ASCII part-program format. **Exact block syntax must be taken from a file WoodWOP itself exported, not from this document** |
| Biesse BiesseWorks | `.cix` | Same position. Structure must be confirmed against a machine-exported file |

I am not going to write dialect details from memory into a specification that
someone might implement against. The honest procedure is:

1. Export a known-good part program from the target software for a panel whose
   geometry FurniAI can also describe.
2. Round-trip it: parse that file, regenerate it from the neutral model, and
   diff. The post-processor is correct when the diff is empty or explained.
3. Only then cut anything.

**Every emitted file carries a header comment** with `specId`, `revision`, the
canonical `fs256:` fingerprint, the machine profile id, and — until section 3.2
is complete for that machine — the literal token `DRY_RUN_NOT_QUALIFIED`. A file
without that header is not a FurniAI output.

---

## 6. Acceptance gates for M3

No gate may be closed by a test suite alone.

| Gate | Closed by |
|---|---|
| M3.1 neutral model | Every operation type carries geometry traceable to a rule ID; no operation lacks `sourceRuleIds` |
| M3.2 emitters | Round-trip diff empty against a machine-exported reference file, per controller |
| M3.3 first article | Section 3.2, per machine, per board thickness, photographed and signed |
| M3.4 profile | A signed machine profile exists and is registered; absent profile emits nothing |
| Nesting | Runs grouped per section 4; `unroutedParts` empty on every fixture; the drawer-bottom material code corrected |

---

## 7. Open questions for Bekzod

1. **Pin SKU**, still. It has gated WR-009 since the rulebook was written and is
   the single item blocking System 32 boring.
2. **Hinge SKU** — WR-010 is semantic only; cup diameter and depth are stated but
   no product is named, so no cup can be bored.
3. **Joinery SKU** — GF-JOINERY names `CONFIRMAT_AND_DOWEL` as a family. Pilot
   diameters and depths are unstated.
4. **Drawer runner SKU** — `UNDERMOUNT_CONCEALED_21MM` is a family, not a
   product. Fixing positions cannot be derived from a family name.
5. **Which machines**, specifically. A post-processor target list of three is a
   guess until the actual controllers are named.
6. **Stock sheet list per material**, including which sheet sizes are actually
   bought for 6 mm backer and for ply.

Items 1 through 4 are all the same shape: a family or a semantic type is
approved and a product is not. Every one of them blocks a machining operation,
and none of them is an engineering decision.
