/**
 * nestingCompiler.js — Rectangular cut-list & sheet nesting preflight
 * =====================================================================
 * Ingests PartGraph RECTANGULAR_PANEL parts into:
 *   1) a cut-list CSV (raw cut sizes in mm)
 *   2) a sheet-optimization nesting manifest (kerf + perimeter trim)
 *
 * Units: PartGraph stores deci-mm (1 dmm = 0.1 mm). All nesting geometry is mm.
 *
 * Algorithm: First-Fit Decreasing Height (FFDH) shelf packing.
 *   - Parts sorted by placed height (desc), then width (desc).
 *   - Open shelves left-to-right; new shelf when width exhausted; new sheet
 *     when usable height exhausted.
 *   - AABBs include kerf gutters between adjacent parts (not outside trim).
 *   - Guillotine-friendly shelves (horizontal cuts between shelves).
 *
 * Stock sheets evaluated (both reported; primary = optimal):
 *   - 2440 × 1220 mm
 *   - 2800 × 2070 mm
 * Selection: fewest sheets → higher yield → smaller stock area (prefer 2440×1220).
 *
 * Grain:
 *   LENGTH / LENGTHWISE → part length along sheet length (X); no 90° rotation
 *   WIDTH              → part width along sheet width (Y) ⇒ length along X; no rotation
 *   NONE               → may try both orientations
 *
 * CNC / DXF drilling remains gated elsewhere — this module is nesting preflight only.
 */

import { fromDeciMm } from "../furnispec/units.js";
import { GEOMETRY_TYPES, GRAIN_DIRECTIONS } from "../partgraph/schema.js";

/** Default stock families (length = X, width = Y). */
export const STOCK_SHEETS = Object.freeze([
  Object.freeze({ id: "SHEET_2440x1220", lengthMm: 2440, widthMm: 1220 }),
  Object.freeze({ id: "SHEET_2800x2070", lengthMm: 2800, widthMm: 2070 }),
]);

export const DEFAULT_KERF_MM = 3.5;
export const DEFAULT_PERIMETER_TRIM_MM = 15.0;

/** CSV columns (exact order / labels). */
export const CUT_LIST_CSV_COLUMNS = Object.freeze([
  "Part ID",
  "Role",
  "Material",
  "Cut Length (mm)",
  "Cut Width (mm)",
  "Thickness (mm)",
  "Qty",
  "Grain",
  "Band L1",
  "Band L2",
  "Band W1",
  "Band W2",
]);

/**
 * Normalize grain aliases.
 * LENGTHWISE → LENGTH (schema GRAIN_DIRECTIONS.LENGTH).
 *
 * @param {string|null|undefined} grain
 * @returns {"LENGTH"|"WIDTH"|"NONE"}
 */
export function normalizeGrainDirection(grain) {
  if (grain == null || grain === "") return GRAIN_DIRECTIONS.NONE;
  const g = String(grain).trim().toUpperCase();
  if (g === "LENGTHWISE" || g === GRAIN_DIRECTIONS.LENGTH || g === "L") {
    return GRAIN_DIRECTIONS.LENGTH;
  }
  if (g === GRAIN_DIRECTIONS.WIDTH || g === "W") {
    return GRAIN_DIRECTIONS.WIDTH;
  }
  if (g === GRAIN_DIRECTIONS.NONE || g === "NO_GRAIN" || g === "-") {
    return GRAIN_DIRECTIONS.NONE;
  }
  return g; // pass-through unknown for reject path
}

/**
 * Allowed placed orientations for a grain constraint.
 * Sheet axes: length = X, width = Y.
 *
 * @param {string} grainNormalized
 * @returns {Array<"natural"|"rotated">}
 */
export function allowedOrientations(grainNormalized) {
  const g = normalizeGrainDirection(grainNormalized);
  if (g === GRAIN_DIRECTIONS.NONE) return ["natural", "rotated"];
  // LENGTH / LENGTHWISE: length ‖ sheet length (X) — natural only
  // WIDTH: width ‖ sheet width (Y) — also natural (L along X, W along Y)
  if (g === GRAIN_DIRECTIONS.LENGTH || g === GRAIN_DIRECTIONS.WIDTH) {
    return ["natural"];
  }
  // Unknown grain: treat as non-rotatable natural for safety
  return ["natural"];
}

