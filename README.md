# FurniAI — Website

Custom-furniture platform: landing page + live 3D configurator, in one site.

## Files

```
FurniAI/
├─ index.html    markup + structure (links styles.css and app.js)
├─ styles.css    all styling (spec-sheet identity: paper, brass, Fraunces + Space Mono)
└─ app.js        the whole app: router, hero 3D, gallery thumbnails, and the parametric configurator
```

Three.js and the fonts load from a CDN, so there is **no build step and nothing to install**.

## Run it

Just open `index.html` in any modern browser (double-click it).

If your browser blocks the CDN scripts when opening from `file://`, run a tiny local server instead:

```bash
cd FurniAI
python3 -m http.server 8000
# then open http://localhost:8000
```

## Publish (GitHub Pages)

1. Create a new GitHub repo and upload these three files (`index.html`, `styles.css`, `app.js`).
2. Repo **Settings → Pages → Deploy from a branch → main / root → Save**.
3. Your site goes live at `https://<your-username>.github.io/<repo>/`.

## What's inside

- **Landing page** — hero with a live 3D oak wardrobe framed by animated dimension lines, the 4-step pipeline, an 8-piece gallery (each card with its own rotating 3D thumbnail), the "built to spec" cut-list section, and the materials row.
- **Configurator** — click any gallery card or "Start designing" to open the builder. Parametric wardrobes, kitchens (linear, L-corner, with island), and L/U walk-ins. Adjust sections, drawers, shelves, dimensions, material, handle, LED. Doors open as mirrored left/right pairs; drawers pull out; corner cells stay door-only.
- **Routing** — `#/` is the landing page, `#/build/<id>` opens a design in the builder.

## Notes

- Prices are indicative (AED) and computed in `app.js` (`Builder.updatePrice`); edit the `DESIGNS` array and `MAT` table at the top of `app.js` to change pieces, materials, and base prices.
- Supported rectangular configurations can request an authenticated
  deterministic factory-review pack through `/api/production`. The pack is
  never presented as factory-released: physical machine qualification and a
  signed first article are still required. The server adapter accepts an
  experimental L-kitchen only with two explicit run lengths; the live browser
  still marks L-kitchen production unsupported because it has no second-run
  input. U/island production geometry remains rejected.
