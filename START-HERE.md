# FurniAI — START HERE

This is the clean, consolidated **fresh start**: same system, same method, same code
and patterns we built — gathered into one project so you can begin again and try new
things without fighting the old codebase.

See `FurniAI-Project-Description.md` for the current architecture and live-vs-in-development split. This file is the quick map for the Next.js rewrite plan.

## The one idea that fixes "it wouldn't change"

The old site wouldn't change because its models were **hardcoded** — every new design
meant editing code. Here, **a design is data.** New wardrobes, kitchens, anything:
you add a preset to `src/lib/designs.js`. The 3D model, price, cut list, and factory
PDF all follow automatically. The code underneath never changes.

```
edit designs.js  ─→  3D model + price + cut list + factory PDF  (all automatic)
```

So your workflow is: add/tweak presets, see the result, repeat until it's right.
The system stays stable while you iterate.

## What's in here

```
src/lib/
  knowledgeBase.js     catalog: materials, hardware, prices, type defaults (EDIT prices here)
  furnitureConfig.js   config factory, manufacturable defaults, dimension clamping
  buildGeometry.js     PURE: config → 3D parts → cut list            ✓ tested
  configSchema.js      validation gate — sanitizes any AI/preset config
  designs.js           ★ THE GALLERY — add new wardrobes/kitchens here  ✓ tested
  pricing.js           PURE: config → price in AED                    ✓ tested
  production.js        PURE: config + orderId → cut list + CSV (CNC/PDF path)  ✓ tested
  salesAgent.js        conversational quoting (Claude tool-use)
  whatsapp.js          WhatsApp Cloud API helper

src/store/furnitureStore.js          live config + all edit actions
src/components/builder/*.jsx         3D model + left (structure) & right (appearance) panels
src/app/builder/page.jsx             the customize page: left | 3D | right
src/app/api/quote|sales-agent|whatsapp   server routes
```

## Same system, only the options change

When you want to "try new things," you touch **data**, not the engine:

| To change… | Edit… | Code changes? |
|------------|-------|---------------|
| Prices, materials, hardware | `knowledgeBase.js` | No |
| New wardrobe / kitchen / etc. | `designs.js` | No |
| Sizes, defaults per type | `knowledgeBase.js` defaults | No |
| How a piece is built geometrically | `buildGeometry.js` | Yes (rare) |

That separation is the point. The engine (`buildGeometry`, store, panels, pricing,
production) is stable and tested; your creativity lives in the catalogs.

## The pipeline (all deterministic — no CAD, no AI in the build)

```
designs.js preset → customize (panels) → price → pay → freeze config + OrderID
   → production.js → cut list CSV + production PDF (English, mm) → factory / BAZIS
```

No 3ds Max, AutoCAD, SketchUp or 3D-mesh export is required for the current
preview. The intended factory handoff is a versioned **PDF + CSV/neutral
package** with an OrderID for traceability. Exact hardware drilling, drawings,
nesting and CNC remain blocked until factory and machine profiles are validated.

## Run it

You already have `three`, `@react-three/fiber`, `zustand`, and the Anthropic SDK.
Add drei if missing, set your key, and open `/builder`:

```bash
npm install @react-three/drei
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env.local
npm run dev
```

## Verified in this build

- All 7 starter designs validate and produce real cut lists (0 problems).
- Production-preview pack + CSV generate deterministic mm dimensions with
  OrderID traceability and an explicit manufacturing-release block.
- Geometry builder: correct parts, in-bounds, reflows on resize.
- All JavaScript syntax-checked; React/r3f compiles clean.

## Furniture Generation API (FSL v1)

A separate, additive system now exists alongside the pipeline above:
`POST /api/v1/furniture/generate` turns a natural-language furniture idea
into a validated **FSL v1** document (assumptions/warnings/missing-info all
explicit) and, best-effort, a payload for this same `/builder` pipeline via
`configSchema.js`'s existing `validateConfig()` gate. It doesn't replace
anything above — `designs.js`/`buildGeometry.js`/`production.js` are unchanged
and still the only things that actually render or price a piece. See
[docs/furniture-generation-api.md](docs/furniture-generation-api.md) and
[docs/fsl-v1.md](docs/fsl-v1.md) for the full contract, and
`docs/furniai-existing-system-analysis.md` for how this relates to the
separate `/cad-lab` experiment.

## Build order from here (each ships on its own)

1. **Gallery page** — render `designs.js`, click → `loadConfig` → `/builder`.
2. **Variant generator** — expand 8–12 designs into 100–500 via materials/sizes (see note at the bottom of `designs.js`).
3. **AI infer** — `/api/infer`: gallery label → Claude → `validateConfig` → load.
4. **Commerce** — checkout + payment + freeze config on payment.
5. **Production export** — wire `production.js` to a PDF renderer + factory dispatch.
6. **AI vision** — match a specific gallery image more closely.
