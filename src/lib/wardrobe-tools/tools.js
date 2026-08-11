/**
 * tools — the eight deterministic wardrobe modeling tools.
 * ---------------------------------------------------------------------
 * This is the ONLY surface the LLM is allowed to mutate a WardrobeModel
 * through (see src/lib/wardrobe-agent/runWardrobeAgent.js). Every tool
 * follows the same sequence:
 *
 *   validate request -> execute tool (kernel) -> validate resulting
 *   wardrobe -> commit model revision
 *
 * On success: { success: true, model, revision, ...tool-specific fields }.
 * On failure: { success: false, error: "CODE", message }. The model field is
 * absent on failure — callers keep using whatever model they already had,
 * since kernel functions never mutate their input and a failed validation
 * never gets committed. Arguments are never silently coerced into something
 * valid; a bad request fails with a typed error instead.
 *
 * Strict schemas: every inputSchema below declares `additionalProperties:
 * false`. Anthropic's API does not enforce this itself (it only uses the
 * schema to guide the model), so `checkSchemaShape` re-checks it at
 * execution time — an unknown or forbidden argument (e.g. a raw
 * `threeJsPosition`/`x`/`y`/`z`) is rejected with INVALID_TOOL_ARGUMENTS
 * before the kernel ever sees it.
 *
 * ID ownership: IDs are kernel-allocated (src/lib/wardrobe-model/ids.js),
 * not caller-supplied. See docs/KNOWN_LIMITATIONS.md for the explicit,
 * deliberate trade-off record against Codex's caller-supplied-ID contract
 * suggestion (tests/wardrobe-ai/fixtures/tool-contracts.json).
 */
import * as kernel from "../wardrobe-model/kernel.js";
import { validateWardrobeModel } from "../wardrobe-model/validator.js";
import { COMPONENT_TYPES, ADDABLE_COMPONENT_TYPES } from "../wardrobe-model/schema.js";

function invalid(message) {
  return { success: false, error: "INVALID_ARGUMENT", message };
}

/** additionalProperties:false + required-field enforcement, one level deep
 * (covers component_update's nested `properties` object). Returns a failure
 * result, or null if the input shape is acceptable. */
function checkSchemaShape(input, schema) {
  const value = input === undefined || input === null ? {} : input;
  if (typeof value !== "object" || Array.isArray(value)) {
    return { success: false, error: "INVALID_TOOL_ARGUMENTS", message: "Arguments must be an object." };
  }
  const allowed = new Set(Object.keys(schema.properties || {}));
  const extra = Object.keys(value).filter((k) => !allowed.has(k));
  if (extra.length > 0) {
    return { success: false, error: "INVALID_TOOL_ARGUMENTS", message: `Unknown argument(s): ${extra.join(", ")}.` };
  }
  for (const key of schema.required || []) {
    if (!(key in value)) {
      return { success: false, error: "INVALID_TOOL_ARGUMENTS", message: `Missing required argument "${key}".` };
    }
  }
  for (const [key, sub] of Object.entries(schema.properties || {})) {
    if (sub.type === "object" && value[key] !== undefined) {
      const nested = checkSchemaShape(value[key], sub);
      if (nested) return nested;
    }
  }
  return null;
}

/** Runs a kernel mutation, validates the result, and commits (bumps
 * revision) only if both the kernel call and the resulting model are valid.
 * `mutate` may return a bare model, or `{ model, ...extra }` for the kernel
 * functions (moveComponent) that also report something about the edit. */
function commit(model, mutate) {
  let raw;
  try {
    raw = mutate();
  } catch (err) {
    if (err instanceof kernel.KernelError) {
      return { success: false, error: err.code, message: err.message };
    }
    throw err;
  }
  const hasExtra = raw && typeof raw === "object" && "model" in raw;
  const nextModel = hasExtra ? raw.model : raw;
  const extra = hasExtra ? Object.fromEntries(Object.entries(raw).filter(([k]) => k !== "model")) : {};

  const issues = validateWardrobeModel(nextModel);
  if (issues.length > 0) {
    return { success: false, error: issues[0].code, message: issues[0].message, issues };
  }

  const { _newSectionId, _newComponentId, ...clean } = nextModel;
  const committed = { ...clean, revision: model.revision + 1 };
  return {
    success: true,
    ...extra,
    ...(_newSectionId ? { sectionId: _newSectionId } : {}),
    ...(_newComponentId ? { componentId: _newComponentId } : {}),
    model: committed,
    revision: committed.revision,
  };
}

