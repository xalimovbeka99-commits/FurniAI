# Hanging drop vs. carcass — reproduction, rule, behaviour change

**Commit:** `a2bf3ba` (kernel, validator, pipeline, adapter) · tests
`src/lib/partgraph/hangingDropGeometry.test.js`, `wardrobeModelAdapter.test.js`, browser
test 3 in `tests/browser/studio-save-reopen-staleness.spec.js`.
**Status of the rule:** a geometric identity, not a furniture rule. **Not Bekzod-approved and
not claimed to be** — it introduces no dimension. The decisions it surfaces are listed in §4.

## 1. Reproduced on `55998dd`

`HANGING_RAIL_*.targetClearDropMm` was read by nothing — not the validator, not the
compiler, not the PartGraph validator. Each of these validated, compiled, passed
`validatePartGraph` and could be saved:

| Input | What was built |
|---|---|
| golden, long rail `targetClearDropMm: 5000` (carcass 2300) | the golden wardrobe, claiming a 5 m drop |
| long rail `1797` (geometry gives 1796.0) | same, 0.1 mm short of its claim |
| `"abc"`, `-5`, `1400.05` (below 0.1 mm) | same |
| long rail `offsetBelowShelfMm: 3000` | a rail at Y −98.6 cm, below the floor |
| customer draft **1200 mm** high (default layout) | adjustable shelves at Y −572.0 and −204.0 mm — below the floor — previewed as valid |
| customer draft 1800–2003 mm high | long bay declaring 1400 mm with 1196–1399 mm available; at 1800 a shelf inside the plinth zone |
| `WardrobeModel` rail at 1400 over a shelf at 400 (adapter) | rail compiled 264 mm above the floor, *under* the shelf, declaring a 1400 mm drop |

## 2. The rule (exact, 0.1 mm integer arithmetic)

Datum — already the kernel's for `SHELF_ADJUSTABLE.clearDropAboveMm` and the rulebook's
(`WARDROBE_RULEBOOK_V0.1.md` §E: `1914.0 − 118.0 = 1796.0`):

```
achievable drop = rail centre Y − upper face Y of the highest structural part below the
                  rail in the same bay (carcass bottom panel if none)
```

| Code | When |
|---|---|
| validator `INVALID_DIMENSION` / `UNSUPPORTED_DIMENSION_PRECISION` | `targetClearDropMm` not a positive number at 0.1 mm |
| validator `COMPONENT_OUTSIDE_BAY` | `targetClearDropMm ≥` internal carcass height |
| kernel `HANGING_RAIL_OUTSIDE_BAY` | rail centre not strictly inside the bay clear height |
| kernel `HANGING_RAIL_INTERSECTS_PART` | rail centre strictly inside a shelf/drawer part of the bay |
| kernel `HANGING_DROP_NOT_ACHIEVABLE` | `target > achievable` (equal is accepted: golden short bay is exactly 900.0) |
| kernel `INTERIOR_PART_OUTSIDE_BAY` | any shelf/drawer part below the bottom panel's upper face or above the top panel's lower face |

A rail with no `targetClearDropMm` is not given one; only containment applies. Kernel
refusals carry `details` (component/part id, bay, measured mm, datum). Golden geometry is
byte-identical; no stored graph changes.

Atomicity — one rule, three consumers, nothing half-committed:
- **Design commit** (pipeline): `VALIDATION_FAILED`, `partGraph: null`; an edit returns
  `{ ok: false }` and the caller's committed design is untouched.
- **Save**: `400 INVALID_FURNISPEC`, `details.compileError`, `details.geometry`, no write;
  reopen of such a row (written directly) is `409 REVISION_INTEGRITY_FAILED`.
- **Exports**: they take the committed PartGraph; since the refused design never becomes
  one, export identity stays on the previous design (browser test 3 and
  `export-identity-verifier` 4/4).

The adapter (`wardrobeModelAdapter.js`, not used by the shipped UI) now places the rail at
the model's rod centre (`position + zone/2`), shelves from the floor datum, and declares the
model's real drop; a rail that is not below the component above it is refused, not moved.

## 3. Behaviour change the product will see

With the default layout (long bay + short bay, approved values GF-HANG-LONG 1400.0,
top compartment 350.0, rail offset 100.0, plinth 100.0, 18.0 panels) the long bay has
`height − 604.0` mm available, so **overall heights below 2004.0 mm are now refused**
(2003 → 1399.0 available). Before, they were previewed with a drop the wardrobe did not
have (and below ~1800 mm with shelves outside the carcass).

## 4. For Bekzod — decisions this does not take

1. **Low wardrobes.** Refuse (current), or offer a different layout (e.g. short hanging) when
   the long drop does not fit? The kernel will not choose a layout for the customer.
2. **Datum.** Clear drop is measured from the **rail centre** (rulebook §E). Should it be from
   the tube underside, and should a hanger-hook allowance be deducted? Either would reduce
   every achievable drop by a fixed amount and move the 2004 mm boundary.
3. **Short bay equality.** The golden short bay is exactly 900.0 = target. Is "equal" the
   intended tolerance, or should the target be a minimum with slack?
4. The earlier open item (G5: a 300 mm wardrobe, general minimum plausibility) is unchanged
   — no minimum was introduced here.