/**
 * Whether a 90° rotation would violate grain.
 * LENGTHWISE/LENGTH cannot rotate; WIDTH cannot rotate; NONE may.
 *
 * @param {string} grain
 * @returns {boolean}
 */
export function canRotateForGrain(grain) {
  return allowedOrientations(grain).includes("rotated");
}

function isMachinablePanel(panel) {
  if (!panel || typeof panel !== "object") return false;
  if (panel.machinable === false || panel.nonMachinable === true) return false;
  if (panel.geometryType && panel.geometryType !== GEOMETRY_TYPES.RECTANGULAR_PANEL) {
    return false;
  }
  if (panel.group === "accessory" || panel.previewOnly === true) return false;
  return Boolean(panel.finished || panel.raw || (panel.lengthMm != null && panel.widthMm != null));
}

function edgeToMm(dmm) {
  if (dmm == null) return 0;
  if (typeof dmm === "number" && Number.isInteger(dmm)) return fromDeciMm(dmm);
  return Number(dmm) || 0;
}

/**
 * Resolve cut (raw) and finished dims in mm, plus banding callouts.
 *
 * @param {object} panel
 * @returns {object}
 */
export function resolveCutPanelMm(panel) {
  const edges = panel.edges || {};
  const band = {
    L1: edgeToMm(edges.LENGTH_EDGE_1),
    L2: edgeToMm(edges.LENGTH_EDGE_2),
    W1: edgeToMm(edges.WIDTH_EDGE_1),
    W2: edgeToMm(edges.WIDTH_EDGE_2),
  };

  let cutLengthMm;
  let cutWidthMm;
  let thicknessMm;
  let finishedLengthMm;
  let finishedWidthMm;

  if (panel.raw && panel.raw.lengthDmm != null) {
    cutLengthMm = fromDeciMm(panel.raw.lengthDmm);
    cutWidthMm = fromDeciMm(panel.raw.widthDmm);
    thicknessMm = fromDeciMm(panel.raw.thicknessDmm ?? panel.finished?.thicknessDmm ?? 180);
  } else if (panel.finished && panel.finished.lengthDmm != null) {
    finishedLengthMm = fromDeciMm(panel.finished.lengthDmm);
    finishedWidthMm = fromDeciMm(panel.finished.widthDmm);
    thicknessMm = fromDeciMm(panel.finished.thicknessDmm);
    // Derive cut from finished − banding (same rule as buildStructuralPartGraph)
    cutLengthMm = finishedLengthMm - band.W1 - band.W2;
    cutWidthMm = finishedWidthMm - band.L1 - band.L2;
  } else {
    cutLengthMm = Number(panel.cutLengthMm ?? panel.lengthMm ?? panel.length);
    cutWidthMm = Number(panel.cutWidthMm ?? panel.widthMm ?? panel.width);
    thicknessMm = Number(panel.thicknessMm ?? panel.thickness ?? 18);
  }

  if (panel.finished && panel.finished.lengthDmm != null) {
    finishedLengthMm = fromDeciMm(panel.finished.lengthDmm);
    finishedWidthMm = fromDeciMm(panel.finished.widthDmm);
  } else {
    finishedLengthMm = cutLengthMm + band.W1 + band.W2;
    finishedWidthMm = cutWidthMm + band.L1 + band.L2;
  }

  const grain = normalizeGrainDirection(panel.grainDirection);
  const qty = Math.max(1, Number(panel.quantity ?? panel.qty ?? 1) || 1);

  return {
    partId: panel.id ?? null,
    role: panel.role ?? null,
    material: panel.materialCode ?? panel.material ?? "",
    cutLengthMm,
    cutWidthMm,
    thicknessMm,
    finishedLengthMm,
    finishedWidthMm,
    qty,
    grain,
    grainRaw: panel.grainDirection ?? GRAIN_DIRECTIONS.NONE,
    band,
  };
}

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function roundMm(n, digits = 1) {
  const f = 10 ** digits;
  return Math.round(Number(n) * f) / f;
}

/**
 * Build cut-list row objects from a PartGraph.
 *
 * @param {object} partGraph
 * @returns {Array<object>}
 */