function findComponent(model, componentId) {
  for (const section of model.sections) {
    const found = section.components.find((c) => c.id === componentId);
    if (found) return found;
  }
  return null;
}

function componentProperties(component) {
  if (!component) return undefined;
  const { rows, leaves, hingeSide } = component;
  return { rows, leaves, hingeSide };
}

function wardrobeCreate(_model, input = {}) {
  let model;
  try {
    model = kernel.createWardrobe(input);
  } catch (err) {
    if (err instanceof kernel.KernelError) return { success: false, error: err.code, message: err.message };
    throw err;
  }
  const issues = validateWardrobeModel(model);
  if (issues.length > 0) {
    return { success: false, error: issues[0].code, message: issues[0].message, issues };
  }
  return { success: true, model, revision: model.revision };
}

function wardrobeResize(model, input = {}) {
  const oldDimensionsMm = { widthMm: model.widthMm, heightMm: model.heightMm, depthMm: model.depthMm };
  const result = commit(model, () => kernel.resizeWardrobe(model, input));
  if (!result.success) return result;
  return {
    ...result,
    wardrobeId: result.model.id,
    oldDimensionsMm,
    newDimensionsMm: { widthMm: result.model.widthMm, heightMm: result.model.heightMm, depthMm: result.model.depthMm },
  };
}

function sectionAdd(model, input = {}) {
  return commit(model, () => kernel.addSection(model, input));
}

function sectionResize(model, input = {}) {
  const before = model.sections.find((s) => s.id === input.sectionId);
  const result = commit(model, () => kernel.resizeSection(model, input));
  if (!result.success) return result;
  const after = result.model.sections.find((s) => s.id === input.sectionId);
  return {
    ...result,
    sectionId: input.sectionId,
    oldWidthMm: before ? before.widthMm : undefined,
    newWidthMm: after ? after.widthMm : undefined,
  };
}

function componentAdd(model, input = {}) {
  if (!ADDABLE_COMPONENT_TYPES.includes(input.type) && input.type !== COMPONENT_TYPES.DIVIDER) {
    return invalid(`type must be one of: ${ADDABLE_COMPONENT_TYPES.join(", ")}.`);
  }
  return commit(model, () => kernel.addComponent(model, input));
}

function componentMove(model, input = {}) {
  const result = commit(model, () => kernel.moveComponent(model, input));
  if (!result.success) return result;
  return { ...result, componentId: input.componentId };
}

function componentRemove(model, input = {}) {
  const result = commit(model, () => kernel.removeComponent(model, input));
  if (!result.success) return result;
  return { ...result, componentId: input.componentId };
}

function componentUpdate(model, input = {}) {
  const before = componentProperties(findComponent(model, input.componentId));
  const result = commit(model, () => kernel.updateComponent(model, { componentId: input.componentId, properties: input.properties }));
  if (!result.success) return result;
  const after = componentProperties(findComponent(result.model, input.componentId));
  return { ...result, componentId: input.componentId, oldProperties: before, newProperties: after };
}

/** Wraps a tool definition's `run` with the strict-schema check, so every
 * tool enforces additionalProperties:false the same way, in one place. */
function defineTool({ name, description, inputSchema, run }) {
  return {
    name,
    description,
    inputSchema,
    run(model, input) {
      const schemaError = checkSchemaShape(input, inputSchema);
      if (schemaError) return schemaError;
      return run(model, input);
    },
  };
}

/** Tool registry: name, human/LLM-facing description, JSON Schema for the
 * arguments, and the deterministic `run(model, input)` implementation. */
