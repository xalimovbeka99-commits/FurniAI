# Hardware Specifications — Pilot Research

## The gap this confirms

Direct search for an open hardware database/API (hinge, drawer slide, pull
specs as structured data) found **none** — only vendor product-catalog pages
(Richelieu, Hardware Resources, DTC, Blum distributors), none offering a
free structured feed. The closest thing to a real structured hardware
knowledge base found anywhere in this research is **cabinet-mcp's own
hand-curated `docs/hardware.md`/`docs/pulls.md`** — i.e. even the best
open-source project in this space had to build this data by hand, same as
Furni AI would. This is a genuine opportunity: a well-curated hardware
knowledge base is not something Furni AI can just import, but it's also not
uniquely hard — it just has to be typed in once, correctly.

## Real specs found (via cabinet-mcp's curated data)

**Drawer slides** — 7 real models spanning two mount types:

| Type | Models | Load rating |
|---|---|---|
| Undermount | Blum Tandem 550H / Plus 563H, Blum Movento 760H/769, Salice Futura, Salice Progressa+ | 30–77 kg |
| Side-mount | Accuride 3832 | 45 kg |

Extension: only the 550H is partial-extension; the rest are full-extension.

**Blum Clip Top hinges** — 7 variants across 3 overlay depths:
- Full overlay (16mm): standard + soft-close, 110°/170°
- Half overlay (9.5mm): standard + soft-close, 110°
- Inset (0mm): standard + soft-close, 110°
- All use a 35mm cup, 13mm deep, 22.5mm in from the door edge
- Placement algorithm: hinges start 100mm from the top/bottom door edge, with
  an extra hinge added at 1200mm and again at 1800mm of door height

**Legs**: Richelieu Contemporary Square (100mm, 50kg), Richelieu Adjustable
(40–65mm, M8 thread, 60kg), Hairpin (200mm, 30kg).

**Pulls/knobs**: 45 catalog entries across Top Knobs, Rockler, Richelieu,
Hafele, IKEA, with pack-quantity math (i.e. "you need N pulls, they come in
packs of M, order ⌈N/M⌉ packs") — the specific per-SKU numbers weren't
extractable from the overview doc, but the *pattern* (pack-size-aware
ordering math) is worth adopting regardless of which SKUs Furni AI stocks.

## Cross-check against the live site

`src/lib/knowledgeBase.js:39-45` currently models hardware as **flat per-unit
pricing only**, with no model differentiation:

```js
export const HARDWARE = {
  hinge:        { label: "Soft-close hinge (Blum-style)", unitCost: 12 },
  drawerSlide:  { label: "Full-extension drawer slide",   unitCost: 28 },
  hangerRod:    { label: "Aluminium hanger rod",          unitCost: 35 },
  confirmatSet: { label: "Confirmat screw set (per m²)",  unitCost: 6 },
  legSet:       { label: "Adjustable leg (each)",         unitCost: 9 },
};
```

`production.js:65-66` computes hinge **count** from door height (`H > 1800 →
5, H > 1200 → 4, else 3`) — this is actually consistent in spirit with Blum's
real placement algorithm above (more hinges as height crosses 1200mm/1800mm
thresholds), just expressed as a lookup table rather than derived from an
edge-distance rule. **This is a validated formula, not a bug** — it's a
reasonable simplification of the real algorithm, matching real-world hinge
count conventions.

What's genuinely missing, if this is ever prioritized: **load-based slide
selection** (today every drawer gets the same flat `drawerSlide` price/model
regardless of drawer width/depth/expected load — a 1.2m-wide drawer and a
300mm drawer get identical hardware) and **pull pack-quantity math** (today
`HANDLE_STYLES` is priced per-handle with no pack/order-quantity concept).
Both map directly to the **Hardware Recommendation & BOM** skill proposal in
[../ai-skills/proposed-skills.md](../ai-skills/proposed-skills.md).
