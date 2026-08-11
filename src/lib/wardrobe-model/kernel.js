/**
 * kernel — the deterministic Wardrobe Modeling Kernel.
 * ---------------------------------------------------------------------
 * Pure functions only. No LLM calls, no I/O, no randomness, no wall-clock
 * reads. Given identical input, every function here returns byte-identical
 * output — that is the whole anti-hallucination guarantee this layer exists
 * to provide (see kernel.test.js's 100-run determinism check).
 *
 * Every exported function either returns a brand-new model object (the
 * input is never mutated) or throws a KernelError with a stable `code`.
 * Revisioning ("commit model revision") is deliberately NOT done here — it
 * is the tool layer's job (src/lib/wardrobe-tools/tools.js), which only
 * bumps `revision` after the *resulting* model has also passed the
 * validator. That keeps "compute the new geometry" and "commit the edit"
 * as separate, individually testable steps, matching the required sequence:
 *   validate request -> execute tool -> validate resulting wardrobe -> commit
 *
 * Integer-millimetre contract: every canonical dimension/position/delta is
 * an exact integer. Fractional input (e.g. 700.5) is REJECTED, never
 * silently rounded — see assertIntegerMm below.
 */
import { allocate } from "./ids.js";
import { COMPONENT_TYPES, ADDABLE_COMPONENT_TYPES, DEFAULTS, zoneHeightMm } from "./schema.js";

export class KernelError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = "KernelError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new KernelError(code, message);
}

/** Every widthMm/heightMm/depthMm/positionMm/deltaMm value in the canonical
 * model must be an exact integer millimetre. Rejects non-finite, fractional,
 * and out-of-range input with the same code — this is Phase 1's "prefer
 * rejection over silent rounding" contract, not a rounding utility. */
function assertIntegerMm(value, field, { min, max } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) fail("INVALID_DIMENSION", `${field} must be a finite number.`);
  if (!Number.isInteger(n)) fail("INVALID_DIMENSION", `${field} must be an integer millimetre value, not ${n}.`);
  if (min !== undefined && n < min) fail("INVALID_DIMENSION", `${field} must be >= ${min}mm (got ${n}).`);
  if (max !== undefined && n > max) fail("INVALID_DIMENSION", `${field} must be <= ${max}mm (got ${n}).`);
  return n;
}

/** Same integer contract for non-millimetre bounded counts (rows, leaves) —
 * a distinct code (OUT_OF_RANGE) since these are not canonical dimensions. */
function assertIntegerCount(value, field, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) fail("OUT_OF_RANGE", `${field} must be an integer.`);
  if (n < min || n > max) fail("OUT_OF_RANGE", `${field} must be between ${min} and ${max} (got ${n}).`);
  return n;
}

function findSectionIndex(model, sectionId) {
  const i = model.sections.findIndex((s) => s.id === sectionId);
  if (i === -1) fail("SECTION_NOT_FOUND", `No section with id "${sectionId}".`);
  return i;
}

/** How much width is actually left for section content once the two outer
 * side panels and every inter-section divider have taken their share. This
 * mirrors buildGeometry.js's own `clearBayWidth = interiorW - dividerCount*T`
 * exactly (see docs/WARDROBE_MODEL_SCHEMA.md) — section widths are clear
 * opening widths, not a raw fraction of the outer wardrobe width, because
 * the dividers between them are real material, not free. */
function availableSectionWidth(model, sectionCount) {
  const dividerCount = Math.max(0, sectionCount - 1);
  return model.widthMm - 2 * model.panelThicknessMm - dividerCount * model.panelThicknessMm;
}

function findComponentLocation(model, componentId) {
  for (let si = 0; si < model.sections.length; si++) {
    const ci = model.sections[si].components.findIndex((c) => c.id === componentId);
    if (ci !== -1) return { sectionIndex: si, componentIndex: ci };
  }
  fail("COMPONENT_NOT_FOUND", `No component with id "${componentId}".`);
}

