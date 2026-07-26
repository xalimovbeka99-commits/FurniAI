# FurniAI — Project Description

## What it is

FurniAI is a custom-furniture e-commerce platform: a marketing landing page plus a live, in-browser 3D configurator, wired to a quote/factory-dispatch preview flow. A customer picks a design from a catalog, customizes its dimensions/materials/finish in real time on a rotating 3D model, and submits the concept plus an indicative cut list and customer details via WhatsApp or a printable PDF sheet. The current live output is not CNC-ready.

**Live site:** `furnia.vercel.app`

## Current architecture — two codebases, one live

This is the single most important thing to know about the repo: there are **two separate implementations**, and only one is deployed.

### 1. Static site (LIVE, production) — `index.html` / `styles.css` / `app.js`
- Plain HTML/CSS/vanilla JS, no build step, no framework, no npm install required to run it
- **`index.html`** is the entire application: markup, all CSS (inline `<style>` block), and all JavaScript (inline `<script>`), including the DESIGNS catalog, the Three.js builder, and the factory order modal
- **`app.js`** (root-level, ~43KB) is an **orphaned legacy file** — it's still copied into the Vercel build output but `index.html` never references it via a `<script src>` tag. It represents an older version of the builder (has `bSwitch` chips, lacks `kitchen_u`, etc.) and can be considered dead code / a historical artifact, not something to edit
- **`styles.css`** — also present but largely superseded since styles now live inline in `index.html`
- Deployed via `vercel.json` with `framework: null` — the build step is literally `cp index.html styles.css app.js dist/`
- This is the file the user actively edits and the one that must never be broken

### 2. Next.js app (in development, NOT deployed) — `src/`
- React + `@react-three/fiber`/`drei` + Zustand + Tailwind
- Structured properly: `src/app/` (pages + API routes for `quote`, `sales-agent`, `whatsapp/webhook`), `src/components/builder/` (`FurnitureModel.jsx`, `StructurePanel.jsx`, `AppearancePanel.jsx`), `src/lib/` (`buildGeometry.js`, `pricing.js`, `designs.js`, `production.js`, `whatsapp.js`, `salesAgent.js`, `knowledgeBase.js`, `configSchema.js`)
- Represents a more maintainable rewrite — likely the intended long-term direction — but is **not wired into the Vercel deployment**. `vercel.json` intentionally overrides Next.js auto-detection to keep serving the static site instead
- **Do not deploy this without explicit user confirmation** — a prior attempt to switch Vercel to Next.js broke the live production site and had to be reverted

