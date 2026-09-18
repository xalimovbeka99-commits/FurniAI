/**
 * validator — basic physical validation for a WardrobeModel.
 * ---------------------------------------------------------------------
 * Deliberately not a full engineering validator (compare
 * production-engine/furniai_engine/inspector.py's nine gates, which is what
 * a real manufacturing release needs). This is Milestone 5's "fundamental
 * geometry" scope only: dimensions, section fit, component containment,
 * overlap, plus fail-closed manufacturability gates (hanging clearance,
 * shelf span, shelf spacing, panel-thickness envelope). Called by the tool
 * layer after every mutation, and independently testable/adversarial-testable
 * on its own.
 *
 * @returns {{ code: string, message: string, sectionId?: string, componentId?: string }[]}
 *   Empty array = valid. Never throws.
 */
import { COMPONENT_TYPES, ZONE_COMPONENT_TYPES, DEFAULTS } from "./schema.js";

export function validateWardrobeModel(model) {
  const issues = [];

  if (!(model.widthMm > 0)) issues.push({ code: "INVALID_DIMENSION", message: "widthMm must be > 0." });
  if (!(model.heightMm > 0)) issues.push({ code: "INVALID_DIMENSION", message: "heightMm must be > 0." });
  if (!(model.depthMm > 0)) issues.push({ code: "INVALID_DIMENSION", message: "depthMm must be > 0." });
  if (!(model.panelThicknessMm > 0)) {
    issues.push({ code: "INVALID_DIMENSION", message: "panelThicknessMm must be > 0." });
  } else if (model.panelThicknessMm > DEFAULTS.maxPanelThicknessMm) {
    issues.push({
      code: "INVALID_DIMENSION",
      message: `panelThicknessMm must be <= ${DEFAULTS.maxPanelThicknessMm}mm (got ${model.panelThicknessMm}).`,
    });
  }
  if (issues.length > 0) return issues; // nothing below is meaningful without valid outer dimensions

  const seenIds = new Map();
  const noteId = (id, kind) => {
    if (seenIds.has(id)) {
      issues.push({ code: "DUPLICATE_ID", message: `ID "${id}" is used by more than one ${kind}.` });
    }
    seenIds.set(id, kind);
  };
  noteId(model.id, "model");

  if (!Array.isArray(model.sections) || model.sections.length === 0) {
    issues.push({ code: "NO_SECTIONS", message: "A wardrobe must have at least one section." });
    return issues;
  }

  // Section widths are clear-opening widths; the two outer side panels and
  // every inter-section divider also consume real width, so sections sum to
  // less than the wardrobe's own outer width — see kernel.js's
  // availableSectionWidth(), which this mirrors exactly.
  const totalSectionWidth = model.sections.reduce((sum, s) => sum + s.widthMm, 0);
  const dividerCount = Math.max(0, model.sections.length - 1);
  const expectedTotal = model.widthMm - 2 * model.panelThicknessMm - dividerCount * model.panelThicknessMm;
  if (Math.abs(totalSectionWidth - expectedTotal) > 0.5) {
    issues.push({
      code: "SECTION_WIDTH_MISMATCH",
      message: `Sections total ${totalSectionWidth}mm but ${expectedTotal}mm is available (wardrobe ${model.widthMm}mm minus side panels and ${dividerCount} divider(s)).`,
    });
  }

  const interiorHeight = model.heightMm - 2 * model.panelThicknessMm;
  // Interior clear depth for hangers: outer depth minus rear back thickness.
  const interiorDepthMm = model.depthMm - DEFAULTS.backThicknessMm;

  for (const section of model.sections) {
    noteId(section.id, "section");
    if (!(section.widthMm > 0)) {
      issues.push({ code: "INVALID_DIMENSION", sectionId: section.id, message: "Section width must be > 0." });
    }

    const zoneComponents = section.components.filter((c) => ZONE_COMPONENT_TYPES.includes(c.type));
    const hangingRails = zoneComponents.filter((c) => c.type === COMPONENT_TYPES.HANGING_RAIL);
    const shelves = zoneComponents.filter((c) => c.type === COMPONENT_TYPES.SHELF);

    const drawerBanks = zoneComponents.filter((c) => c.type === COMPONENT_TYPES.DRAWER_BANK);
    // Strictly greater: at exactly the sum the drawer back is 0mm wide.
    if (drawerBanks.length > 0 && section.widthMm <= DEFAULTS.minDrawerBayClearWidthMm) {
      for (const bank of drawerBanks) {
        issues.push({
          code: "INSUFFICIENT_BAY_WIDTH_FOR_DRAWERS",
          sectionId: section.id,
          componentId: bank.id,
          message: `Bay clear width ${section.widthMm}mm cannot accommodate undermount deduction and drawer box side walls (need > ${DEFAULTS.minDrawerBayClearWidthMm}mm).`,
        });
      }
    }

    for (const component of zoneComponents) {
      noteId(component.id, "component");
      if (component.positionMm < -0.001 || component.positionMm + component.heightMm > interiorHeight + 0.5) {
        issues.push({
          code: "COMPONENT_OUTSIDE_SECTION",
          sectionId: section.id,
          componentId: component.id,
          message: `Component "${component.id}" (${component.positionMm}-${component.positionMm + component.heightMm}mm) does not fit inside the ${interiorHeight}mm interior height.`,
        });
      }
    }

    // pairwise overlap among zone components in the same section
    for (let i = 0; i < zoneComponents.length; i++) {
      for (let j = i + 1; j < zoneComponents.length; j++) {
        const a = zoneComponents[i], b = zoneComponents[j];
        const overlap = Math.min(a.positionMm + a.heightMm, b.positionMm + b.heightMm) - Math.max(a.positionMm, b.positionMm);
        if (overlap > 0.5) {
          issues.push({
            code: "COMPONENT_OVERLAP",
            sectionId: section.id,
            componentId: a.id,
            message: `Component "${a.id}" and "${b.id}" overlap by ${overlap.toFixed(1)}mm.`,
          });
        }
      }
    }

    // Shelf-to-shelf clear spacing between vertically adjacent shelves only.
    // Reject when clear gap < minShelfClearanceMm (60). Gaps of 60-99mm remain
    // permissible. Touching / sub-60 gaps fail-closed.
    const shelvesByZ = [...shelves].sort((a, b) => a.positionMm - b.positionMm);
    for (let i = 0; i < shelvesByZ.length - 1; i++) {
      const lower = shelvesByZ[i];
      const upper = shelvesByZ[i + 1];
      const clearGap = upper.positionMm - (lower.positionMm + lower.heightMm);
      if (clearGap < DEFAULTS.minShelfClearanceMm - 0.001) {
        // Overlap (negative gap) is also reported as COMPONENT_OVERLAP above;
        // still emit clearance when the gap is non-overlapping but too tight,
        // and when touching (gap ~= 0).
        if (clearGap > -0.5) {
          issues.push({
            code: "INSUFFICIENT_SHELF_CLEARANCE",
            sectionId: section.id,
            componentId: upper.id,
            message: `Shelves "${lower.id}" and "${upper.id}" have only ${clearGap.toFixed(1)}mm clear spacing (need >= ${DEFAULTS.minShelfClearanceMm}mm).`,
          });
        }
      }
    }

    // Unsupported continuous shelf span without a vertical partition
    // (partitions = section boundaries / dividers).
    if (shelves.length > 0 && section.widthMm > DEFAULTS.maxUnsupportedShelfSpanMm) {
      for (const shelf of shelves) {
        issues.push({
          code: "UNSUPPORTED_SHELF_SPAN",
          sectionId: section.id,
          componentId: shelf.id,
          message: `Shelf span ${section.widthMm}mm exceeds ${DEFAULTS.maxUnsupportedShelfSpanMm}mm without a vertical partition.`,
        });
      }
    }

    // Hanging rod depth floor: interior depth must clear hangers.
    if (hangingRails.length > 0 && interiorDepthMm < DEFAULTS.minHangingInteriorDepthMm) {
      for (const rail of hangingRails) {
        issues.push({
          code: "INSUFFICIENT_DEPTH_FOR_HANGING",
          sectionId: section.id,
          componentId: rail.id,
          message: `Bay interior depth ${interiorDepthMm}mm is below the ${DEFAULTS.minHangingInteriorDepthMm}mm hanging-rod floor.`,
        });
      }
    }

    // Hanging clearance: vertical clear drop from rod centre to the next
    // obstruction below (another zone component top, or the interior floor).
    for (const rail of hangingRails) {
      const rodCenterMm = rail.positionMm + rail.heightMm / 2;
      let obstructionTop = 0;
      for (const other of zoneComponents) {
        if (other.id === rail.id) continue;
        const top = other.positionMm + other.heightMm;
        if (top <= rodCenterMm + 0.5) {
          obstructionTop = Math.max(obstructionTop, top);
        }
      }
      const clearanceBelow = rodCenterMm - obstructionTop;
      if (clearanceBelow < DEFAULTS.minHangingClearanceBelowMm) {
        issues.push({
          code: "INSUFFICIENT_HANGING_CLEARANCE",
          sectionId: section.id,
          componentId: rail.id,
          message: `Hanging rail "${rail.id}" has only ${clearanceBelow.toFixed(1)}mm clearance below rod centre (need >= ${DEFAULTS.minHangingClearanceBelowMm}mm).`,
        });
      }
    }

    // doors carry stable IDs too, just not zone-checked against shelves/rails/drawers
    for (const component of section.components.filter((c) => c.type === COMPONENT_TYPES.DOOR)) {
      noteId(component.id, "component");
    }
  }

  return issues;
}