# FURNIAI FUTURE MASTER PLAN

## Product decision

The product name remains **FurniAI**. The authoritative product is the static HTML/CSS/JavaScript website and vanilla Three.js r128 Builder at `index.html` and `#/build/<index>`.

Preserve the landing page, gallery, 30 designs, `#bld3d` viewer, camera, lighting, materials, controls, deterministic construction, WebGL recovery, and failure states. Do not deploy the separate Next.js/React Three Fiber application under `src/app`, and do not create another Builder.

## Architecture

```text
FurniAI website
  -> hash router
  -> gallery/design selection
  -> Builder.cfg
  -> validation and deterministic construction
  -> Three.js r128
  -> WebGLRenderer
  -> #bld3d
```

Future AI pipeline:

```text
User language
  -> isolated AI provider
  -> structured command
  -> schema and furniture-rule validation
  -> approved Builder action
  -> Builder.cfg
  -> deterministic reconstruction
  -> existing viewer
```

AI never owns trusted geometry or executes arbitrary JavaScript, shell commands, filesystem operations, or unvalidated Builder methods.

## Milestones

### F0 — Freeze baseline

Preserve current visuals and behavior, keep Vercel on the static build, and record verification evidence.

### F1 — Configuration contract

Document and validate `Builder.cfg`: units, dimensions, types, modules, doors, drawers, shelves, materials, and limits. Do not change visible output.

### F2 — One new wardrobe

Add one structured, buildable wardrobe to the gallery and verify its thumbnail, viewer, controls, navigation, and deterministic parts.

### F3 — AI provider boundary

Isolate AI providers from UI and Builder code. Provide ready, unavailable, loading, invalid-response, and error states. Preserve manual use without AI.

### F4 — First controlled command

Support “Make the wardrobe 280 cm wide.” Validate it, update `Builder.cfg`, and verify the visible result.

### F5 — Controlled editing

Add validated height, depth, shelf, drawer, door, and material commands.

### F6 — Projects

Add versioned structured save/open behavior. Store configuration, never Three.js meshes.

### F7 — Catalog expansion

Add wardrobe families incrementally with regression tests.

Only one milestone may be active at a time. Stop, test, report, and request approval before beginning the next milestone.

## Build and release

```powershell
cd "C:\Users\xalim\OneDrive\Documents\FUrniai new"
npm run build:legacy
npm run test:browser
npx vercel --prod --yes
npm run verify:production -- https://furniai-topaz.vercel.app
```

Vercel must use `framework: null`, `npm run build:legacy`, and `dist`. Production must contain `#bld3d`, Three.js r128, real non-blank pixels, and no `/_next/` assets.

## Reusable prompt

> You are the senior engineer for FurniAI. The authoritative product is the preserved static HTML/CSS/JavaScript application and vanilla Three.js r128 Builder at `index.html` and `#/build/<index>`. Preserve its visual design, gallery, catalog, viewer, camera, lighting, materials, controls, deterministic geometry, lifecycle protections, and failure states. Never replace it with the separate Next.js/React Three Fiber application under `src/app`, and never create another Builder. Work only on the authorized milestone. All AI output must become schema-validated, allowlisted commands executed by deterministic application code; AI must not directly create trusted geometry or execute code. Vercel must use `framework: null`, run `npm run build:legacy`, and publish `dist`. Before reporting success, run the legacy build, complete real-browser suite, deploy the verified static application, and confirm production has `#bld3d`, Three.js r128, non-blank WebGL pixels, working controls, and no `/_next/` assets. Stop after the milestone and wait for owner approval.
