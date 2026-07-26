import { describe, it, expect } from "vitest";
import { FURNITURE_TYPES, DEFAULT_FURNITURE_TYPE, MATERIALS, DEFAULT_MATERIAL, HANDLE_STYLES, DOOR_TYPES, LED_LIGHTING, KNOWN } from "./knowledgeBase.js";

// Characterization tests (master plan §25/§27 Phase 0): structural consistency
// checks on the data every other layer (furnitureConfig.js, configSchema.js,
// buildGeometry.js, the sales agent) reads from. Not a judgment on whether these
// are the "right" furniture defaults — just a guard against a typo silently
// breaking a type (e.g. a missing `doorsFor` making buildGeometry throw).

describe("FURNITURE_TYPES — every entry has the shape other modules assume", () => {
  for (const [type, entry] of Object.entries(FURNITURE_TYPES)) {
    it(`"${type}" has a complete, valid entry`, () => {
      expect(typeof entry.label).toBe("string");
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.defaults.width).toBeGreaterThan(0);
      expect(entry.defaults.height).toBeGreaterThan(0);
      expect(entry.defaults.depth).toBeGreaterThan(0);
      expect(entry.panelFactor).toBeGreaterThan(0);
      expect(typeof entry.doorsFor).toBe("function");
      expect(entry.laborBase).toBeGreaterThan(0);
      expect(entry.complexity).toBeGreaterThan(0);
    });
  }

  it("DEFAULT_FURNITURE_TYPE names a real entry", () => {
    expect(FURNITURE_TYPES[DEFAULT_FURNITURE_TYPE]).toBeDefined();
  });
});

describe("doorsFor — spot-checked against the documented formulas", () => {
  it("wardrobe: ~one door per 600mm, minimum 2", () => {
    expect(FURNITURE_TYPES.wardrobe.doorsFor(2.4)).toBe(4);
    expect(FURNITURE_TYPES.wardrobe.doorsFor(0.3)).toBe(2); // floor enforced even for a narrow piece
  });

  it("kitchen: ~one door per 500mm, minimum 4", () => {
    expect(FURNITURE_TYPES.kitchen.doorsFor(3.0)).toBe(6);
    expect(FURNITURE_TYPES.kitchen.doorsFor(1.0)).toBe(4); // floor enforced
  });

  it("cabinet: ~one door per 500mm, minimum 2", () => {
    expect(FURNITURE_TYPES.cabinet.doorsFor(1.0)).toBe(2);
  });

  it("office is always exactly 2 doors regardless of width", () => {
    expect(FURNITURE_TYPES.office.doorsFor(0.5)).toBe(2);
    expect(FURNITURE_TYPES.office.doorsFor(5)).toBe(2);
  });

  it("bed/table/shelves/dressing_table have no doors", () => {
    expect(FURNITURE_TYPES.bed.doorsFor(2)).toBe(0);
    expect(FURNITURE_TYPES.table.doorsFor(2)).toBe(0);
    expect(FURNITURE_TYPES.shelves.doorsFor(2)).toBe(0);
    expect(FURNITURE_TYPES.dressing_table.doorsFor(2)).toBe(0);
  });
});

describe("Catalogs — every material/handle/door/LED entry has the shape pricing code assumes", () => {
  it("every material has a cost, tier, and color", () => {
    for (const [key, entry] of Object.entries(MATERIALS)) {
      expect(entry.costPerM2, `${key}.costPerM2`).toBeGreaterThan(0);
      expect(["premium", "standard"]).toContain(entry.tier);
      expect(entry.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("DEFAULT_MATERIAL names a real material", () => {
    expect(MATERIALS[DEFAULT_MATERIAL]).toBeDefined();
  });

  it("every handle style has a non-negative unit cost", () => {
    for (const entry of Object.values(HANDLE_STYLES)) {
      expect(entry.unitCost).toBeGreaterThanOrEqual(0);
    }
  });

  it("every door type has a non-negative surcharge", () => {
    for (const entry of Object.values(DOOR_TYPES)) {
      expect(entry.surchargePerDoor).toBeGreaterThanOrEqual(0);
    }
  });

  it("every LED mode has a non-negative cost, and 'off' costs nothing", () => {
    for (const entry of Object.values(LED_LIGHTING)) {
      expect(entry.cost).toBeGreaterThanOrEqual(0);
    }
    expect(LED_LIGHTING.off.cost).toBe(0);
  });
});

describe("KNOWN — convenience lookups stay in sync with the catalogs", () => {
  it("mirrors Object.keys of each catalog exactly", () => {
    expect(KNOWN.furnitureTypes).toEqual(Object.keys(FURNITURE_TYPES));
    expect(KNOWN.materials).toEqual(Object.keys(MATERIALS));
    expect(KNOWN.doorTypes).toEqual(Object.keys(DOOR_TYPES));
    expect(KNOWN.handleStyles).toEqual(Object.keys(HANDLE_STYLES));
    expect(KNOWN.ledModes).toEqual(Object.keys(LED_LIGHTING));
  });
});
