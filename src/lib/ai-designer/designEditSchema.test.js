import { describe, expect, it } from "vitest";
import {
  DESIGN_EDIT_TOOL_NAME,
  EDITABLE_KEYS,
  MODEL_PROPOSAL_ERROR,
  designEditToolSchema,
  validateModelProposal,
} from "./designEditSchema.js";
import { REQUIRED_INTAKE_KEYS } from "../conversation/intakeModel.js";

describe("design-edit tool schema", () => {
  it("exposes only customer-facing design facts to the model", () => {
    const schema = designEditToolSchema();
    expect(schema.name).toBe(DESIGN_EDIT_TOOL_NAME);
    expect(schema.input_schema.properties.edits.items.properties.key.enum).toEqual([...EDITABLE_KEYS]);
    expect(EDITABLE_KEYS).toEqual([...REQUIRED_INTAKE_KEYS, "materialKey"]);
    expect(schema.input_schema.additionalProperties).toBe(false);
  });

  it("offers the model no field that could carry geometry", () => {
    const serialized = JSON.stringify(designEditToolSchema());
    for (const forbidden of ["partGraph", "placement", "panelThickness", "drill", "machining", "fingerprint"]) {
      expect(serialized.toLowerCase()).not.toContain(`"${forbidden.toLowerCase()}"`);
    }
  });
});

describe("validating what the model returned", () => {
  it("accepts a well-formed edit and normalises its units", () => {
    const r = validateModelProposal({ edits: [{ key: "envelope.widthMm", value: "2.0 m" }], reply: "Done." });
    expect(r.ok).toBe(true);
    expect(r.edits).toEqual([{ key: "envelope.widthMm", value: 2000, sourceText: null }]);
  });

  it("rejects a key owned by the deterministic kernel", () => {
    for (const key of ["partGraph", "panelThicknessMm", "machiningPolicy", "qualificationStatus", "proposalFingerprint", "revision"]) {
      const r = validateModelProposal({ edits: [{ key, value: 1 }], reply: "" });
      expect(r.ok, key).toBe(false);
      expect(r.errors[0].code, key).toBe(MODEL_PROPOSAL_ERROR.FORBIDDEN_KEY);
      expect(r.edits).toEqual([]);
    }
  });

  it("rejects a key that is simply not editable", () => {
    const r = validateModelProposal({ edits: [{ key: "priceAed", value: 5000 }], reply: "" });
    expect(r.errors[0].code).toBe(MODEL_PROPOSAL_ERROR.UNKNOWN_KEY);
  });

  it("applies the same value validation a typed human answer gets", () => {
    for (const bad of ["about 2 metres", "-2000mm", "2000.00001mm", "wide-ish"]) {
      const r = validateModelProposal({ edits: [{ key: "envelope.widthMm", value: bad }], reply: "" });
      expect(r.ok, bad).toBe(false);
      expect(r.errors[0].code, bad).toBe(MODEL_PROPOSAL_ERROR.INVALID_VALUE);
    }
    expect(validateModelProposal({ edits: [{ key: "bayCount", value: 2.5 }], reply: "" }).ok).toBe(false);
    expect(validateModelProposal({ edits: [{ key: "bayCount", value: "three" }], reply: "" }).edits[0].value).toBe(3);
  });

  it("rejects duplicates and oversized batches", () => {
    const dup = validateModelProposal({
      edits: [{ key: "bayCount", value: 2 }, { key: "bayCount", value: 3 }],
      reply: "",
    });
    expect(dup.errors[0].code).toBe(MODEL_PROPOSAL_ERROR.DUPLICATE_KEY);

    const many = validateModelProposal({ edits: new Array(50).fill({ key: "bayCount", value: 2 }), reply: "" });
    expect(many.errors[0].code).toBe(MODEL_PROPOSAL_ERROR.TOO_MANY_EDITS);
  });

  it("keeps unsupported requests and the reply even when it rejects an edit", () => {
    const r = validateModelProposal({
      edits: [{ key: "partGraph", value: {} }],
      unsupported: [{ request: "sliding doors", reason: "Not buildable in this slice.", alternative: "Hinged doors." }],
      reply: "I can do hinged instead.",
    });
    expect(r.ok).toBe(false);
    expect(r.unsupported[0].alternative).toBe("Hinged doors.");
    expect(r.reply).toBe("I can do hinged instead.");
  });

  it("rejects non-object model output outright", () => {
    for (const bad of [null, "edits", 7, true, []]) {
      expect(validateModelProposal(bad).ok).toBe(false);
    }
  });
});
