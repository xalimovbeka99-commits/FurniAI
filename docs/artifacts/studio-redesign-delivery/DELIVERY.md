# Studio Interface Redesign & Backend Persistence — Delivery Package

**Audience:** Bekzod (Founder & Lead Architect), CraZy / Grok (Systems Architect & Integration Lead), Grok's Designs & Website Engineers  
**Role:** FurniAI Design Lead and Studio Frontend Engineer  
**Scope:** Studio redesign finalization, visual design system tokens, live editor integration with Claude's `/api/designs*` backend contract, Grok's shared `designsApiClient`, authenticated persistence lifecycle, unsaved-change protection, and mobile 390px responsiveness.  
**Invariants Respected:** 3D geometry authority unchanged, Three.js r128 renderer preserved, Golden Wardrobe calculations untouched, production deploy contracts preserved (`vercel.json` legacy target intact, no direct production deploy).

---

## 1. Executive Summary & Verification Evidence

All unit tests, validator tests, golden wardrobe demos, and Playwright browser suites pass with zero regressions:
- **Unit & validator test suite:** 1,315 passed, 21 validator tests passed (`npm test`).
- **Golden wardrobe kernel demos:** G2.1, G2.2, and G2.2-R1 parametric all pass with 0 mm drift (`npm run demo:golden-wardrobe`, `npm run demo:golden-partgraph`, `npm run demo:parametric-partgraph`).
- **Browser state protection & session guard suite:** 5/5 passed (`tests/browser/design-state-protection.spec.js`).
- **Studio redesign & persistence suite:** 3/3 passed (`tests/browser/studio-redesign-persistence.spec.js`).

---

## 2. Visual System & Token System Handoff (For Grok's Website Engineer)

A unified design tokens module is established in [`src/styles/design-tokens.css`](../../../src/styles/design-tokens.css):

### Color Palette (Warm Mediterranean Architectural Paper & Modern Cyan)
| Token | Value | Role |
|---|---|---|
| `--paper` | `#FAF9F5` | Primary warm background |
| `--paper-2` | `#F4F2EB` | Container / panel background |
| `--paper-3` | `#EAE5D9` | Hover / active container |
| `--ink` | `#1C1E21` | Deep charcoal primary typography and solid buttons |
| `--ink-soft` | `#5C626E` | Secondary typography, units, origins annotations |
| `--brass` | `#00B4D8` | FurniAI Cyan / primary interactive accent |
| `--brass-bright` | `#00D2F4` | Glowing interactive accent / highlight |
| `--walnut` | `#C5A880` | Natural architectural wood tone |
| `--line` | `#DFD9CC` | Structured borders, table dividers |
| `--line-soft` | `#EDE8DC` | Subtle dividers |

### Status Badges
| Status | Badge Background | Badge Text | Border | Indicator | Label |
|---|---|---|---|---|---|
| `saved` | `#f0fdf4` | `#15803d` | `#bbf7d0` | `✓` | `Saved (Rev X)` |
| `unsaved` | `#fffbeb` | `#b45309` | `#fde68a` | `●` | `Draft (unsaved)` / `Unsaved changes` |
| `saving` | `#eff6ff` | `#1d4ed8` | `#bfdbfe` | `⏳` | `Saving…` |
| `conflict` | `#fef2f2` | `#b91c1c` | `#fecaca` | `⚠️` | `Revision conflict` |
| `error` | `#fef2f2` | `#b91c1c` | `#fecaca` | `✕` | `Save failed` |

### Typography & Spacing
- **Sans:** `'Inter', system-ui, -apple-system, sans-serif` (body, tables, values)
- **Serif:** `'Fraunces', serif` (brand, editorial headings)
- **Mono:** `'Space Mono', monospace` (technical specs, revision counters, dimensions, origin tags)
- **Border Radii:** `--r: 14px` (panels, cards), `--r-sm: 8px` (inputs, buttons), `--r-pill: 100px` (primary CTAs)
- **Spacing Scale:** 4px, 8px, 14px, 20px, 28px, 40px

---

## 3. Retained Changes & Handoff for CraZy and Grok's Teams

