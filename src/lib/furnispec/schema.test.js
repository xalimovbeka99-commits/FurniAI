import { describe, expect, it } from "vitest";
import {
  FURNISPEC_SCHEMA_VERSION,
  FURNITURE_TYPES,
  WARDROBE_TYPES,
  CONSTRUCTION_STYLES,
  FINISH_TYPES,
  SPEC_STATUS,
  QUALIFICATION_STATUS,
  HARDWARE_APPROVAL_STATUS,
  MACHINING_POLICY,
  SIDE_INSET_STATUS,
} from "./schema.js";

describe("FurniSpec v0.1 Schema Constants", () => {
  it("exports authoritative schema version string", () => {
    expect(FURNISPEC_SCHEMA_VERSION).toBe("furnispec/0.1");
  });

  it("exports frozen enums for furniture and wardrobe types", () => {
    expect(FURNITURE_TYPES.WARDROBE).toBe("wardrobe");
    expect(WARDROBE_TYPES.STRAIGHT_HINGED).toBe("straight_hinged");
  });

  it("exports construction and finish styles", () => {
    expect(CONSTRUCTION_STYLES.CAP_STYLE).toBe("CAP_STYLE");
    expect(CONSTRUCTION_STYLES.FULL_HEIGHT_SIDES).toBe("FULL_HEIGHT_SIDES");
    expect(FINISH_TYPES.MELAMINE).toBe("melamine");
  });

  it("enforces safety status values", () => {
    expect(SPEC_STATUS.APPROVED).toBe("APPROVED");
    expect(QUALIFICATION_STATUS.WORKSHOP_REVIEW_NOT_CNC_QUALIFIED).toBe("WORKSHOP_REVIEW_NOT_CNC_QUALIFIED");
    expect(HARDWARE_APPROVAL_STATUS.BLOCKED_PENDING_HARDWARE_APPROVAL).toBe("BLOCKED_PENDING_HARDWARE_APPROVAL");
    expect(MACHINING_POLICY.APPROVED).toBe("APPROVED");
    expect(SIDE_INSET_STATUS.ASSUMPTION_PENDING_BEKZOD_APPROVAL).toBe("ASSUMPTION_PENDING_BEKZOD_APPROVAL");
  });
});