// --------------------------------------------------------------- wardrobe
/** @returns {import('./schema.js').WardrobeModel} */
export function createWardrobe({ widthMm, heightMm, depthMm } = {}) {
  const width = assertIntegerMm(widthMm, "widthMm", { min: DEFAULTS.minWardrobeWidthMm, max: DEFAULTS.maxWardrobeWidthMm });
  const height = assertIntegerMm(heightMm, "heightMm", { min: DEFAULTS.minWardrobeHeightMm, max: DEFAULTS.maxWardrobeHeightMm });
  const depth = assertIntegerMm(depthMm, "depthMm", { min: DEFAULTS.minWardrobeDepthMm, max: DEFAULTS.maxWardrobeDepthMm });

  let model = {
    id: null,
    revision: 1,
    widthMm: width,
    heightMm: height,
    depthMm: depth,
    panelThicknessMm: DEFAULTS.panelThicknessMm,
    sections: [],
    idCounters: {},
  };
  const w = allocate(model, "wardrobe");
  model = { ...model, id: w.id, idCounters: w.idCounters };
  const s = allocate(model, "section");
  model = {
    ...model,
    idCounters: s.idCounters,
    sections: [{ id: s.id, widthMm: availableSectionWidth(model, 1), components: [] }],
  };
  return model;
}

/** Resizing the wardrobe's width proportionally rescales every section so
 * the sections always sum to the new width — the same "give the rounding
 * crumb to the last one" pattern used throughout this codebase (see
 * buildGeometry.js's overlay math). Height/depth resize does not touch
 * sections at all. This is documented, deterministic recompute, not a
 * silent fix of bad input — see docs/TOOL_CONTRACTS.md. */
export function resizeWardrobe(model, { widthMm, heightMm, depthMm } = {}) {
  let next = { ...model };
  if (widthMm !== undefined) {
    const width = assertIntegerMm(widthMm, "widthMm", { min: DEFAULTS.minWardrobeWidthMm, max: DEFAULTS.maxWardrobeWidthMm });
    const currentTotal = model.sections.reduce((sum, s) => sum + s.widthMm, 0) || 1;
    const newAvailable = availableSectionWidth({ ...model, widthMm: width }, model.sections.length);
    const scale = newAvailable / currentTotal;
    const rescaled = model.sections.map((s) => Math.max(DEFAULTS.minSectionWidthMm, Math.round(s.widthMm * scale)));
    const drift = newAvailable - rescaled.reduce((a, b) => a + b, 0);
    rescaled[rescaled.length - 1] += drift;
    if (rescaled.some((w) => w < DEFAULTS.minSectionWidthMm)) {
      fail("SECTION_TOO_NARROW", "Resizing to this width would push a section below the minimum manufacturable width.");
    }
    next = {
      ...next,
      widthMm: width,
      sections: model.sections.map((s, i) => ({ ...s, widthMm: rescaled[i] })),
    };
  }
  if (heightMm !== undefined) {
    next.heightMm = assertIntegerMm(heightMm, "heightMm", { min: DEFAULTS.minWardrobeHeightMm, max: DEFAULTS.maxWardrobeHeightMm });
  }
  if (depthMm !== undefined) {
    next.depthMm = assertIntegerMm(depthMm, "depthMm", { min: DEFAULTS.minWardrobeDepthMm, max: DEFAULTS.maxWardrobeDepthMm });
  }
  return next;
}

// ---------------------------------------------------------------- section
/** A new section always makes room for itself: the existing sections are
 * proportionally shrunk (by their own current width) so the wardrobe never
 * passes through an intermediate state where sections don't sum to the
 * wardrobe's width — the same "always keep the invariant true" approach
 * resizeWardrobe/resizeSection use, so every kernel call, not just the
 * final one in a sequence, produces an independently valid model. */
export function addSection(model, { widthMm, afterSectionId } = {}) {
  const width = assertIntegerMm(widthMm, "widthMm", { min: DEFAULTS.minSectionWidthMm, max: model.widthMm });

  let insertAt = model.sections.length;
  if (afterSectionId != null) {
    insertAt = findSectionIndex(model, afterSectionId) + 1;
  }

  const existingTotal = model.sections.reduce((sum, s) => sum + s.widthMm, 0);
  // One more section means one more divider, which also eats into the
  // available width — the new total budget is smaller than the old one by
  // more than just the new section's own width.
  const newAvailable = availableSectionWidth(model, model.sections.length + 1);
  const targetExistingTotal = newAvailable - width;
  if (targetExistingTotal < 0) {
    fail("SECTION_WIDTHS_EXCEED_WARDROBE", `${width}mm leaves no room for the existing section(s).`);
  }

  let rescaled;
  if (model.sections.length === 0) {
    rescaled = [];
  } else {
    const scale = existingTotal > 0 ? targetExistingTotal / existingTotal : 0;
    rescaled = model.sections.map((s) => Math.max(1, Math.round(s.widthMm * scale)));
    const drift = targetExistingTotal - rescaled.reduce((a, b) => a + b, 0);
    rescaled[rescaled.length - 1] += drift;
    if (rescaled.some((w) => w < DEFAULTS.minSectionWidthMm)) {
      fail("SECTION_TOO_NARROW", "Adding this section would push an existing section below the minimum manufacturable width.");
    }
  }

  const alloc = allocate(model, "section");
  const newSection = { id: alloc.id, widthMm: width, components: [] };
  const shrunk = model.sections.map((s, i) => ({ ...s, widthMm: rescaled[i] }));
  const sections = [...shrunk];
  sections.splice(insertAt, 0, newSection);

  return { ...model, idCounters: alloc.idCounters, sections, _newSectionId: alloc.id };
}

