/**
 * validator — basic physical validation for a WardrobeModel.
 * ---------------------------------------------------------------------
 * Deliberately not a full engineering validator (compare
 * production-engine/furniai_engine/inspector.py's nine gates, which is what
 * a real manufacturing release needs). This is Milestone 5's "fundamental
 * geometry" scope only: dimensions, section fit, component containment,
 * overlap. Called by the tool layer after every mutation, and independently
 * testable/adversarial-testable on its own.
 *
 * @returns {{ code: string, message: string, sectionId?: string, componentId?: string }[]}
 *   Empty array = valid. Never throws.
 */
import { COMPONENT_TYPES, ZONE_COMPONENT_TYPES } from "./schema.js";

export function validateWardrobeModel(model) {
  const issues = [];

  if (!(model.widthMm > 0)) issues.push({ code: "INVALID_DIMENSION", message: "widthMm must be > 0." });
  if (!(model.heightMm > 0)) issues.push({ code: "INVALID_DIMENSION", message: "heightMm must be > 0." });
  if (!(model.depthMm > 0)) issues.push({ code: "INVALID_DIMENSION", message: "depthMm must be > 0." });
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

  for (const section of model.sections) {
    noteId(section.id, "section");
    if (!(section.widthMm > 0)) {
      issues.push({ code: "INVALID_DIMENSION", sectionId: section.id, message: "Section width must be > 0." });
    }

    const zoneComponents = section.components.filter((c) => ZONE_COMPONENT_TYPES.includes(c.type));
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
    // doors carry stable IDs too, just not zone-checked against shelves/rails/drawers
    for (const component of section.components.filter((c) => c.type === COMPONENT_TYPES.DOOR)) {
      noteId(component.id, "component");
    }
  }

  return issues;
}
