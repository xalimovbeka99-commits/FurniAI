/**
 * dxfCompiler.js — Universal 2D DXF CNC layer compiler & preflight bridge
 * ========================================================================
 * Emits AutoCAD R12 / 2000-compatible DXF text for PartGraph panels.
 * CNC drilling stays fail-closed: DRILL_SYSTEM_32 is omitted unless the
 * caller explicitly approves AND qualificationStatus === "CNC_QUALIFIED".
 * This module never invents CNC_QUALIFIED and does not unlock CNC globally.
 *
 * Layers (strict names):
 *   OUTLINE_CONTOUR   — closed perimeter polyline (Length→X, Width→Y, origin 0,0)
 *   GROOVE_BACK_PANEL — back-groove tool path inset inside the outline
 *   DRILL_SYSTEM_32   — Ø5 × 13 mm shelf-pin holes (gated)
 *
 * Units: PartGraph stores deci-mm (1 dmm = 0.1 mm). DXF geometry is millimetres.
 *
 * Groove metadata encoding (R12-safe group codes / comments):
 *   - Layer description + DXF comments document widthMm / depthMm
 *   - Extended data style: 1001 APPID "FURNIAI" + 1000 string pairs
 *   - Groove closed polyline vertices stay strictly inside OUTLINE_CONTOUR
 */

import { fromDeciMm } from "../furnispec/units.js";
import { PART_ROLES, GEOMETRY_TYPES } from "../partgraph/schema.js";
import { resolve } from "../rules/wardrobeRuleCatalog.js";

export const DXF_LAYERS = Object.freeze({
  OUTLINE_CONTOUR: "OUTLINE_CONTOUR",
  GROOVE_BACK_PANEL: "GROOVE_BACK_PANEL",
  DRILL_SYSTEM_32: "DRILL_SYSTEM_32",
});

/** Roles that host a machined back groove for the BACK_PANEL insert. */
const GROOVE_HOST_ROLES = new Set([
  PART_ROLES.TOP_PANEL,
  PART_ROLES.BOTTOM_PANEL,
  PART_ROLES.SIDE_PANEL_LEFT,
  PART_ROLES.SIDE_PANEL_RIGHT,
]);

/** Roles that may receive System 32 shelf-pin columns when drilling is unlocked. */
const SYSTEM32_HOST_ROLES = new Set([
  PART_ROLES.SIDE_PANEL_LEFT,
  PART_ROLES.SIDE_PANEL_RIGHT,
  PART_ROLES.DIVIDER_PANEL,
]);

const GROOVE_WIDTH_MM_MIN = 7.0;
const GROOVE_WIDTH_MM_MAX = 8.5;
const GROOVE_DEPTH_MM_MIN = 7.0;
const GROOVE_DEPTH_MM_MAX = 10.0;

const SYSTEM32_DIAMETER_MM = 5.0;
const SYSTEM32_DEPTH_DEFAULT_MM = 13.0;

/**
 * Fail-closed System 32 gate.
 * Both conditions required; neither is invented by this module.
 *
 * @param {object} [options]
 * @returns {boolean}
 */
export function isSystem32DrillingApproved(options = {}) {
  const explicit =
    options.approveSystem32Drilling === true ||
    options.approveDrilling === true ||
    options.emitSystem32 === true;
  const status =
    options.qualificationStatus ??
    options.partGraph?.qualificationStatus ??
    null;
  return explicit === true && status === "CNC_QUALIFIED";
}

/**
 * Compile one panel to DXF text.
 *
 * @param {object} panel — PartGraph part (or flat { lengthMm, widthMm, ... })
 * @param {object} [options]
 * @param {boolean} [options.approveSystem32Drilling] — explicit drilling unlock
 * @param {string}  [options.qualificationStatus] — must be CNC_QUALIFIED for drill layer
 * @param {object}  [options.partGraph] — optional graph for status / operations
 * @param {Array}   [options.operations] — BACK_GROOVE ops (defaults to partGraph.operations)
 * @param {Array<{x:number,y:number}>} [options.system32Holes] — explicit hole centres (mm)
 * @param {number}  [options.grooveWidthMm]
 * @param {number}  [options.grooveDepthMm]
 * @param {number}  [options.grooveRearSetbackMm]
 * @returns {string} DXF content
 */