### A. Reusable Designs API Client (Handoff to Grok's Designs Engineer)
Located at [`src/lib/persistence/designsApiClient.js`](../../../src/lib/persistence/designsApiClient.js) and tested in [`src/lib/persistence/designsApiClient.test.js`](../../../src/lib/persistence/designsApiClient.test.js):
- **Universal compatibility:** Exported as an ES Module for Node / Next.js / Vitest and bundled as an IIFE global (`window.DesignsApiClient`) via `scripts/build-static.mjs` for the browser.
- **Fail-closed error mapping:** Full error mapping (`mapDesignsApiError`, `DesignsApiError`) covering all server codes from Claude's contract (`MISSING_AUTH`, `MISSING_DESIGN`, `STALE_REVISION`, `CONFLICT_REVISION`, `FINGERPRINT_MISMATCH`, etc.).
- **Reusable methods:**
  - `createDesign({ name, token, designId })` -> `POST /api/designs`
  - `saveAcceptedRevision({ designId, revision, expectedPreviousRevision, furniSpec, partGraph, origins, fingerprint, token })` -> `POST /api/designs/:id/revisions`
  - `getRevision({ designId, revision, token })` -> `GET /api/designs/:id/revisions/:rev`
  - `listDesigns({ token })` -> `GET /api/designs` (Ready for Grok's "My Designs" / Projects dashboard!)
  - `getDesign({ designId, token })` -> `GET /api/designs/:id`

### B. Studio Active Editor Integration & Layout Ownership (Retained by Studio Frontend)
1. **Clean Workspace & 3D Prominence:**
   - 3D canvas is the central hero element (`#bld3d`).
   - Obsolete floating drawers (`.ai-fab`, `.ai-drawer`), upload camera triggers, catalog arrow cycling (`◀ 1/10 ▶`), and duplicate `Design with AI` buttons are cleanly hidden when in active AI Studio mode via `#view-builder.ai-wardrobe-mode-active`.
2. **Single Conversational Flow:**
   - One conversational refinement input (`#aiConversationalInput`) with immediate send (`#aiConversationalSendBtn`) and quick refine chips ("Make it 2000 mm wide", "Add shelf on left", "Walnut finish").
3. **Logically Grouped Specification & Origins:**
   - Table grouped under clear architectural headers:
     - *Dimensions & Envelope*: Width, Height, Depth, Plinth.
     - *Layout & Finish*: Bays, Doors, Finish, Interior.
     - *Technical Diagnostics*: Proposal ID, Revision, Fingerprint.
   - Origin badges explicitly denote `[Customer]` vs `[Defaulted]` for each property.
4. **Drawings Actions:**
   - Unified "⚡ Manufacturing & Blueprints" dropdown in Studio top navigation.
   - `📐 Shop Blueprints (SVG)` downloads vector drawings.
   - `🖨️ Print drawings` accurately describes the print window / browser print preview action.
5. **Persistence, Reopen & Unsaved-Change Protection:**
   - `setSaveStatus(state, msg)` manages the live status badge.
   - **Show Saved only after confirmed persistence:** Initial drafts and unpersisted edits start as `status-unsaved` (`Draft (unsaved)` / `Unsaved changes`).
   - `persistAcceptedRevision(opts)` invokes `DesignsApiClient` with safe server-assigned ID capture and idempotent replay handling.
   - `reopenDesignFromApi(designId, revision, token)` safely restores the full FurniSpec and PartGraph, rotates the session identity (`rotateStudioSession()`), and resets the change sequence so delayed answers from prior sessions are discarded.
   - `hasUnsavedStudioChanges()` and `window.addEventListener('beforeunload', ...)` protect customer work from accidental page closure.
6. **Mobile 390px Viewport Optimization:**
   - Dedicated mobile tab switcher (`#tab-left` = "Design & AI", `#tab-right` = "Specs & Actions").
   - Max panel height capped with safe-area insets (`env(safe-area-inset-bottom)`) so the 3D model remains visible.
   - Full keyboard accessibility and input usability under 480px simulated virtual keyboard viewports.

---

## 4. Visual Selection Screenshots for Bekzod

The following screenshots capture the verified Studio redesign:

| Screenshot | Description | Path |
|---|---|---|
| **Desktop Studio Redesign** | Full workspace showing 3D model, grouped specs table, conversational input, drawings dropdown, and save status | `docs/artifacts/studio-redesign-delivery/desktop-studio-redesign-verified.png` |
| **Mobile 390px Studio** | Ergonomic mobile layout with contextual tabs ("Design & AI" / "Specs & Actions") and accessible controls | `docs/artifacts/studio-redesign-delivery/mobile-390px-studio-verified.png` |
| **Mobile Keyboard Reduced** | Virtual keyboard viewport simulation (390×480) with visible conversation and canvas | `docs/artifacts/studio-redesign-delivery/mobile-390px-keyboard-reduced-verified.png` |
| **Persistence Lifecycle** | Live save status progression (Draft -> Saving -> Saved Rev 1 -> Rev 2 -> Undo -> Reopen) | `docs/artifacts/studio-redesign-delivery/persistence-lifecycle-verified.png` |

---

## 5. Verification Command Summary

```bash
# 1. Run unit and validator tests
npm test

# 2. Run golden wardrobe kernel demos (authoritative gate checks)
npm run demo:golden-wardrobe
npm run demo:golden-partgraph
npm run demo:parametric-partgraph

# 3. Build static assets (including designs-api-client.js bundle)
npm run build:legacy

# 4. Run browser state protection & session guard tests
npx playwright test tests/browser/design-state-protection.spec.js

# 5. Run Studio redesign & persistence browser tests
npx playwright test tests/browser/studio-redesign-persistence.spec.js
```
