/**
 * designs.js — THE GALLERY CATALOG.
 * =================================
 * This file is where "new wardrobes, new kitchens, new everything" lives.
 *
 * THE WHOLE POINT: a new design is DATA, not code. To add a new model you add
 * an entry here. You never touch buildGeometry, the store, the panels, the
 * pricing, or the 3D model. The system stays the same; only this list grows.
 *
 * That is the answer to "I kept trying to change the old site and it wouldn't
 * change": the old models were hardcoded, so every change meant editing code.
 * Here, every design is a FurnitureConfig preset — change the data, the whole
 * pipeline (3D, price, cut list, factory PDF) follows automatically.
 *
 * Each entry is a partial FurnitureConfig. It's run through validateConfig()
 * before loading, so even a slightly-wrong entry degrades to something safe.
 */

/**
 * HOW TO ADD A NEW DESIGN (copy one block, change the values):
 *
 *   {
 *     id: "wardrobe-sliding-3door",        // unique
 *     name: "3-Door Sliding Wardrobe",     // shown in the gallery
 *     category: "wardrobe",                // for gallery filtering
 *     style: "modern",
 *     image: "/gallery/wardrobe-sliding-3door.jpg", // your photo
 *     config: {                            // a partial FurnitureConfig
 *       type: "wardrobe",
 *       material: "oak",
 *       dimensions: { width: 2.7, height: 2.6, depth: 0.62 },
 *       modules: [ ...sections... ],
 *     },
 *   }
 *
 * Nothing else in the codebase changes. Ever.
 */

