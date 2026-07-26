# Construction Standards — Pilot Research

Real furniture-engineering standards, checked against what the live site
already encodes in `src/lib/production.js` and `src/lib/buildGeometry.js`.

## The 32mm cabinetmaking system

Source: [Wikipedia](https://en.wikipedia.org/wiki/32_mm_cabinetmaking_system),
[euro32products.com manual](https://euro32products.com/wp-content/uploads/2020/04/CondensedEuro32Manual.pdf).

- Hole spacing: 32mm between centers, in columns.
- Hole diameter: 5mm, depth 12–14mm.
- First row set back 37mm from the front edge (rear row can mirror this from
  the rear edge, so a machine doesn't need retooling between front/rear rows).
- Shelf pins: 15–16mm long, ~7mm flange diameter.
- Origin: gear-size constraint on post-WWII line-boring machines, not a formal
  standard body — but de facto universal (IKEA and most frameless/euro-style
  factories use it).

**Cross-check against the live site**: `production.js:72` already says
`"shelf-pin holes Ø5mm, 32mm system"` — the live site is already 32mm-system
correct on hole diameter and grid spacing. Not currently encoded: the 37mm
front-edge setback (front/rear row reference distance) or the 15–16mm pin
length — neither is currently load-bearing for anything the factory pack
outputs today, but both are real, correct values if a more detailed drilling
diagram is ever needed.

## Carcass joinery methods (from cabinet-mcp's `joinery.md`)

| Method | How it's dimensioned | Equipment needed | Notes |
|---|---|---|---|
| Dado & rabbet | Pre-modelled, derived from stock thickness | Standard tooling | Default/most predictable |
| Floating tenon (Domino) | 10 standard Festool Domino sizes, 4×17mm–14×56mm | Domino DF 500/700 | Professional-grade |
| Pocket screw | Kreg-style geometry, auto-positioned | Pocket-hole jig | Fast, hidden fasteners |
| Biscuit | 3 sizes (#0, #10, #20) | Biscuit jointer | Alignment aid, not primary structure |
| Dowel | 8mm or 10mm, compatible with the 32mm grid | Dowel jig or grid drilling | Most accessible, most repeatable |

**Cross-check against the live site**: `production.js:75` currently specifies
one fixed method for every design — `"confirmat Ø4.5mm pilot holes... back
panel groove 6mm × 10mm, 12mm from rear edge"` (confirmat screw joinery, a
6th real method not in cabinet-mcp's list but equally standard in RTA/euro
cabinetry). This is a **deliberate single-method choice**, not a gap — the
factory presumably already tools for confirmat only. Worth knowing that if
Furni AI ever supports a "which joinery method" customer/factory choice, these
5 are the real, standard alternatives with real feasibility conditions (e.g.
dowel needs true-thickness stock; Domino needs specific machinery) rather than
something to invent from scratch.

## Drawer corner joints (from cabinet-mcp's `joinery.md`)

| Method | Dimensioning | Notes |
|---|---|---|
| Butt joint | None — glue + fastener | Simplest, universal |
| QQQ system | All 3 params = half stock thickness | "Stronger than a dovetail in shear," no jig |
| Half-lap | Depth = half stock thickness | Basic rabbet capability only |
| Drawer lock | Router-bit-computed L-tongue/socket | Most complex, mechanical interlock |

**Cross-check against the live site**: `production.js` doesn't currently
distinguish drawer-box corner joinery at all — drawer fronts are treated as a
finish/edge-banding concern only (`finishFor("drawerFront")` at
`production.js:22-24`), with no drawer-box (sides/back) construction modeled.
This is consistent with the live site's stated scope (front-facing
configurator + cutlist, not full drawer-box engineering) — noted as a real gap
only if Furni AI's scope ever grows to include full drawer-box parts in the
cutlist, not something to fix now.