export function buildCutListRows(partGraph) {
  if (!partGraph || typeof partGraph !== "object") {
    throw new Error("buildCutListRows requires a PartGraph object.");
  }
  const parts = Array.isArray(partGraph.parts) ? partGraph.parts : [];
  const rows = [];
  for (const panel of parts) {
    if (!isMachinablePanel(panel)) continue;
    const r = resolveCutPanelMm(panel);
    if (!(r.cutLengthMm > 0) || !(r.cutWidthMm > 0)) {
      throw new Error(
        `Panel "${r.partId || "?"}" has non-positive cut dimensions (${r.cutLengthMm}×${r.cutWidthMm}).`
      );
    }
    if (!(r.thicknessMm > 0)) {
      throw new Error(
        `Panel "${r.partId || "?"}" has non-positive thickness (${r.thicknessMm}).`
      );
    }
    rows.push({
      partId: r.partId,
      role: r.role,
      material: r.material,
      cutLengthMm: roundMm(r.cutLengthMm),
      cutWidthMm: roundMm(r.cutWidthMm),
      thicknessMm: roundMm(r.thicknessMm),
      qty: r.qty,
      grain: r.grain,
      bandL1: roundMm(r.band.L1),
      bandL2: roundMm(r.band.L2),
      bandW1: roundMm(r.band.W1),
      bandW2: roundMm(r.band.W2),
    });
  }
  return rows;
}

/**
 * generateCutListCsv(partGraph) → CSV string with exact column headers.
 *
 * @param {object} partGraph
 * @returns {string}
 */
export function generateCutListCsv(partGraph) {
  const rows = buildCutListRows(partGraph);
  const lines = [CUT_LIST_CSV_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.partId),
        csvEscape(r.role),
        csvEscape(r.material),
        r.cutLengthMm,
        r.cutWidthMm,
        r.thicknessMm,
        r.qty,
        csvEscape(r.grain),
        r.bandL1,
        r.bandL2,
        r.bandW1,
        r.bandW2,
      ].join(",")
    );
  }
  return lines.join("\n");
}

/**
 * Sum edge-banding linear meters by tape thickness (mm key → meters).
 * L1/L2 run along cut length; W1/W2 run along cut width.
 *
 * @param {Array<object>} cutRows — from buildCutListRows
 * @returns {Record<string, number>}
 */
export function sumEdgeBandingLinearMeters(cutRows) {
  /** @type {Map<number, number>} thicknessMm → mm length */
  const acc = new Map();
  const add = (thicknessMm, lengthMm, qty) => {
    if (!(thicknessMm > 0) || !(lengthMm > 0)) return;
    const t = roundMm(thicknessMm, 2);
    acc.set(t, (acc.get(t) || 0) + lengthMm * qty);
  };
  for (const r of cutRows) {
    add(r.bandL1, r.cutLengthMm, r.qty);
    add(r.bandL2, r.cutLengthMm, r.qty);
    add(r.bandW1, r.cutWidthMm, r.qty);
    add(r.bandW2, r.cutWidthMm, r.qty);
  }
  /** @type {Record<string, number>} */
  const out = {};
  for (const [t, mm] of [...acc.entries()].sort((a, b) => a[0] - b[0])) {
    out[String(t)] = roundMm(mm / 1000, 4);
  }
  return out;
}

/**
 * Expand cut rows into individual nestable rectangles (one per qty unit).
 *
 * @param {Array<object>} cutRows
 * @returns {Array<object>}
 */
function expandNestItems(cutRows) {
  const items = [];
  for (const r of cutRows) {
    for (let i = 0; i < r.qty; i++) {
      items.push({
        instanceId: `${r.partId}#${i + 1}`,
        partId: r.partId,
        role: r.role,
        grain: r.grain,
        lengthMm: r.cutLengthMm,
        widthMm: r.cutWidthMm,
        areaMm2: r.cutLengthMm * r.cutWidthMm,
      });
    }
  }
  return items;
}

/**
 * Candidate placements for one item under grain rules.
 * @returns {Array<{ placedW: number, placedH: number, orientation: string }>}
 */