/** Growing one section shrinks the others proportionally (by current width)
 * so the total always equals the wardrobe width — "make the left section
 * 700mm" redistributes the delta across the remaining sections rather than
 * silently changing the wardrobe's own overall width. */
export function resizeSection(model, { sectionId, widthMm } = {}) {
  const index = findSectionIndex(model, sectionId);
  const width = assertIntegerMm(widthMm, "widthMm", { min: DEFAULTS.minSectionWidthMm, max: model.widthMm });

  const others = model.sections.filter((_, i) => i !== index);
  const othersTotal = others.reduce((sum, s) => sum + s.widthMm, 0);
  const available = availableSectionWidth(model, model.sections.length);
  const targetOthersTotal = available - width;
  if (targetOthersTotal < 0) {
    fail("SECTION_WIDTHS_EXCEED_WARDROBE", `${width}mm leaves no room for the other section(s).`);
  }
  if (others.length === 0 && Math.abs(targetOthersTotal) > 0.5) {
    fail("SECTION_WIDTHS_EXCEED_WARDROBE", "The only section in a wardrobe must equal the wardrobe's own available width.");
  }

  let rescaledOthers;
  if (others.length === 0) {
    rescaledOthers = [];
  } else {
    const scale = othersTotal > 0 ? targetOthersTotal / othersTotal : 1 / others.length;
    rescaledOthers = others.map((s) =>
      Math.max(1, Math.round(othersTotal > 0 ? s.widthMm * scale : targetOthersTotal / others.length))
    );
    const drift = targetOthersTotal - rescaledOthers.reduce((a, b) => a + b, 0);
    rescaledOthers[rescaledOthers.length - 1] += drift;
    if (rescaledOthers.some((w) => w < DEFAULTS.minSectionWidthMm)) {
      fail("SECTION_TOO_NARROW", "Resizing this section would push another section below the minimum manufacturable width.");
    }
  }

  let otherCursor = 0;
  const sections = model.sections.map((s, i) => {
    if (i === index) return { ...s, widthMm: width };
    const w = rescaledOthers[otherCursor++];
    return { ...s, widthMm: w };
  });

  return { ...model, sections };
}

// -------------------------------------------------------------- component
function interiorHeightMm(model) {
  return model.heightMm - 2 * model.panelThicknessMm;
}

export function addComponent(model, { sectionId, type, positionMm, rows, leaves, hingeSide } = {}) {
  const sectionIndex = findSectionIndex(model, sectionId);
  const section = model.sections[sectionIndex];

  if (type === COMPONENT_TYPES.DIVIDER) {
    fail("NOT_IMPLEMENTED", "DIVIDER is generated automatically between sections and cannot be added directly.");
  }
  if (!ADDABLE_COMPONENT_TYPES.includes(type)) {
    fail("INVALID_ARGUMENT", `Unknown component type "${type}".`);
  }

  let fields = {};
  if (type === COMPONENT_TYPES.DRAWER_BANK) {
    fields.rows = rows === undefined ? 3 : assertIntegerCount(rows, "rows", DEFAULTS.minDrawerRows, DEFAULTS.maxDrawerRows);
  }
  if (type === COMPONENT_TYPES.DOOR) {
    fields.leaves = leaves === undefined ? 1 : assertIntegerCount(leaves, "leaves", DEFAULTS.minDoorLeaves, DEFAULTS.maxDoorLeaves);
    fields.hingeSide = hingeSide === "right" ? "right" : "left";
  }

  const heightMm = type === COMPONENT_TYPES.DOOR ? interiorHeightMm(model) : zoneHeightMm(type, fields);

  let position;
  if (positionMm !== undefined) {
    position = assertIntegerMm(positionMm, "positionMm", { min: 0, max: Math.max(0, interiorHeightMm(model) - heightMm) });
  } else if (type === COMPONENT_TYPES.DOOR) {
    position = 0;
  } else {
    // Auto-stack: sit on top of the highest existing zone component in this section.
    const zoneComponents = section.components.filter((c) => c.type !== COMPONENT_TYPES.DOOR);
    position = zoneComponents.reduce((top, c) => Math.max(top, c.positionMm + c.heightMm), 0);
  }

  const alloc = allocate(model, type);
  const component = { id: alloc.id, type, positionMm: position, heightMm, ...fields };
  const sections = model.sections.map((s, i) =>
    i === sectionIndex ? { ...s, components: [...s.components, component] } : s
  );

  return { ...model, idCounters: alloc.idCounters, sections, _newComponentId: alloc.id };
}

