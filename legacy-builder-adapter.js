(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LegacyBuilderAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MM_PER_CM = 10;
  const LEGACY_LIMITS = Object.freeze({
    widthMm: [1200, 3600], heightMm: [1800, 2800], depthMm: [400, 800],
    sections: [1, 6], shelvesPerSection: [0, 6], drawerRowsPerSection: [0, 8],
  });
  const SUPPORTED_COMPONENTS = new Set(["SHELF", "DRAWER_BANK", "HANGING_RAIL", "DOOR"]);

  class LegacyBuilderAdapterError extends Error {
    constructor(code, message) { super(message); this.name = "LegacyBuilderAdapterError"; this.code = code; }
  }
  function fail(code, message) { throw new LegacyBuilderAdapterError(code, message); }
  function integer(value, field) {
    if (!Number.isInteger(value)) fail("INVALID_MODEL", `${field} must be an integer.`);
    return value;
  }
  function bounded(value, field, bounds) {
    integer(value, field);
    if (value < bounds[0] || value > bounds[1]) fail("UNSUPPORTED_VALUE", `${field} must be between ${bounds[0]} and ${bounds[1]}.`);
    return value;
  }
  function mmToCm(value, field) { integer(value, field); return value / MM_PER_CM; }
  function validateIdentity(model) {
    if (typeof model.id !== "string" || !model.id) fail("INVALID_MODEL", "model.id is required.");
    integer(model.revision, "model.revision");
    if (model.revision < 1) fail("INVALID_MODEL", "model.revision must be positive.");
  }
  function mapSection(section, index, model, seenIds) {
    if (!section || typeof section !== "object" || !Array.isArray(section.components)) fail("INVALID_MODEL", `sections[${index}] must contain a components array.`);
    if (typeof section.id !== "string" || !section.id) fail("INVALID_MODEL", `sections[${index}].id is required.`);
    if (seenIds.has(section.id)) fail("INVALID_MODEL", `Duplicate canonical ID "${section.id}".`);
    seenIds.add(section.id);
    integer(section.widthMm, `sections[${index}].widthMm`);
    if (section.widthMm <= 0) fail("INVALID_MODEL", `sections[${index}].widthMm must be positive.`);
    let shelves = 0, drawers = 0, drawerBanks = 0;
    for (const component of section.components) {
      if (!component || !SUPPORTED_COMPONENTS.has(component.type)) fail("UNSUPPORTED_COMPONENT", `Component type "${component?.type}" cannot be represented by the legacy builder.`);
      if (typeof component.id !== "string" || !component.id || seenIds.has(component.id)) fail("INVALID_MODEL", "Every canonical component must have a unique ID.");
      seenIds.add(component.id);
      integer(component.positionMm, `${component.id}.positionMm`);
      integer(component.heightMm, `${component.id}.heightMm`);
      const interiorHeightMm = model.heightMm - 2 * model.panelThicknessMm;
      if (component.positionMm < 0 || component.heightMm < 0 || component.positionMm + component.heightMm > interiorHeightMm) {
        fail("INVALID_MODEL", `Component "${component.id}" does not fit inside the wardrobe.`);
      }
      if (component.type === "SHELF") shelves += 1;
      if (component.type === "DRAWER_BANK") {
        drawerBanks += 1;
        drawers += bounded(component.rows, `${component.id || "DRAWER_BANK"}.rows`, LEGACY_LIMITS.drawerRowsPerSection);
      }
    }
    if (drawerBanks > 1) fail("UNSUPPORTED_LAYOUT", `Section "${section.id}" has multiple drawer banks; the legacy renderer supports one bank per section.`);
    bounded(shelves, `sections[${index}].shelves`, LEGACY_LIMITS.shelvesPerSection);
    return Object.freeze({ sectionId: section.id, shelves, drawers });
  }

  function wardrobeModelToLegacyConfiguration(model, currentConfiguration) {
    if (!model || typeof model !== "object" || Array.isArray(model)) fail("INVALID_MODEL", "A canonical Wardrobe Model is required.");
    validateIdentity(model);
    bounded(model.widthMm, "widthMm", LEGACY_LIMITS.widthMm);
    bounded(model.heightMm, "heightMm", LEGACY_LIMITS.heightMm);
    bounded(model.depthMm, "depthMm", LEGACY_LIMITS.depthMm);
    if (!Array.isArray(model.sections)) fail("INVALID_MODEL", "model.sections must be an array.");
    bounded(model.sections.length, "sections.length", LEGACY_LIMITS.sections);
    integer(model.panelThicknessMm, "panelThicknessMm");
    if (model.panelThicknessMm <= 0) fail("INVALID_MODEL", "panelThicknessMm must be positive.");
    const seenIds = new Set([model.id]);
    const sectionLayouts = model.sections.map((section, index) => mapSection(section, index, model, seenIds));
    const expectedSectionWidth = model.widthMm - (model.sections.length + 1) * model.panelThicknessMm;
    const actualSectionWidth = model.sections.reduce((sum, section) => sum + section.widthMm, 0);
    if (actualSectionWidth !== expectedSectionWidth) fail("INVALID_MODEL", "Canonical section widths do not fit the wardrobe width.");
    const current = currentConfiguration && typeof currentConfiguration === "object" ? currentConfiguration : {};
    return {
      ...current, type: "wardrobe", name: current.name || "AI Wardrobe",
      w: mmToCm(model.widthMm, "widthMm"), h: mmToCm(model.heightMm, "heightMm"), d: mmToCm(model.depthMm, "depthMm"),
      sections: model.sections.length,
      shelves: Math.max(0, ...sectionLayouts.map((section) => section.shelves)),
      drawers: Math.max(0, ...sectionLayouts.map((section) => section.drawers)),
      sectionLayouts, canonicalWardrobeId: model.id, canonicalRevision: model.revision,
    };
  }

  function applyWardrobeModelToBuilder(builder, model) {
    if (!builder || typeof builder.applyConfiguration !== "function") fail("INVALID_BUILDER", "Builder.applyConfiguration is required.");
    const configuration = wardrobeModelToLegacyConfiguration(model, builder.cfg);
    return builder.applyConfiguration(configuration);
  }

  return Object.freeze({ LEGACY_LIMITS, LegacyBuilderAdapterError, mmToCm, wardrobeModelToLegacyConfiguration, applyWardrobeModelToBuilder });
});