function placementCandidates(item) {
  const orients = allowedOrientations(item.grain);
  const out = [];
  for (const o of orients) {
    if (o === "natural") {
      out.push({
        placedW: item.lengthMm,
        placedH: item.widthMm,
        orientation: "natural",
      });
    } else {
      out.push({
        placedW: item.widthMm,
        placedH: item.lengthMm,
        orientation: "rotated",
      });
    }
  }
  return out;
}

/**
 * Assert two axis-aligned rects (with kerf already baked into placement
 * spacing) do not overlap. Rects are {x,y,w,h} in sheet usable coords.
 */
export function aabbsOverlap(a, b, eps = 1e-6) {
  return (
    a.x < b.x + b.w - eps &&
    a.x + a.w > b.x + eps &&
    a.y < b.y + b.h - eps &&
    a.y + a.h > b.y + eps
  );
}

/**
 * FFDH shelf pack onto one stock size.
 *
 * Usable area = sheet − 2×perimeterTrim each axis.
 * Between parts: kerf gutter on the right and above each placed part
 * (last part on a shelf / last shelf do not need trailing kerf beyond usable).
 *
 * @param {Array<object>} items
 * @param {{ lengthMm: number, widthMm: number, id?: string }} sheet
 * @param {{ kerfMm?: number, perimeterTrimMm?: number }} options
 * @returns {{ sheets: Array, sheetCount: number, totalSheetAreaMm2: number, totalPanelAreaMm2: number, yieldEfficiencyPct: number, stock: object, unplaced: Array }}
 */
