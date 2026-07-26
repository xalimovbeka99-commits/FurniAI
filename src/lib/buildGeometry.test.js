import { describe, expect, it } from "vitest";
import {
  buildGeometry,
  panelAreaFromParts,
  partsToCutList,
  validateGeometry,
} from "./buildGeometry.js";
import { createDefaultConfig } from "./furnitureConfig.js";

// Characterization tests pin down the current panel-generation behavior before
// later phases extend it. The manufacturing-invariant tests cover corrections
// added on the production branch; both suites intentionally share this file.

describe("buildGeometry — default wardrobe config", () => {
  const config = createDefaultConfig("wardrobe");
  const parts = buildGeometry(config);

  it("produces the fixed carcass shell parts", () => {
    expect(parts.filter((part) => part.role === "side")).toHaveLength(2);
    expect(parts.filter((part) => part.role === "top")).toHaveLength(1);
    expect(parts.filter((part) => part.role === "bottom")).toHaveLength(1);
    expect(parts.filter((part) => part.role === "back")).toHaveLength(1);
    expect(parts.filter((part) => part.role === "plinth")).toHaveLength(1);
  });

  it("produces one divider per gap between modules", () => {
    expect(config.modules).toHaveLength(3);
    expect(parts.filter((part) => part.role === "divider")).toHaveLength(2);
  });

  it("produces shelves matching each module's shelfCount", () => {
    expect(parts.filter((part) => part.role === "shelf")).toHaveLength(6);
  });

  it("produces drawer fronts matching the drawer bank's drawerRows", () => {
    expect(parts.filter((part) => part.role === "drawerFront")).toHaveLength(3);
  });

  it("produces one door panel per module's doorCount", () => {
    expect(parts.filter((part) => part.role === "door")).toHaveLength(2);
  });

  it("gives every part a unique id and finite positive geometry", () => {
    const ids = parts.map((part) => part.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const part of parts) {
      expect(part.size).toHaveLength(3);
      expect(part.position).toHaveLength(3);
      for (const dimension of part.size) {
        expect(Number.isFinite(dimension)).toBe(true);
        expect(dimension).toBeGreaterThan(0);
      }
      for (const coordinate of part.position) {
        expect(Number.isFinite(coordinate)).toBe(true);
      }
    }
  });

  it("carries the config material onto every part", () => {
    expect(parts.every((part) => part.material === config.material)).toBe(true);
  });
});

describe("buildGeometry — no plinth", () => {
  it("omits the plinth part when hasPlinth is false", () => {
    const config = createDefaultConfig("office");
    const parts = buildGeometry(config);
    expect(parts.filter((part) => part.role === "plinth")).toHaveLength(0);
  });
});

describe("buildGeometry manufacturing invariants", () => {
  it("subtracts divider thickness before distributing clear module widths", () => {
    const config = createDefaultConfig("wardrobe");
    config.dimensions = { width: 2.4, height: 2.6, depth: 0.6 };
    config.modules = [
      {
        kind: "door",
        widthRatio: 1,
        doorCount: 1,
        drawerRows: 0,
        shelfCount: 2,
        hingeSide: "left",
        slideType: "hinged",
      },
      {
        kind: "door",
        widthRatio: 1,
        doorCount: 1,
        drawerRows: 0,
        shelfCount: 2,
        hingeSide: "right",
        slideType: "hinged",
      },
      {
        kind: "drawerBank",
        widthRatio: 1,
        doorCount: 0,
        drawerRows: 3,
        shelfCount: 0,
        hingeSide: "left",
        slideType: "hinged",
      },
    ];

    const parts = buildGeometry(config);
    expect(validateGeometry(parts, config)).toEqual([]);
    expect(parts.filter((part) => part.role === "divider")).toHaveLength(2);

    const rightmostModulePart = parts
      .filter((part) => part.module === 2)
      .reduce(
        (rightmost, part) =>
          Math.max(rightmost, part.position[0] + part.size[0] / 2),
        -Infinity
      );
    const rightSideInnerFace = config.dimensions.width / 2 - 0.018;
    expect(rightmostModulePart).toBeLessThanOrEqual(rightSideInnerFace);
  });

  it("reports non-finite, non-positive, and out-of-envelope parts", () => {
    const config = createDefaultConfig("wardrobe");
    const issues = validateGeometry(
      [
        {
          id: "bad-number",
          size: [1, 1, Number.NaN],
          position: [0, 0.5, 0],
        },
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

describe("panelAreaFromParts", () => {
  it("sums the largest face of each part", () => {
    const parts = [
      { size: [1, 2, 0.02] },
      { size: [0.5, 0.5, 0.02] },
    ];
    expect(panelAreaFromParts(parts)).toBeCloseTo(2.25, 10);
  });

  it("returns 0 for an empty parts list", () => {
    expect(panelAreaFromParts([])).toBe(0);
  });
});

describe("partsToCutList", () => {
  it("groups identical dimensions and material into one quantity row", () => {
    const parts = [
      { role: "shelf", size: [0.5, 0.018, 0.3], material: "oak" },
      { role: "shelf", size: [0.3, 0.5, 0.018], material: "oak" },
      { role: "shelf", size: [0.5, 0.018, 0.3], material: "walnut" },
    ];
    const cutList = partsToCutList(parts);
    expect(cutList).toHaveLength(2);
    expect(cutList.find((row) => row.material === "oak")).toMatchObject({
      role: "shelf",
      length: 500,
      width: 300,
      thickness: 18,
      qty: 2,
      material: "oak",
    });
    expect(cutList.find((row) => row.material === "walnut").qty).toBe(1);
  });

  it("converts metres to rounded millimetres", () => {
    const cutList = partsToCutList([
      {
        role: "top",
        size: [2.399, 0.018, 0.6001],
        material: "oak",
      },
    ]);
    expect(cutList[0]).toMatchObject({
      length: 2399,
      width: 600,
      thickness: 18,
    });
  });
});
