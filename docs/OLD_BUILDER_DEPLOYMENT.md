# FurniAI Legacy 3D Builder — Authoritative Web Deployment

## Product decision

The authoritative web experience is the legacy FurniAI application shown locally at:

```text
http://localhost:4173/#/
```

Its Builder route is:

```text
http://localhost:4173/#/build/0
```

Vercel must deploy this application, not the separate Next.js application in `src/app`.

## Technology

- Static HTML, CSS, and JavaScript
- Three.js r128, vendored locally as `vendor-three-r128.min.js`
- Supabase browser client, vendored locally as `vendor-supabase.min.js`
- Hash-based navigation (`#/` and `#/build/<design-index>`)
- Deterministic furniture configuration and geometry in the legacy `Builder`
- Vercel Python/API functions where configured under `api/`

The browser entry point is `index.html`. The main legacy implementation is currently embedded in `index.html`, with supporting behavior in `app.js` and `legacy-builder-adapter.js`.

## Authoritative files

```text
index.html
styles.css
app.js
legacy-builder-adapter.js
vendor-three-r128.min.js
vendor-supabase.min.js
scripts/static-server.js
scripts/build-static.mjs
vercel.json
```

Do not replace the legacy Builder with `src/app/builder/page.jsx`. The Next.js source may remain for reference until a deliberate cleanup milestone, but it is not the Vercel web entry point.

## Local development

From PowerShell:

```powershell
cd "C:\Users\xalim\OneDrive\Documents\FUrniai new"
node scripts/static-server.js
```

Open:

```text
http://localhost:4173/#/
```

Stop the server with `Ctrl+C`.

## Build

```powershell
npm install
npm run build:legacy
```

The build creates `dist/` containing the exact static runtime files required by Vercel. `dist/` is generated and must not be committed.

## Verification

Run the real-browser/WebGL suite:

```powershell
npm run test:browser
```

This verifies the old landing page, catalog, Builder navigation, real WebGL rendering, furniture controls, lifecycle behavior, local Three.js runtime, and visible renderer failure state.

## Vercel deployment

`vercel.json` deliberately sets:

```json
{
  "framework": null,
  "buildCommand": "npm run build:legacy",
  "outputDirectory": "dist"
}
```

Deploy a preview:

```powershell
npx vercel
```

Deploy production only after the browser suite passes:

```powershell
npx vercel --prod
```

After deployment, verify both:

```text
https://<production-domain>/#/
https://<production-domain>/#/build/0
```

The deployed HTML must load `/vendor-three-r128.min.js` and expose the legacy canvas `#bld3d`. It must not load Next.js `/_next/` assets.

Run the automated production check:

```powershell
npm run verify:production -- https://furniai-topaz.vercel.app
```

## Vercel project-link warning

The correct Vercel project is currently named `furniai.` (including the trailing period). A copied `.vercel/project.json` may refer to an older project called `furniai`. If the CLI reports `project_not_found`, relink explicitly and select `furniai.` before deploying.

## Full implementation prompt

Use the following prompt for future engineering work:

> You are the senior engineer responsible for FurniAI. The authoritative web product is the legacy static Three.js furniture application whose entry point is `index.html` and whose local URL is `http://localhost:4173/#/`. Preserve its visual design, gallery, hash navigation, 3D viewer, camera, lights, materials, furniture definitions, configuration controls, WebGL lifecycle protections, and failure states. Do not replace it with the separate Next.js/React Three Fiber Builder under `src/app/builder`. Do not create a third Builder. Maintain one authoritative deterministic furniture configuration and geometry path. AI output must be validated and translated into approved configuration actions; it must never directly execute code or generate trusted manufacturing geometry. Keep Three.js and other core browser assets local when possible. Vercel must use `framework: null`, run `npm run build:legacy`, and publish `dist`. Before reporting success, run `npm run build:legacy` and `npm run test:browser`, deploy the exact verified build, then inspect the production page and confirm it contains the legacy `#bld3d` canvas, renders non-blank WebGL pixels, supports configuration changes, and does not serve Next.js `/_next/` assets. Never claim success from source inspection alone. Do not redesign or remove working controls unless explicitly authorized.

## Architecture flow

```text
index.html
  -> hash router
  -> gallery/design selection
  -> legacy Builder configuration
  -> deterministic panel/part construction
  -> Three.js scene and WebGLRenderer
  -> #bld3d canvas
```

Configuration controls update `Builder.cfg`, rebuild deterministic scene parts, and rerender the viewer. The structured configuration—not Three.js meshes—is the furniture authority.

## Release guard

A release fails if any of these occur:

- Vercel serves the Next.js Builder instead of the legacy Builder.
- `/_next/` assets appear in the production page.
- The `#bld3d` canvas is absent or blank.
- The local vendored Three.js file fails to load.
- Navigation away from and back to the Builder breaks rendering.
- Width or other configuration controls stop updating the visible furniture.