export const WARDROBE_TOOLS = [
  defineTool({
    name: "wardrobe_create",
    description: "Create a brand-new wardrobe with the given overall dimensions, replacing any wardrobe currently being edited. Use this only to start over.",
    inputSchema: {
      type: "object",
      properties: {
        widthMm: { type: "integer", description: "Overall outer width in whole millimetres, 300-6000." },
        heightMm: { type: "integer", description: "Overall outer height in whole millimetres, 300-3000." },
        depthMm: { type: "integer", description: "Overall outer depth in whole millimetres, 200-1200." },
      },
      required: ["widthMm", "heightMm", "depthMm"],
      additionalProperties: false,
    },
    run: wardrobeCreate,
  }),
  defineTool({
    name: "wardrobe_resize",
    description: "Resize the current wardrobe's overall width, height, and/or depth. Existing sections are proportionally rescaled to fit a new width.",
    inputSchema: {
      type: "object",
      properties: {
        widthMm: { type: "integer" },
        heightMm: { type: "integer" },
        depthMm: { type: "integer" },
      },
      additionalProperties: false,
    },
    run: wardrobeResize,
  }),
  defineTool({
    name: "section_add",
    description: "Add a new vertical section (bay) of the given width. Existing sections are proportionally shrunk to make room. Omit afterSectionId to append at the right end.",
    inputSchema: {
      type: "object",
      properties: {
        widthMm: { type: "integer", description: "The new section's clear opening width in whole millimetres." },
        afterSectionId: { type: "string", description: "Insert immediately after this section's id. Omit to append at the end." },
      },
      required: ["widthMm"],
      additionalProperties: false,
    },
    run: sectionAdd,
  }),
  defineTool({
    name: "section_resize",
    description: "Resize one existing section to an exact width. The other sections proportionally give up or gain the difference so the total is unchanged.",
    inputSchema: {
      type: "object",
      properties: {
        sectionId: { type: "string" },
        widthMm: { type: "integer" },
      },
      required: ["sectionId", "widthMm"],
      additionalProperties: false,
    },
    run: sectionResize,
  }),
  defineTool({
    name: "component_add",
    description: "Add a component to a section: SHELF, DRAWER_BANK, HANGING_RAIL, or DOOR. If positionMm is omitted, the component is stacked on top of the highest existing component in that section.",
    inputSchema: {
      type: "object",
      properties: {
        sectionId: { type: "string" },
        type: { type: "string", enum: [...ADDABLE_COMPONENT_TYPES, COMPONENT_TYPES.DIVIDER] },
        positionMm: { type: "integer", description: "Height from the section's interior floor, in whole millimetres. Optional." },
        rows: { type: "integer", description: "DRAWER_BANK only: 1-8 drawer rows." },
        leaves: { type: "integer", description: "DOOR only: 1-4 door leaves." },
        hingeSide: { type: "string", enum: ["left", "right"], description: "DOOR only." },
      },
      required: ["sectionId", "type"],
      additionalProperties: false,
    },
    run: componentAdd,
  }),
  defineTool({
    name: "component_move",
    description: "Move an existing SHELF, DRAWER_BANK, or HANGING_RAIL vertically by an exact delta in millimetres. Doors cannot be moved. Only the \"z\" (vertical) axis is supported.",
    inputSchema: {
      type: "object",
      properties: {
        componentId: { type: "string" },
        axis: { type: "string", enum: ["z"] },
        deltaMm: { type: "integer", description: "Positive moves up, negative moves down." },
      },
      required: ["componentId", "axis", "deltaMm"],
      additionalProperties: false,
    },
    run: componentMove,
  }),
  defineTool({
    name: "component_remove",
    description: "Remove a component by id.",
    inputSchema: {
      type: "object",
      properties: { componentId: { type: "string" } },
      required: ["componentId"],
      additionalProperties: false,
    },
    run: componentRemove,
  }),
  defineTool({
    name: "component_update",
    description: "Update a mutable property on an existing component: rows (DRAWER_BANK) or leaves/hingeSide (DOOR).",
    inputSchema: {
      type: "object",
      properties: {
        componentId: { type: "string" },
        properties: {
          type: "object",
          properties: {
            rows: { type: "integer" },
            leaves: { type: "integer" },
            hingeSide: { type: "string", enum: ["left", "right"] },
          },
          additionalProperties: false,
        },
      },
      required: ["componentId", "properties"],
      additionalProperties: false,
    },
    run: componentUpdate,
  }),
];

export function findTool(name) {
  return WARDROBE_TOOLS.find((t) => t.name === name) || null;
}
