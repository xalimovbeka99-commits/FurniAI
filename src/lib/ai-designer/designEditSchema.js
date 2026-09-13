/**
 * FurniAI — Design-edit tool schema and strict model-output validation
 * ---------------------------------------------------------------------
 * The live model's ENTIRE authority is to propose values for the handful of
 * customer-facing intake facts listed below. It cannot emit a panel size, a
 * coordinate, a machining operation, an approval, or a fingerprint — those
 * are owned by the deterministic validator and kernel.
 *
 * Every value the model proposes is re-parsed by `parseAndValidateClarifyInput`,
 * the same validator a typed human answer goes through. A model that returns
 * "about 2 metres" or 1800.00001 is rejected exactly as a customer would be.
 */

import { parseAndValidateClarifyInput } from "../conversation/clarifyInput.js";
import { BAY_LAYOUT, REQUIRED_INTAKE_KEYS, SUPPORTED_FINISHES } from "../conversation/intakeModel.js";

export const DESIGN_EDIT_TOOL_NAME = "propose_design_edit";

/** The only keys a model may ever write. `materialKey` is the visual swatch. */
export const EDITABLE_KEYS = Object.freeze([...REQUIRED_INTAKE_KEYS, "materialKey"]);

/**
 * Substrings that must never appear in a model-proposed key. This is a
 * belt-and-braces guard behind the allow-list: if the allow-list is ever
 * widened carelessly, these still cannot get through.
 */
export const FORBIDDEN_KEY_PATTERNS = Object.freeze([
  /partgraph/i, /panel/i, /placement/i, /coordinate/i, /\bdrill/i, /machining/i,
  /qualification/i, /approval/i, /fingerprint/i, /\bstatus\b/i, /cnc/i, /gcode/i,
  /operation/i, /hardware/i, /groove/i, /thickness/i, /revision/i, /specid/i,
]);

export const MODEL_PROPOSAL_ERROR = Object.freeze({
  NOT_AN_OBJECT: "NOT_AN_OBJECT",
  EDITS_NOT_ARRAY: "EDITS_NOT_ARRAY",
  NO_EDITS: "NO_EDITS",
  UNKNOWN_KEY: "UNKNOWN_KEY",
  FORBIDDEN_KEY: "FORBIDDEN_KEY",
  INVALID_VALUE: "INVALID_VALUE",
  DUPLICATE_KEY: "DUPLICATE_KEY",
  TOO_MANY_EDITS: "TOO_MANY_EDITS",
});

const MAX_EDITS = EDITABLE_KEYS.length;

/** JSON-schema tool definition handed to the provider. */
export function designEditToolSchema() {
  return {
    name: DESIGN_EDIT_TOOL_NAME,
    description:
      "Propose changes to the customer's wardrobe design. You may ONLY propose values for the listed keys. " +
      "You must never invent panel sizes, coordinates, machining operations or approvals — FurniAI's deterministic " +
      "kernel calculates all geometry. If the customer asks for something this slice cannot build, leave `edits` " +
      "empty and describe it in `unsupported` with an honest alternative.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        edits: {
          type: "array",
          maxItems: MAX_EDITS,
          description: "Design facts the customer asked to set or change. Empty if nothing can be changed.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["key", "value"],
            properties: {
              key: { type: "string", enum: [...EDITABLE_KEYS] },
              value: {
                description:
                  "Exact value. Dimensions in millimetres (a number or a string with units); counts as whole numbers; " +
                  `finish one of ${SUPPORTED_FINISHES.join(", ")}; bayLayouts an array of ` +
                  `${Object.values(BAY_LAYOUT).join(" | ")}, one entry per bay.`,
              },
              sourceText: { type: "string", description: "The customer's own words this came from." },
            },
          },
        },
        unsupported: {
          type: "array",
          description: "Anything requested that this slice cannot build, each with an honest alternative.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["request", "reason"],
            properties: {
              request: { type: "string" },
              reason: { type: "string" },
              alternative: { type: "string" },
            },
          },
        },
        reply: { type: "string", description: "One or two sentences to show the customer." },
      },
      required: ["edits", "reply"],
    },
  };
}