export function packFfdhShelves(items, sheet, options = {}) {
  const kerfMm = options.kerfMm ?? DEFAULT_KERF_MM;
  const trimMm = options.perimeterTrimMm ?? DEFAULT_PERIMETER_TRIM_MM;
  const usableW = sheet.lengthMm - 2 * trimMm;
  const usableH = sheet.widthMm - 2 * trimMm;

  if (!(usableW > 0) || !(usableH > 0)) {
    throw new Error(
      `Stock ${sheet.id || "?"} usable area non-positive after ${trimMm}mm trim.`
    );
  }

  // Pre-check: every item must have at least one orientation that fits usable.
  const unplaced = [];
  const placeable = [];
  for (const item of items) {
    const cands = placementCandidates(item).filter(
      (c) => c.placedW <= usableW + 1e-9 && c.placedH <= usableH + 1e-9
    );
    if (cands.length === 0) {
      unplaced.push({
        ...item,
        reason: `does not fit usable ${roundMm(usableW)}×${roundMm(usableH)} mm on ${sheet.id || "sheet"} (grain=${item.grain})`,
      });
    } else {
      placeable.push({ item, cands });
    }
  }

  // Sort by max height among candidates (desc), then max width (desc) — classic FFDH.
  placeable.sort((a, b) => {
    const ah = Math.max(...a.cands.map((c) => c.placedH));
    const bh = Math.max(...b.cands.map((c) => c.placedH));
    if (bh !== ah) return bh - ah;
    const aw = Math.max(...a.cands.map((c) => c.placedW));
    const bw = Math.max(...b.cands.map((c) => c.placedW));
    return bw - aw;
  });

  /** @type {Array<{ index: number, placements: Array, shelves: Array }>} */
  const sheets = [];

  const newSheet = () => {
    const s = { index: sheets.length, placements: [], shelves: [] };
    sheets.push(s);
    return s;
  };

  const newShelf = (sheetState, height) => {
    const shelf = {
      y: 0,
      height,
      cursorX: 0,
      placements: [],
    };
    // Stack shelves from bottom (y=0); account for kerf between shelves
    if (sheetState.shelves.length === 0) {
      shelf.y = 0;
    } else {
      const prev = sheetState.shelves[sheetState.shelves.length - 1];
      shelf.y = prev.y + prev.height + kerfMm;
    }
    sheetState.shelves.push(shelf);
    return shelf;
  };

  let current = newSheet();

  for (const { item, cands } of placeable) {
    let placed = false;

    // Prefer candidate that packs best: try natural first (stable), then rotated
    const ordered = [...cands].sort((a, b) => {
      if (a.orientation === "natural" && b.orientation !== "natural") return -1;
      if (b.orientation === "natural" && a.orientation !== "natural") return 1;
      return b.placedH - a.placedH;
    });

    for (const cand of ordered) {
      // Try existing shelves on current sheet
      for (const shelf of current.shelves) {
        if (cand.placedH > shelf.height + 1e-9) continue;
        const needW = cand.placedW + (shelf.cursorX > 0 ? kerfMm : 0);
        if (shelf.cursorX + needW <= usableW + 1e-9) {
          const x = shelf.cursorX === 0 ? 0 : shelf.cursorX + kerfMm;
          const placement = {
            instanceId: item.instanceId,
            partId: item.partId,
            role: item.role,
            grain: item.grain,
            orientation: cand.orientation,
            x: roundMm(x, 3),
            y: roundMm(shelf.y, 3),
            w: roundMm(cand.placedW, 3),
            h: roundMm(cand.placedH, 3),
            sheetIndex: current.index,
          };
          shelf.placements.push(placement);
          current.placements.push(placement);
          shelf.cursorX = x + cand.placedW;
          placed = true;
          break;
        }
      }
      if (placed) break;

      // Open a new shelf on current sheet if height remains
      const usedH =
        current.shelves.length === 0
          ? 0
          : current.shelves[current.shelves.length - 1].y +
            current.shelves[current.shelves.length - 1].height;
      const gap = current.shelves.length === 0 ? 0 : kerfMm;
      if (usedH + gap + cand.placedH <= usableH + 1e-9) {
        const shelf = newShelf(current, cand.placedH);
        // newShelf already set y with kerf; fix height to cand
        shelf.height = cand.placedH;
        const placement = {
          instanceId: item.instanceId,
          partId: item.partId,
          role: item.role,
          grain: item.grain,
          orientation: cand.orientation,
          x: 0,
          y: roundMm(shelf.y, 3),
          w: roundMm(cand.placedW, 3),
          h: roundMm(cand.placedH, 3),
          sheetIndex: current.index,
        };
        shelf.placements.push(placement);
        current.placements.push(placement);
        shelf.cursorX = cand.placedW;
        placed = true;
        break;
      }
    }

    if (!placed) {
      // Start a fresh sheet and place with tallest fitting candidate
      current = newSheet();
      let done = false;
      for (const cand of ordered) {
        if (cand.placedW > usableW + 1e-9 || cand.placedH > usableH + 1e-9) continue;
        const shelf = newShelf(current, cand.placedH);
        const placement = {
          instanceId: item.instanceId,
          partId: item.partId,
          role: item.role,
          grain: item.grain,
          orientation: cand.orientation,
          x: 0,
          y: 0,
          w: roundMm(cand.placedW, 3),
          h: roundMm(cand.placedH, 3),
          sheetIndex: current.index,
        };
        shelf.placements.push(placement);
        current.placements.push(placement);
        shelf.cursorX = cand.placedW;
        done = true;
        break;
      }
      if (!done) {
        unplaced.push({
          ...item,
          reason: `failed to pack on ${sheet.id || "sheet"} after new-sheet attempt`,
        });
      }
    }
  }

  // Drop trailing empty sheet if any
  while (sheets.length > 0 && sheets[sheets.length - 1].placements.length === 0) {
    sheets.pop();
  }

  // Validate no overlaps (AABB) including kerf separation expectation
  for (const s of sheets) {
    const rects = s.placements.map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h, id: p.instanceId }));
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        if (aabbsOverlap(rects[i], rects[j])) {
          throw new Error(
            `Nesting overlap on ${sheet.id} sheet ${s.index}: ${rects[i].id} vs ${rects[j].id}`
          );
        }
      }
    }
  }

  const sheetCount = sheets.length;
  const totalSheetAreaMm2 = sheetCount * sheet.lengthMm * sheet.widthMm;
  const totalPanelAreaMm2 = items
    .filter((it) => !unplaced.some((u) => u.instanceId === it.instanceId))
    .reduce((a, it) => a + it.areaMm2, 0);
  const yieldEfficiencyPct =
    totalSheetAreaMm2 > 0
      ? roundMm((totalPanelAreaMm2 / totalSheetAreaMm2) * 100, 2)
      : 0;

  return {
    stock: {
      id: sheet.id,
      lengthMm: sheet.lengthMm,
      widthMm: sheet.widthMm,
      usableLengthMm: roundMm(usableW, 1),
      usableWidthMm: roundMm(usableH, 1),
    },
    kerfMm,
    perimeterTrimMm: trimMm,
    sheets: sheets.map((s) => ({
      index: s.index,
      placements: s.placements,
    })),
    sheetCount,
    totalSheetAreaMm2,
    totalPanelAreaMm2,
    yieldEfficiencyPct,
    unplaced,
  };
}

