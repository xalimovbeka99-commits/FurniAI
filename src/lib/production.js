/**
 * production.js — deterministic production-PREVIEW data, no AI.
 * =============================================================
 * Turns a frozen config into an indicative cut list/CSV and a production-pack
 * object. Geometry is checked, but the release stays blocked until exact
 * hardware, construction, stock, tooling, machine and postprocessor profiles
 * are approved. This module does not generate drawings, nesting or CNC code.
 *
 * Same order in → identical preview data out, every time. The future factory
 * path may pass an approved neutral package into BAZIS or another validated
 * adapter; it must never treat these generic planning notes as machine data.
 */
import { buildGeometry, partsToCutList, validateGeometry } from "./buildGeometry.js";
import { MATERIALS } from "./knowledgeBase.js";

const PANEL_THK_MM = 18;

export const PRODUCTION_CAPABILITIES = Object.freeze({
  geometry: "preview",
  cutList: "preview",
  drawings: "unsupported",
  drilling: "conceptual",
  nesting: "unsupported",
  cnc: "unsupported",
});

/** Decide edge banding + grain per part role (simple, factory-sane defaults). */
function finishFor(role) {
  switch (role) {
    case "door":
    case "drawerFront":
      return { edgeBanding: "All edges: 2mm PVC", grain: "Vertical" };
    case "side":
      return { edgeBanding: "Front edge: 2mm PVC", grain: "Vertical" };
    case "shelf":
      return { edgeBanding: "Front edge: 1mm PVC", grain: "Horizontal" };
    case "top":
    case "bottom":
      return { edgeBanding: "Front edge: 2mm PVC", grain: "Horizontal" };
    case "back":
      return { edgeBanding: "None", grain: "—" };
    default:
      return { edgeBanding: "Front edge: 1mm PVC", grain: "—" };
  }
}

/** Build the enriched cut list (mm) from a config. */
export function buildCutList(config) {
  const parts = buildGeometry(config);
  const rows = partsToCutList(parts).map((r, i) => {
    const f = finishFor(r.role);
    return {
      partId: `${r.role.slice(0, 2).toUpperCase()}-${String(i + 1).padStart(2, "0")}`,
      partName: prettyRole(r.role),
      material: MATERIALS[r.material]?.label || r.material,
      length: r.length,
      width: r.width,
      thickness: r.thickness,
      qty: r.qty,
      edgeBanding: f.edgeBanding,
      grain: f.grain,
    };
  });
  return rows;
}

/**
 * Conceptual drilling planning notes.
 *
 * Exact boring depends on the hardware SKU, panel construction, factory
 * tooling and machine profile. Generic rules of thumb must never be emitted
 * as CNC-ready instructions.
 */
export function buildDrillingSpec(config) {
  const spec = [];
  (config.modules || []).forEach((m, i) => {
    if (m.doorCount > 0) {
      spec.push(`Section ${i + 1}: ${m.doorCount} door(s), hinge side ${m.hingeSide}; select an exact hinge SKU and validate door size/weight before generating bore operations.`);
    }
    if (m.drawerRows > 0) {
      spec.push(`Section ${i + 1}: ${m.drawerRows} drawer slide pair(s); select the exact runner SKU, nominal length and load class before generating drilling.`);
    }
    if (m.shelfCount > 0) {
      spec.push(`Section ${i + 1}: ${m.shelfCount} adjustable shelf position(s); line-bore diameter, setbacks and range require the approved factory construction profile.`);
    }
  });
  spec.push("Carcass joinery, back-panel fixing and all machining coordinates are blocked until a versioned factory profile is selected and validated.");
  return spec;
}

/** Full production-pack data — the PDF renderer consumes this. */
export function buildProductionPack(order) {
  const { orderId, config, customer = {}, price = null, createdAt = new Date().toISOString() } = order;
  const d = config.dimensions;
  const geometry = buildGeometry(config);
  const geometryIssues = validateGeometry(geometry, config);
  const releaseBlockers = [
    ...geometryIssues.map((issue) => `${issue.code}: ${issue.message}`),
    "Exact hardware SKUs and manufacturer drilling templates are not selected.",
    "Factory construction, stock, tooling, machine and postprocessor profiles are not approved.",
    "Drawing, nesting and CNC capabilities are not implemented.",
  ];
  return {
    orderId,
    createdAt,
    capabilityStatus: PRODUCTION_CAPABILITIES,
    manufacturingRelease: {
      allowed: false,
      status: "blocked",
      blockers: releaseBlockers,
    },
    header: {
      furnitureType: config.type,
      style: config.style,
      material: MATERIALS[config.material]?.label || config.material,
      dimensionsMm: {
        width: Math.round(d.width * 1000),
        height: Math.round(d.height * 1000),
        depth: Math.round(d.depth * 1000),
      },
      customerName: customer.name || "—",
      deliveryZone: customer.deliveryZone || "—",
      priceAed: price,
    },
    cutList: buildCutList(config),
    drilling: buildDrillingSpec(config),
    geometryValidation: geometryIssues,
    summary: summarise(config),
  };
}

/** Cut list → CSV string (English headers, mm). Filename should include orderId. */
export function cutListToCSV(orderId, config) {
  const rows = buildCutList(config);
  const header = ["OrderID", "PartID", "PartName", "Material", "Length_mm", "Width_mm", "Thickness_mm", "Qty", "EdgeBanding", "Grain"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      orderId, r.partId, csv(r.partName), csv(r.material),
      r.length, r.width, r.thickness, r.qty, csv(r.edgeBanding), csv(r.grain),
    ].join(","));
  }
  return lines.join("\r\n");
}

// --- helpers ---------------------------------------------------------------
function summarise(config) {
  const parts = buildGeometry(config);
  const byRole = parts.reduce((a, p) => ((a[p.role] = (a[p.role] || 0) + 1), a), {});
  return {
    totalParts: parts.length,
    panelThicknessMm: PANEL_THK_MM,
    sections: (config.modules || []).length,
    partsByRole: byRole,
  };
}
function prettyRole(role) {
  return {
    side: "Side Panel", top: "Top Panel", bottom: "Bottom Panel", back: "Back Panel",
    plinth: "Plinth", divider: "Divider", shelf: "Shelf", door: "Door", drawerFront: "Drawer Front",
  }[role] || role;
}
function csv(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
