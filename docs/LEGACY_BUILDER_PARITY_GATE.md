# Legacy builder parity gate

Status: release-blocking acceptance contract  
Owner: Codex release verification  
Founder acceptance owner: Bekzod Khalimov  
Established: 2026-08-13

## Purpose

The founder-preferred FurniAI experience is the legacy static application in
`index.html`, `styles.css`, and `app.js`. The Next.js application in `src/`
is the long-term architecture, but a runtime migration must not silently
remove capabilities that the founder can use in the legacy application.

This checklist is required for any branch that changes which application
Vercel serves, introduces an adapter between the canonical Wardrobe Model and
the legacy builder, or integrates the provider architecture with the visible
builder. It is a parity gate, not permission to redesign protected geometry or
production code.

## Frozen reference

| Item | Reference |
| --- | --- |
| Legacy source commit | `9b21e8b62d59d9d0fdad5d49d720c1f4c579b2e2` |
| Reference branch | `codex/furniai-master-engineering-spec` |
| Reference deployment | `dpl_WmF7vQVWso7zpSfRHMk5RNirfkJj` |
| Reference URL | `https://furnia-xalimovbeka99-commits-xalimovbeka99-commits-projects.vercel.app/` |
| Homepage source | `index.html`, `styles.css`, `app.js` |
| Builder entry | The in-page `#view-builder` reached from `/` |

The reference deployment's HTML matches the committed `index.html` except for
Vercel's injected Preview feedback script. Its deployed `styles.css` and
`app.js` match the committed files exactly.

## Automated source-preservation gate

Before browser acceptance, the integration reviewer must record the diff for:

```text
index.html
styles.css
app.js
```

Any change to these files requires a stated reason, focused tests, and founder
acceptance. An unchanged file is not sufficient by itself: deployment routing
must also be checked because the repository contains both the static and
Next.js applications.

The review must record:

- exact integration commit;
- Vercel deployment ID and Preview URL;
- selected Vercel framework, build command, and output directory;
- source file or route serving `/`;
- source file or route serving the builder;
- confirmation that production aliases were not changed before acceptance.

## Founder-visible parity checklist

Every item is `PASS`, `FAIL`, or `NOT APPLICABLE` with a written justification.
Visible behavior is checked in a real browser on the integration Preview.

### Application shell and catalog

- [ ] Homepage loads with normal styling and no blank screen.
- [ ] Catalog remains visible and selectable.
- [ ] Wardrobe presets remain visible.
- [ ] L-shaped and U-shaped walk-in presets remain visible.
- [ ] Straight, L-shaped, U-shaped, and island kitchen presets represented in
      the reference catalog remain visible.
- [ ] Freestanding and floating vanity presets remain visible.
- [ ] Opening a catalog item preserves its furniture type and starting values.
- [ ] Mobile builder navigation remains usable.

### 3D viewport

- [ ] WebGL canvas renders a visible furniture model.
- [ ] Drag/orbit works.
- [ ] Zoom works.
- [ ] Resizing the viewport does not blank or corrupt the canvas.
- [ ] No fatal React, Three.js, hydration, or WebGL console error occurs.
- [ ] Corner, L-shaped, U-shaped, and island geometry represented by the
      selected reference presets remains recognizable.

### Dimensions and structure

- [ ] Width changes update the visible model.
- [ ] Height changes update the visible model.
- [ ] Depth changes update the visible model.
- [ ] Section-count changes update the visible model.
- [ ] Shelf-count changes update the visible model.
- [ ] Drawer-row changes update the visible model.
- [ ] Invalid or unsupported values are rejected rather than silently guessed.

### Doors, drawers, and appearance

- [ ] Solid doors render.
- [ ] Glass doors render with their intended transparent appearance.
- [ ] Mirror doors render with their intended reflective appearance.
- [ ] Open/no-door mode renders.
- [ ] Door open/close animation works.
- [ ] Drawer open/close animation works.
- [ ] Existing material choices remain selectable and visibly distinct.
- [ ] Existing handle choices remain selectable and visibly distinct.
- [ ] Warm, cool, and off LED choices remain selectable and visibly distinct.

## Wardrobe adapter acceptance

The adapter may update the legacy builder only from a validated canonical
Wardrobe Model. Raw provider output must never be passed to legacy state or
geometry.

The independent review must prove:

- [ ] Model validation occurs before adapter application.
- [ ] Dimensions are mapped using explicit unit conversion and validated
      integer millimetres at the canonical boundary.
- [ ] Sections, shelves, and drawers map to the intended legacy state fields.
- [ ] Invalid models cause an explicit error and no partial state mutation.
- [ ] Applying an edit retains the same wardrobe ID.
- [ ] Every accepted edit increments the revision exactly once.
- [ ] Repeating an edit does not recreate the wardrobe.
- [ ] Unrelated legacy state—materials, doors, handles, LEDs, camera/view, and
      other catalog entries—is not silently reset or dropped.
- [ ] Deterministic FurniAI/tool failures do not trigger provider switching.
- [ ] Adapter tests cover dimensions, sections, shelves, drawers, invalid
      input, repeated edits, revision behavior, and unrelated-state retention.

## Conversational vertical slice

Run these prompts in order against one browser session:

1. `Create a 2400 mm wide, 2600 mm high, 600 mm deep wardrobe with three sections.`
2. `Put four drawers in the middle section.`
3. `Change the middle to three drawers and add one shelf.`
4. `Make it 2800 mm wide.`

Expected after every accepted command:

- the same wardrobe ID remains;
- revision increments by one;
- the canonical model contains the requested change;
- the adapter updates the matching legacy state;
- the visible Three.js wardrobe changes;
- earlier unrelated choices remain intact.

## Release decision

The integration Preview is not eligible for production promotion until:

1. automated repository, provider/security, adapter, and production checks
   pass;
2. this parity checklist has no unexplained failures;
3. the Vercel deployment is traceable to the exact integration commit; and
4. Bekzod records founder acceptance of the conversational vertical slice.

Until then, report `READY FOR NEXT MILESTONE: NO` and leave the existing
production deployment and aliases unchanged.