export const DESIGNS = [
  // ---- WARDROBES ----------------------------------------------------------
  {
    id: "wardrobe-classic-3section",
    name: "Classic 3-Section Wardrobe",
    category: "wardrobe",
    style: "modern",
    image: "/gallery/wardrobe-classic-3section.jpg",
    config: {
      type: "wardrobe",
      material: "oak",
      handleStyle: "silver_knob",
      doorType: "solid_panel",
      dimensions: { width: 2.4, height: 2.8, depth: 0.6 },
      modules: [
        { kind: "door", widthRatio: 0.33, doorCount: 1, shelfCount: 4, hingeSide: "left" },
        { kind: "door", widthRatio: 0.34, doorCount: 1, shelfCount: 2 },
        { kind: "drawerBank", widthRatio: 0.33, drawerRows: 3, hingeSide: "right" },
      ],
    },
  },
  {
    id: "wardrobe-walnut-mirror",
    name: "Walnut Wardrobe with Mirror Doors",
    category: "wardrobe",
    style: "modern",
    image: "/gallery/wardrobe-walnut-mirror.jpg",
    config: {
      type: "wardrobe",
      material: "walnut",
      handleStyle: "gold_bar",
      doorType: "full_mirror",
      ledLighting: "warm",
      dimensions: { width: 3.0, height: 2.8, depth: 0.62 },
      modules: [
        { kind: "door", widthRatio: 0.25, doorCount: 1, shelfCount: 3, hingeSide: "left" },
        { kind: "door", widthRatio: 0.25, doorCount: 1, shelfCount: 3 },
        { kind: "drawerBank", widthRatio: 0.25, drawerRows: 4 },
        { kind: "door", widthRatio: 0.25, doorCount: 1, shelfCount: 3, hingeSide: "right" },
      ],
    },
  },
  {
    id: "wardrobe-compact-2door",
    name: "Compact 2-Door Wardrobe",
    category: "wardrobe",
    style: "minimalist",
    image: "/gallery/wardrobe-compact-2door.jpg",
    config: {
      type: "wardrobe",
      material: "white",
      handleStyle: "hidden_push",
      dimensions: { width: 1.2, height: 2.4, depth: 0.58 },
      modules: [
        { kind: "door", widthRatio: 0.5, doorCount: 1, shelfCount: 4, hingeSide: "left" },
        { kind: "door", widthRatio: 0.5, doorCount: 1, shelfCount: 2, hingeSide: "right" },
      ],
    },
  },

  // ---- KITCHENS -----------------------------------------------------------
  {
    id: "kitchen-modern-run",
    name: "Modern Kitchen Run",
    category: "kitchen",
    style: "handleless",
    image: "/gallery/kitchen-modern-run.jpg",
    config: {
      type: "kitchen",
      material: "graphite",
      handleStyle: "hidden_push",
      ledLighting: "cool",
      dimensions: { width: 3.6, height: 2.2, depth: 0.6 },
      modules: [
        { kind: "door", widthRatio: 0.2, doorCount: 1, shelfCount: 2 },
        { kind: "drawerBank", widthRatio: 0.2, drawerRows: 3 },
        { kind: "door", widthRatio: 0.2, doorCount: 1, shelfCount: 2 },
        { kind: "drawerBank", widthRatio: 0.15, drawerRows: 2 },
        { kind: "door", widthRatio: 0.25, doorCount: 2, shelfCount: 2 },
      ],
    },
  },
  {
    id: "kitchen-oak-shaker",
    name: "Oak Shaker Kitchen",
    category: "kitchen",
    style: "classic",
    image: "/gallery/kitchen-oak-shaker.jpg",
    config: {
      type: "kitchen",
      material: "oak",
      handleStyle: "black_strip",
      dimensions: { width: 3.0, height: 2.2, depth: 0.6 },
      modules: [
        { kind: "door", widthRatio: 0.3, doorCount: 2, shelfCount: 2 },
        { kind: "drawerBank", widthRatio: 0.25, drawerRows: 4 },
        { kind: "door", widthRatio: 0.2, doorCount: 1, shelfCount: 1 },
        { kind: "door", widthRatio: 0.25, doorCount: 1, shelfCount: 2 },
      ],
    },
  },

  // ---- OTHER --------------------------------------------------------------
  {
    id: "shelves-open-5tier",
    name: "Open 5-Tier Shelving",
    category: "shelves",
    style: "minimalist",
    image: "/gallery/shelves-open-5tier.jpg",
    config: {
      type: "shelves",
      material: "dark_wood",
      dimensions: { width: 1.2, height: 2.0, depth: 0.35 },
      modules: [{ kind: "openShelf", widthRatio: 1.0, shelfCount: 5 }],
    },
  },
  {
    id: "vanity-dressing-3drawer",
    name: "Dressing Table, 3-Drawer",
    category: "dressing_table",
    style: "modern",
    image: "/gallery/vanity-dressing-3drawer.jpg",
    config: {
      type: "dressing_table",
      material: "linen",
      handleStyle: "gold_bar",
      ledLighting: "warm",
      dimensions: { width: 1.2, height: 1.4, depth: 0.45 },
      modules: [
        { kind: "drawerBank", widthRatio: 0.5, drawerRows: 3 },
        { kind: "openShelf", widthRatio: 0.5, shelfCount: 1 },
      ],
    },
  },
];

/** Gallery filter helpers. */
export const CATEGORIES = [...new Set(DESIGNS.map((d) => d.category))];
export const getDesign = (id) => DESIGNS.find((d) => d.id === id) || null;
export const designsByCategory = (cat) =>
  cat === "all" ? DESIGNS : DESIGNS.filter((d) => d.category === cat);

/**
 * SCALING TO 100–500 GALLERY ITEMS:
 * You do NOT write 500 entries by hand. Author ~8–12 base designs (like the
 * above), then generate variants programmatically — same design across several
 * materials / widths / handle styles. e.g.:
 *
 *   const MATERIALS = ["oak","walnut","white","graphite"];
 *   const variants = base.flatMap(d =>
 *     MATERIALS.map(m => ({ ...d, id: `${d.id}-${m}`,
 *       name: `${d.name} (${m})`,
 *       config: { ...d.config, material: m } })));
 *
 * 12 designs × 5 materials × ~8 size presets ≈ 480 gallery items, all valid,
 * all manufacturable, zero new code.
 */