export function moveComponent(model, { componentId, axis, deltaMm } = {}) {
  if (axis !== "z") {
    fail("NOT_IMPLEMENTED", `Moving along axis "${axis}" is not supported yet; only "z" (vertical) is.`);
  }
  const delta = assertIntegerMm(deltaMm, "deltaMm");

  const { sectionIndex, componentIndex } = findComponentLocation(model, componentId);
  const component = model.sections[sectionIndex].components[componentIndex];
  if (component.type === COMPONENT_TYPES.DOOR) {
    fail("COMPONENT_NOT_MOVABLE", "A door spans its whole section and has no vertical position to move.");
  }

  const oldZ = component.positionMm;
  const newZ = oldZ + delta;

  const sections = model.sections.map((s, si) => {
    if (si !== sectionIndex) return s;
    return {
      ...s,
      components: s.components.map((c, ci) => (ci === componentIndex ? { ...c, positionMm: newZ } : c)),
    };
  });

  return { model: { ...model, sections }, oldZ, newZ };
}

export function removeComponent(model, { componentId } = {}) {
  const { sectionIndex, componentIndex } = findComponentLocation(model, componentId);
  const sections = model.sections.map((s, si) => {
    if (si !== sectionIndex) return s;
    return { ...s, components: s.components.filter((_, ci) => ci !== componentIndex) };
  });
  return { ...model, sections };
}

const UPDATABLE_FIELDS = Object.freeze({
  [COMPONENT_TYPES.DRAWER_BANK]: ["rows"],
  [COMPONENT_TYPES.DOOR]: ["leaves", "hingeSide"],
  [COMPONENT_TYPES.SHELF]: [],
  [COMPONENT_TYPES.HANGING_RAIL]: [],
});

/** `properties` is a partial patch — only the fields present are changed. */
export function updateComponent(model, { componentId, properties } = {}) {
  const { sectionIndex, componentIndex } = findComponentLocation(model, componentId);
  const component = model.sections[sectionIndex].components[componentIndex];
  const allowed = UPDATABLE_FIELDS[component.type] || [];
  const propertyKeys = Object.keys(properties || {});
  const rejected = propertyKeys.filter((k) => !allowed.includes(k));
  if (rejected.length > 0) {
    fail("INVALID_ARGUMENT", `${component.type} does not support updating: ${rejected.join(", ")}.`);
  }

  let next = { ...component };
  if ("rows" in properties) {
    next.rows = assertIntegerCount(properties.rows, "rows", DEFAULTS.minDrawerRows, DEFAULTS.maxDrawerRows);
    next.heightMm = zoneHeightMm(component.type, { rows: next.rows });
  }
  if ("leaves" in properties) {
    next.leaves = assertIntegerCount(properties.leaves, "leaves", DEFAULTS.minDoorLeaves, DEFAULTS.maxDoorLeaves);
  }
  if ("hingeSide" in properties) {
    if (properties.hingeSide !== "left" && properties.hingeSide !== "right") {
      fail("INVALID_ARGUMENT", 'hingeSide must be "left" or "right".');
    }
    next.hingeSide = properties.hingeSide;
  }

  const sections = model.sections.map((s, si) => {
    if (si !== sectionIndex) return s;
    return {
      ...s,
      components: s.components.map((c, ci) => (ci === componentIndex ? next : c)),
    };
  });

  return { ...model, sections };
}