export function compilePanelToDxf(panel, options = {}) {
  if (!panel || typeof panel !== "object") {
    throw new Error("compilePanelToDxf requires a panel object.");
  }

  const dims = resolvePanelDimsMm(panel);
  const { lengthMm: L, widthMm: W, thicknessMm: T } = dims;
  if (!(L > 0) || !(W > 0)) {
    throw new Error(`Panel "${panel.id || "?"}" has non-positive flat dimensions.`);
  }
  if (!(T > 0)) {
    throw new Error(`Panel "${panel.id || "?"}" has non-positive thickness (${T}).`);
  }

  const layers = new Set([DXF_LAYERS.OUTLINE_CONTOUR]);
  const entities = [];

  // --- OUTLINE_CONTOUR: closed polyline, first == last vertex ---
  const outline = [
    [0, 0],
    [L, 0],
    [L, W],
    [0, W],
    [0, 0],
  ];
  entities.push(...polylineEntity(DXF_LAYERS.OUTLINE_CONTOUR, outline));

  // --- GROOVE_BACK_PANEL (when panel hosts a back groove) ---
  const groove = resolveGrooveSpec(panel, options, dims);
  if (groove) {
    layers.add(DXF_LAYERS.GROOVE_BACK_PANEL);
    const groovePoly = buildInsetGroovePolyline(L, W, groove);
    assertPolylineInsideOutline(groovePoly, L, W);
    entities.push(
      ...commentEntity(
        `GROOVE_BACK_PANEL widthMm=${fmt(groove.widthMm)} depthMm=${fmt(groove.depthMm)} rearSetbackMm=${fmt(groove.rearSetbackMm)}`
      )
    );
    entities.push(...polylineEntity(DXF_LAYERS.GROOVE_BACK_PANEL, groovePoly));
    entities.push(...xdataFurniai([
      ["grooveWidthMm", String(groove.widthMm)],
      ["grooveDepthMm", String(groove.depthMm)],
      ["grooveRearSetbackMm", String(groove.rearSetbackMm)],
    ]));
  }

  // --- DRILL_SYSTEM_32 (fail-closed) ---
  const drillOk = isSystem32DrillingApproved(options);
  if (drillOk && isSystem32Host(panel)) {
    layers.add(DXF_LAYERS.DRILL_SYSTEM_32);
    const depthMm = resolveSystem32DepthMm(options);
    const holes = resolveSystem32Holes(panel, dims, options);
    entities.push(
      ...commentEntity(
        `DRILL_SYSTEM_32 diameterMm=${SYSTEM32_DIAMETER_MM} depthMm=${fmt(depthMm)} count=${holes.length}`
      )
    );
    for (const h of holes) {
      assertPointInsideOutline(h.x, h.y, L, W, SYSTEM32_DIAMETER_MM / 2);
      entities.push(...circleEntity(DXF_LAYERS.DRILL_SYSTEM_32, h.x, h.y, SYSTEM32_DIAMETER_MM / 2));
    }
    entities.push(...xdataFurniai([
      ["drillDiameterMm", String(SYSTEM32_DIAMETER_MM)],
      ["drillDepthMm", String(depthMm)],
    ]));
  }

  return buildDxfDocument([...layers], entities);
}

/**
 * Compile every machinable RECTANGULAR_PANEL in a PartGraph to a DXF package.
 *
 * @param {object} partGraph
 * @param {object} [options] — forwarded to compilePanelToDxf (plus per-panel ops)
 * @returns {Array<{ filename: string, dxfContent: string, metadata: object }>}
 */