function keyIsForbidden(key) {
  return FORBIDDEN_KEY_PATTERNS.some((p) => p.test(key));
}

/**
 * Validates raw model tool output. Nothing here trusts the model.
 *
 * @param {unknown} raw the tool_use input the model produced
 * @param {{currentBayCount?: number}} [options]
 * @returns {{ok: boolean, edits: Array<{key,value,sourceText}>, unsupported: Array, reply: string, errors: Array<{code,key?,message}>}}
 */
export function validateModelProposal(raw, { currentBayCount = 2 } = {}) {
  const errors = [];
  const fail = (code, message, key) => errors.push(key ? { code, key, message } : { code, message });

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail(MODEL_PROPOSAL_ERROR.NOT_AN_OBJECT, "Model output must be a JSON object.");
    return { ok: false, edits: [], unsupported: [], reply: "", errors };
  }

  const reply = typeof raw.reply === "string" ? raw.reply.trim() : "";
  const unsupported = Array.isArray(raw.unsupported)
    ? raw.unsupported
        .filter((u) => u && typeof u === "object" && typeof u.request === "string" && typeof u.reason === "string")
        .map((u) => ({
          request: u.request,
          reason: u.reason,
          alternative: typeof u.alternative === "string" ? u.alternative : null,
        }))
    : [];

  if (!Array.isArray(raw.edits)) {
    fail(MODEL_PROPOSAL_ERROR.EDITS_NOT_ARRAY, "`edits` must be an array.");
    return { ok: false, edits: [], unsupported, reply, errors };
  }
  if (raw.edits.length > MAX_EDITS) {
    fail(MODEL_PROPOSAL_ERROR.TOO_MANY_EDITS, `At most ${MAX_EDITS} edits may be proposed at once.`);
    return { ok: false, edits: [], unsupported, reply, errors };
  }

  const seen = new Set();
  const edits = [];

  for (const edit of raw.edits) {
    if (!edit || typeof edit !== "object" || Array.isArray(edit) || typeof edit.key !== "string") {
      fail(MODEL_PROPOSAL_ERROR.UNKNOWN_KEY, "Each edit must be an object with a string `key`.");
      continue;
    }
    const key = edit.key;

    if (keyIsForbidden(key)) {
      fail(MODEL_PROPOSAL_ERROR.FORBIDDEN_KEY, `"${key}" is owned by the deterministic kernel and cannot be model-set.`, key);
      continue;
    }
    if (!EDITABLE_KEYS.includes(key)) {
      fail(MODEL_PROPOSAL_ERROR.UNKNOWN_KEY, `"${key}" is not a customer-editable design fact.`, key);
      continue;
    }
    if (seen.has(key)) {
      fail(MODEL_PROPOSAL_ERROR.DUPLICATE_KEY, `"${key}" was proposed more than once.`, key);
      continue;
    }
    seen.add(key);

    if (key === "materialKey") {
      if (typeof edit.value !== "string" || edit.value.trim() === "") {
        fail(MODEL_PROPOSAL_ERROR.INVALID_VALUE, "materialKey must be a non-empty string.", key);
        continue;
      }
      edits.push({ key, value: edit.value.trim().toLowerCase(), sourceText: typeof edit.sourceText === "string" ? edit.sourceText : null });
      continue;
    }

    // Every other value goes through the same validator a typed human answer does.
    const parsed = parseAndValidateClarifyInput(key, edit.value, currentBayCount);
    if (!parsed.ok) {
      fail(MODEL_PROPOSAL_ERROR.INVALID_VALUE, parsed.error || `Invalid value for ${key}.`, key);
      continue;
    }
    edits.push({ key, value: parsed.value, sourceText: typeof edit.sourceText === "string" ? edit.sourceText : null });
  }

  return { ok: errors.length === 0, edits, unsupported, reply, errors };
}
