import { describe, expect, it } from "vitest";
import { buildGeometry, validateGeometry } from "./buildGeometry.js";
import { createDefaultConfig } from "./furnitureConfig.js";

describe("buildGeometry manufacturing invariants", () => {
  it("subtracts divider thickness before distributing clear module widths", () => {
    const config = createDefaultConfig("wardrobe");
    config.dimensions = { width: 2.4, height: 2.6, depth: 0.6 };
    config.modules = [
      { kind: "door", widthRatio: 1, doorCount: 1, drawerRows: 0, shelfCount: 2, hingeSide: "left", slideType: "hinged" },
      { kind: "door", widthRatio: 1, doorCount: 1, drawerRows: 0, shelfCount: 2, hingeSide: "right", slideType: "hinged" },
      { kind: "drawerBank", widthRatio: 1, doorCount: 0, drawerRows: 3, shelfCount: 0, hingeSide: "left", slideType: "hinged" },
    ];

    const parts = buildGeometry(config);
    expect(validateGeometry(parts, config)).toEqual([]);

    const dividers = parts.filter((part) => part.role === "divider");
    expect(dividers).toHaveLength(2);

    const rightmostModulePart = parts
      .filter((part) => part.module === 2)
      .reduce((rightmost, part) => Math.max(rightmost, part.position[0] + part.size[0] / 2), -Infinity);
    const rightSideInnerFace = config.dimensions.width / 2 - 0.018;
    expect(rightmostModulePart).toBeLessThanOrEqual(rightSideInnerFace);
  });

  it("reports non-finite, non-positive, and out-of-envelope parts", () => {
    const config = createDefaultConfig("wardrobe");
    const issues = validateGeometry(
      [
        { id: "bad-number", size: [1, 1, Number.NaN], position: [0, 0.5, 0] },
        { id: "bad-size", size: [1, 0, 0.1], position: [0, 0.5, 0] },
        { id: "outside", size: [1, 1, 0.1], position: [99, 0.5, 0] },
      ],
      config
    );

    expect(issues.map((issue) => issue.code)).toEqual([
      "NON_FINITE_GEOMETRY",
      "NON_POSITIVE_PART_SIZE",
      "PART_OUTSIDE_ENVELOPE",
    ]);
  });
});