export function compileCabinetDxfPackage(partGraph, options = {}) {
  if (!partGraph || typeof partGraph !== "object") {
    throw new Error("compileCabinetDxfPackage requires a PartGraph object.");
  }

  const parts = Array.isArray(partGraph.parts) ? partGraph.parts : [];
  const operations = Array.isArray(partGraph.operations) ? partGraph.operations : [];
  const packageOptions = {
    ...options,
    partGraph,
    qualificationStatus:
      options.qualificationStatus ?? partGraph.qualificationStatus ?? null,
  };

  const out = [];
  for (const panel of parts) {
    if (!isMachinablePanel(panel)) continue;

    const panelOps = operations.filter((op) => op && op.hostPartId === panel.id);
    const dxfContent = compilePanelToDxf(panel, {
      ...packageOptions,
      operations: panelOps.length ? panelOps : packageOptions.operations,
    });

    out.push({
      filename: safeDxfFilename(panel.id),
      dxfContent,
      metadata: buildPanelMetadata(panel),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dimension / metadata helpers
// ---------------------------------------------------------------------------

function isMachinablePanel(panel) {
  if (!panel || typeof panel !== "object") return false;
  if (panel.machinable === false || panel.nonMachinable === true) return false;
  if (panel.geometryType && panel.geometryType !== GEOMETRY_TYPES.RECTANGULAR_PANEL) {
    return false;
  }
  if (panel.group === "accessory" || panel.previewOnly === true) return false;
  return Boolean(panel.finished || (panel.lengthMm != null && panel.widthMm != null));
}

function resolvePanelDimsMm(panel) {
  if (panel.finished && panel.finished.lengthDmm != null) {
    return {
      lengthMm: fromDeciMm(panel.finished.lengthDmm),
      widthMm: fromDeciMm(panel.finished.widthDmm),
      thicknessMm: fromDeciMm(panel.finished.thicknessDmm),
    };
  }
  const lengthMm = Number(panel.lengthMm ?? panel.length);
  const widthMm = Number(panel.widthMm ?? panel.width);
  const thicknessMm = Number(panel.thicknessMm ?? panel.thickness ?? 18);
  return { lengthMm, widthMm, thicknessMm };
}

function buildPanelMetadata(panel) {
  const dims = resolvePanelDimsMm(panel);
  const edges = panel.edges || {};
  const toMm = (dmm) => {
    if (dmm == null) return 0;
    if (typeof dmm === "number" && Number.isInteger(dmm)) return fromDeciMm(dmm);
    return Number(dmm) || 0;
  };
  return {
    partId: panel.id ?? null,
    role: panel.role ?? null,
    boardThicknessMm: dims.thicknessMm,
    materialCode: panel.materialCode ?? null,
    grainDirection: panel.grainDirection ?? null,
    edgeBanding: {
      L1: toMm(edges.LENGTH_EDGE_1),
      L2: toMm(edges.LENGTH_EDGE_2),
      W1: toMm(edges.WIDTH_EDGE_1),
      W2: toMm(edges.WIDTH_EDGE_2),
    },
    finishedMm: {
      length: dims.lengthMm,
      width: dims.widthMm,
      thickness: dims.thicknessMm,
    },
  };
}

function safeDxfFilename(id) {
  const base = String(id || "panel")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "panel";
  return `${base}.dxf`;
}

// ---------------------------------------------------------------------------
// Groove resolution
// ---------------------------------------------------------------------------

function resolveGrooveSpec(panel, options, dims) {
  const ops = options.operations
    || options.partGraph?.operations?.filter((o) => o.hostPartId === panel.id)
    || [];
  const grooveOp = ops.find(
    (o) => o && (o.type === "BACK_GROOVE" || o.type === "GROOVE")
  );

  const isBackInsert = panel.role === PART_ROLES.BACK_PANEL;
  if (isBackInsert && !grooveOp && panel.hasBackGroove !== true && !panel.backGroove) {
    return null;
  }

  const roleIsHost = GROOVE_HOST_ROLES.has(panel.role);
  const explicitMeta = panel.hasBackGroove === true || panel.backGroove != null;

  if (!grooveOp && !roleIsHost && !explicitMeta && !options.forceGroove) {
    return null;
  }

  let widthMm = Number(
    options.grooveWidthMm
      ?? grooveOp?.widthMm
      ?? (grooveOp?.widthDmm != null ? fromDeciMm(grooveOp.widthDmm) : null)
      ?? panel.backGroove?.widthMm
      ?? safeResolve("grooveWidthMm", 7.0)
  );
  let depthMm = Number(
    options.grooveDepthMm
      ?? grooveOp?.depthMm
      ?? (grooveOp?.depthDmm != null ? fromDeciMm(grooveOp.depthDmm) : null)
      ?? panel.backGroove?.depthMm
      ?? safeResolve("grooveDepthMm", 7.0)
  );
  const rearSetbackMm = Number(
    options.grooveRearSetbackMm
      ?? panel.backGroove?.rearSetbackMm
      ?? safeResolve("grooveRearDatumMm", 20.0)
  );

  widthMm = clamp(widthMm, GROOVE_WIDTH_MM_MIN, GROOVE_WIDTH_MM_MAX);
  depthMm = clamp(depthMm, GROOVE_DEPTH_MM_MIN, GROOVE_DEPTH_MM_MAX);

  const maxWidth = Math.max(0.5, dims.widthMm - 2 * 0.5);
  if (widthMm > maxWidth) widthMm = maxWidth;

  return { widthMm, depthMm, rearSetbackMm };
}

/**
 * Closed groove rectangle inset from the rear (Y = width) edge.
 * Full band stays inside the outer outline with a 0.5 mm safety inset.
 */
function buildInsetGroovePolyline(lengthMm, widthMm, groove) {
  const inset = 0.5;
  const half = groove.widthMm / 2;
  let cy = widthMm - groove.rearSetbackMm - half;
  const minCy = inset + half;
  const maxCy = widthMm - inset - half;
  cy = clamp(cy, minCy, maxCy);

  const x0 = inset;
  const x1 = lengthMm - inset;
  const y0 = cy - half;
  const y1 = cy + half;

  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0],
  ];
}

function assertPolylineInsideOutline(verts, L, W) {
  const eps = 1e-6;
  for (const [x, y] of verts) {
    if (x < -eps || y < -eps || x > L + eps || y > W + eps) {
      throw new Error(
        `Groove vertex (${x}, ${y}) crosses outer outline 0..${L} × 0..${W}.`
      );
    }
  }
}

function assertPointInsideOutline(x, y, L, W, radius = 0) {
  const eps = 1e-6;
  if (
    x - radius < -eps ||
    y - radius < -eps ||
    x + radius > L + eps ||
    y + radius > W + eps
  ) {
    throw new Error(
      `Hole at (${x}, ${y}) r=${radius} crosses outer outline 0..${L} × 0..${W}.`
    );
  }
}

// ---------------------------------------------------------------------------
// System 32
// ---------------------------------------------------------------------------

function isSystem32Host(panel) {
  if (panel.system32Host === true) return true;
  if (panel.role && SYSTEM32_HOST_ROLES.has(panel.role)) return true;
  if (Array.isArray(panel.system32Holes) || panel.emitSystem32 === true) return true;
  return false;
}

function resolveSystem32DepthMm(options) {
  if (Number.isFinite(options.system32DepthMm)) return options.system32DepthMm;
  return safeResolve("shelfPinHoleDepthMm", SYSTEM32_DEPTH_DEFAULT_MM);
}

/**
 * Prefer explicit options.system32Holes; otherwise catalog-derived columns
 * (front 37 mm + rear mirror) at pitch 32 starting 64 mm from bottom.
 * Only called when the gate is open.
 */
function resolveSystem32Holes(panel, dims, options) {
  if (Array.isArray(options.system32Holes) && options.system32Holes.length) {
    return options.system32Holes.map((h) => ({ x: Number(h.x), y: Number(h.y) }));
  }
  if (Array.isArray(panel.system32Holes) && panel.system32Holes.length) {
    return panel.system32Holes.map((h) => ({ x: Number(h.x), y: Number(h.y) }));
  }

  const pitchMm = safeResolve("shelfPinPitchMm", 32.0);
  const frontSetbackMm = 37.0;
  const originFromBottomMm = 64.0;
  const radius = SYSTEM32_DIAMETER_MM / 2;
  const margin = radius + 0.5;

  const { lengthMm: L, widthMm: W } = dims;
  const colsY = [frontSetbackMm, W - frontSetbackMm].filter(
    (y) => y >= margin && y <= W - margin
  );
  const holes = [];
  for (let x = originFromBottomMm; x <= L - margin; x += pitchMm) {
    if (x < margin) continue;
    for (const y of colsY) {
      holes.push({ x: round1(x), y: round1(y) });
    }
  }
  return holes;
}

function safeResolve(key, fallback) {
  try {
    const v = resolve(key);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// DXF R12 writer
// ---------------------------------------------------------------------------

function buildDxfDocument(layerNames, entityLines) {
  const lines = [];
  const push = (...xs) => {
    for (const x of xs) lines.push(String(x));
  };

  push("0", "SECTION", "2", "HEADER");
  push("9", "$ACADVER", "1", "AC1009");
  push("9", "$INSUNITS", "70", "4");
  push("9", "$MEASUREMENT", "70", "1");
  push("0", "ENDSEC");

  push("0", "SECTION", "2", "TABLES");
  push("0", "TABLE", "2", "LAYER", "70", String(layerNames.length));
  for (const name of layerNames) {
    push(
      "0", "LAYER",
      "2", name,
      "70", "0",
      "62", String(layerColor(name)),
      "6", "CONTINUOUS"
    );
  }
  push("0", "ENDTAB");

  push("0", "TABLE", "2", "APPID", "70", "1");
  push("0", "APPID", "2", "FURNIAI", "70", "0");
  push("0", "ENDTAB");
  push("0", "ENDSEC");

  push("0", "SECTION", "2", "ENTITIES");
  for (const line of entityLines) push(line);
  push("0", "ENDSEC");
  push("0", "EOF");

  return `${lines.join("\n")}\n`;
}

function layerColor(name) {
  switch (name) {
    case DXF_LAYERS.OUTLINE_CONTOUR:
      return 7;
    case DXF_LAYERS.GROOVE_BACK_PANEL:
      return 2;
    case DXF_LAYERS.DRILL_SYSTEM_32:
      return 3;
    default:
      return 7;
  }
}

/** R12 POLYLINE + VERTEX + SEQEND; closed flag 1; first vertex == last. */
function polylineEntity(layer, vertices) {
  const lines = [];
  lines.push("0", "POLYLINE", "8", layer, "66", "1", "70", "1");
  for (const [x, y] of vertices) {
    lines.push("0", "VERTEX", "8", layer, "10", fmt(x), "20", fmt(y), "30", "0.0");
  }
  lines.push("0", "SEQEND", "8", layer);
  return lines;
}

function circleEntity(layer, cx, cy, radius) {
  return [
    "0", "CIRCLE",
    "8", layer,
    "10", fmt(cx),
    "20", fmt(cy),
    "30", "0.0",
    "40", fmt(radius),
  ];
}

function commentEntity(text) {
  return ["999", String(text)];
}

function xdataFurniai(pairs) {
  const lines = ["1001", "FURNIAI"];
  for (const [k, v] of pairs) {
    lines.push("1000", `${k}=${v}`);
  }
  return lines;
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function fmt(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.0";
  const rounded = Math.round(x * 1000) / 1000;
  let s = rounded.toFixed(3);
  s = s.replace(/\.?0+$/, "");
  if (!s.includes(".")) s = `${s}.0`;
  return s;
}

function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

/** Parse closed polyline vertices from DXF text for a given layer (test helper). */
export function extractClosedPolylines(dxfContent, layerName) {
  const tokens = tokenizeDxf(dxfContent);
  const polylines = [];
  let i = 0;
  while (i < tokens.length - 1) {
    if (tokens[i] === "0" && tokens[i + 1] === "POLYLINE") {
      let layer = null;
      let j = i + 2;
      const verts = [];
      while (j < tokens.length - 1) {
        const code = tokens[j];
        const val = tokens[j + 1];
        if (code === "0" && val === "VERTEX") {
          let x = null;
          let y = null;
          let vLayer = layer;
          j += 2;
          while (j < tokens.length - 1 && tokens[j] !== "0") {
            if (tokens[j] === "8") vLayer = tokens[j + 1];
            if (tokens[j] === "10") x = Number(tokens[j + 1]);
            if (tokens[j] === "20") y = Number(tokens[j + 1]);
            j += 2;
          }
          if (layer === layerName || vLayer === layerName) {
            verts.push([x, y]);
          }
          continue;
        }
        if (code === "0" && val === "SEQEND") {
          j += 2;
          break;
        }
        if (code === "0" && (val === "POLYLINE" || val === "CIRCLE")) {
          break;
        }
        if (code === "8" && layer == null) layer = val;
        j += 2;
      }
      if (layer === layerName && verts.length) {
        polylines.push(verts);
      }
      i = j;
      continue;
    }
    i += 1;
  }
  return polylines;
}

/** Extract CIRCLE centres/radii on a layer. */
export function extractCircles(dxfContent, layerName) {
  const tokens = tokenizeDxf(dxfContent);
  const circles = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i] === "0" && tokens[i + 1] === "CIRCLE") {
      let layer = null;
      let x = null;
      let y = null;
      let r = null;
      let j = i + 2;
      while (j < tokens.length - 1 && tokens[j] !== "0") {
        if (tokens[j] === "8") layer = tokens[j + 1];
        if (tokens[j] === "10") x = Number(tokens[j + 1]);
        if (tokens[j] === "20") y = Number(tokens[j + 1]);
        if (tokens[j] === "40") r = Number(tokens[j + 1]);
        j += 2;
      }
      if (layer === layerName) circles.push({ x, y, r });
    }
  }
  return circles;
}

export function dxfHasLayer(dxfContent, layerName) {
  const reTable = new RegExp(`(?:^|\\n)0\\nLAYER\\n2\\n${escapeRe(layerName)}(?:\\n|$)`);
  const reEntity = new RegExp(`(?:^|\\n)8\\n${escapeRe(layerName)}(?:\\n|$)`);
  return reTable.test(dxfContent) || reEntity.test(dxfContent);
}

function tokenizeDxf(text) {
  return String(text).split(/\r?\n/);
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}