function scorePack(pack) {
  // Lower is better: unplaced penalty, then sheet count, then negative yield, then stock area
  const unplacedPenalty = (pack.unplaced?.length || 0) * 1e9;
  const stockArea = pack.stock.lengthMm * pack.stock.widthMm;
  return (
    unplacedPenalty +
    pack.sheetCount * 1e6 -
    pack.yieldEfficiencyPct * 1e3 +
    stockArea
  );
}

/**
 * compileNestingManifest(partGraph, options?)
 *
 * @param {object} partGraph
 * @param {object} [options]
 * @param {number} [options.kerfMm=3.5]
 * @param {number} [options.perimeterTrimMm=15]
 * @param {Array<{id:string,lengthMm:number,widthMm:number}>} [options.stockSheets]
 * @returns {object}
 */
export function compileNestingManifest(partGraph, options = {}) {
  if (!partGraph || typeof partGraph !== "object") {
    throw new Error("compileNestingManifest requires a PartGraph object.");
  }

  const kerfMm = options.kerfMm ?? DEFAULT_KERF_MM;
  const perimeterTrimMm = options.perimeterTrimMm ?? DEFAULT_PERIMETER_TRIM_MM;
  const stockSheets = options.stockSheets ?? STOCK_SHEETS;

  const cutRows = buildCutListRows(partGraph);
  const items = expandNestItems(cutRows);
  const edgeBandingLinearMetersByThicknessMm = sumEdgeBandingLinearMeters(cutRows);

  const packsByStock = {};
  let primary = null;

  for (const stock of stockSheets) {
    const pack = packFfdhShelves(items, stock, { kerfMm, perimeterTrimMm });
    packsByStock[stock.id] = {
      sheetCount: pack.sheetCount,
      yieldEfficiencyPct: pack.yieldEfficiencyPct,
      totalPanelAreaMm2: pack.totalPanelAreaMm2,
      totalSheetAreaMm2: pack.totalSheetAreaMm2,
      unplacedCount: pack.unplaced.length,
      unplaced: pack.unplaced,
      sheets: pack.sheets,
      stock: pack.stock,
    };
    if (!primary || scorePack(pack) < scorePack(primary)) {
      primary = pack;
    }
  }

  if (!primary) {
    throw new Error("compileNestingManifest: no stock sheets configured.");
  }

  if (primary.unplaced.length > 0) {
    const sample = primary.unplaced[0];
    throw new Error(
      `Nesting failed: ${primary.unplaced.length} part(s) do not fit any evaluated stock. Example: ${sample.instanceId} — ${sample.reason}`
    );
  }

  return {
    algorithm: "FFDH_SHELF",
    algorithmNotes:
      "First-Fit Decreasing Height shelf packing with kerf gutters; guillotine-friendly horizontal shelves. Evaluates both stock families; primary = fewest sheets, then higher yield, then smaller sheet area.",
    kerfMm,
    perimeterTrimMm,
    grainPolicy: {
      LENGTH: "part length ‖ sheet length (X); rotation rejected",
      LENGTHWISE: "alias of LENGTH",
      WIDTH: "part width ‖ sheet width (Y); rotation rejected",
      NONE: "rotation allowed",
    },
    cutList: cutRows,
    edgeBandingLinearMetersByThicknessMm,
    totalPanelAreaMm2: primary.totalPanelAreaMm2,
    packsByStock,
    primaryStockId: primary.stock.id,
    sheetCount: primary.sheetCount,
    yieldEfficiencyPct: primary.yieldEfficiencyPct,
    totalSheetAreaMm2: primary.totalSheetAreaMm2,
    sheets: primary.sheets,
    stock: primary.stock,
  };
}