### Furniture Generation API (FSL v1) — new, current direction
Added 2026-07-19, lives inside the Next.js app above (not a third codebase). A
natural-language furniture idea in -> a validated, versioned **FSL v1**
specification out, plus a best-effort mapping onto this same `/builder`
pipeline (`configSchema.js`'s existing validation gate).

- Endpoint: `POST /api/v1/furniture/generate` (`src/app/api/v1/furniture/generate/route.js`)
- Core modules: `src/lib/fsl/`, `src/lib/furniture-knowledge/`, `src/lib/furniture-brain/`, `src/lib/ai-provider/`, `src/lib/configurator-adapter/`, `src/lib/services/`
- Full docs: `docs/fsl-v1.md`, `docs/furniture-generation-api.md`, `docs/adr/ADR-001-fsl-provider-independent-contract.md`
- This is the active direction for AI-driven furniture generation. An
  earlier, separate experiment (`/cad-lab`, a multi-turn tool-based CAD
  engine scoped to one cabinet type) also exists in the repo but is not part
  of the current roadmap — leave it alone, don't build on it.

## What the live static site does

### Landing page
- Hero: rotating 3D oak wardrobe with animated dimension lines
- 4-step "how it works" pipeline
- Gallery grid of furniture cards, each rendering its own live rotating 3D thumbnail
- "Built to spec" section visually previewing the cut-list/production concept
- Materials showcase row
- Hash-based routing: `#/` = landing, `#/build/<id>` = opens that design directly in the configurator

### Catalog (30 designs)
Defined in a `DESIGNS` array (`index.html:514`), each entry is a parametric spec: `{name, type, sections, drawers, shelves, doorType, mat, handle, led, w, h, d, basePrice}`. Types currently supported:

| Type | Count | Description |
|---|---|---|
| `wardrobe` | 6 | Straight wardrobes — glass/solid/mirror/open door variants |
| `walkin_l` | 3 | L-shaped walk-in closets |
| `walkin_u` | 2 | U-shaped walk-in closets |
| `kitchen` / `kitchen_l` / `kitchen_u` / `kitchen_island` | 7 | Linear, L-corner, U-shape, and island kitchens |
| `vanity_freestanding` / `vanity_floating` | 5 | Bathroom vanities, floor-standing or wall-mounted |
| `bookshelf` | 3 | Open-shelf bookcases (newly added) |
| `sideboard` | 3 | TV units / sideboards with a countertop and cabinet legs (newly added) |

6 materials (Oak, Walnut, White MDF, Graphite, Taupe, Cream), 5 handle finishes (gold/black/chrome/push/none), and warm/cool/off LED options — all combinable per design.

### 3D configurator (Three.js r128, CDN, no bundler)
- A `Builder` object dispatches to a per-type method (`buildWardrobe`, `buildWalkinL`, `buildWalkinU`, `buildKitchen`, `buildVanity`, `buildBookshelf`, `buildSideboard`), all sharing a common `wall()` helper that constructs a straight run of cabinetry (plinth, shelves, doors, drawers, LED strip, optional hanger rod)
- Live sliders for width/height/depth (type-specific ranges), section count, drawer count, shelf count, material, handle, LED, door style
- Doors animate open as mirrored left/right pairs; drawers animate on pull; corner cells in L/U layouts stay door-only where a rod/shelf would collide
- Camera framing and slider ranges are tuned per furniture type (e.g., bookshelf defaults to shallow 25–50cm depth; sideboard defaults to low 45–100cm height)

### Factory dispatch flow (recently added — replaces a placeholder `alert()`)
Clicking "Finish & get final price" now opens a full order modal instead of a stub alert:
1. **`generateCutList(cfg)`** — computes an indicative panel schedule (mm, using simplified fixed-thickness assumptions) by furniture type: side panels, top/bottom, back panel (HDF), shelves, dividers, drawer fronts/boxes, doors, plinth, countertop and splashback. It does not include validated joinery, hardware drilling, drawings, nesting, tolerances or a machine profile, so it must not be sent directly to CNC.
2. **`openOrderModal(cfg)`** — renders an order summary (name, type, dimensions, material, door style, price) plus the numbered cut list in a table, and a customer-details form (name, phone, delivery zone)
3. **Dispatch options:**
   - **WhatsApp** — builds a `wa.me/?text=...` deep link (no hardcoded number — opens WhatsApp letting the user pick who to send it to) containing the full spec and cut list, live-updated as the customer fills in their details
   - **Print / Save PDF** — opens a print-formatted version via `window.open()` + `.print()`

## Deployment
- **Host:** Vercel, static framework mode (`framework: null`)
- **Build:** `mkdir -p dist && cp index.html styles.css app.js dist/`
- **Constraint (hard rule, confirmed with user):** never point Vercel at the Next.js app in `src/` without explicit approval — doing so once already took the live site down

## Known rough edges / things a reviewer should flag
- `app.js` at the repo root is dead weight — shipped to production but unreachable; candidate for deletion once confirmed unused, or explicit re-adoption if it's meant to replace inline JS
- Two parallel furniture-building implementations (`index.html` inline JS vs. `src/lib/buildGeometry.js` + `designs.js` in the Next.js app) will drift unless one is retired
- No automated tests for the static site or the pre-existing Next.js `builder`/`designs`/`pricing` code. The new Furniture Generation API (FSL v1) added Vitest and has real test coverage (`npm test`) — see `docs/furniture-generation-api.md`.
- Pricing (`basePrice` per design) is indicative/static, not derived from the generated cut list — the cut list is descriptive for manufacturing, not yet fed back into price calculation
- Stray diff/scratch files at repo root (`full_diff.txt`, `full_diff_utf8.txt`, `page_diff.txt`, `page_diff_utf8.txt`) appear to be leftover working files, not part of the app
