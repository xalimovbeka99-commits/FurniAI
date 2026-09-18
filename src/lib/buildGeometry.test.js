import { describe, expect, it, vi } from "vitest";
import {
  buildGeometry,
  buildPartGraphMeshes,
  buildDiscretePartGraphPanels,
  generateSystem32Pins,
  disposeGeometryGroup,
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

describe("buildPartGraphMeshes — Discrete Panels, Edge Banding & System 32 Guides", () => {
  // Sample PartGraph fixture containing GABLE, DIVIDER, SHELF, and DRAWER_*
  const samplePartGraph = {
    sourceSpecId: "test-wardrobe-01",
    partGraphVersion: "partgraph/0.1",
    parts: [
      {
        id: "CARC_BOT",
        role: "BOTTOM_PANEL",
        placement: {
          minXDmm: 0,
          maxXDmm: 18000,
          minYDmm: 1000,
          maxYDmm: 1180,
          minZDmm: 200,
          maxZDmm: 6000,
        },
      },
      {
        id: "CARC_TOP",
        role: "TOP_PANEL",
        placement: {
          minXDmm: 0,
          maxXDmm: 18000,
          minYDmm: 23820,
          maxYDmm: 24000,
          minZDmm: 200,
          maxZDmm: 6000,
        },
      },
      {
        id: "GABLE_L",
        role: "GABLE",
        placement: {
          minXDmm: 0,
          maxXDmm: 180,
          minYDmm: 1180,
          maxYDmm: 23820,
          minZDmm: 200,
          maxZDmm: 6000,
        },
      },
      {
        id: "GABLE_R",
        role: "SIDE_PANEL_RIGHT",
        placement: {
          minXDmm: 17820,
          maxXDmm: 18000,
          minYDmm: 1180,
          maxYDmm: 23820,
          minZDmm: 200,
          maxZDmm: 6000,
        },
      },
      {
        id: "DIV_01",
        role: "DIVIDER",
        placement: {
          minXDmm: 8910,
          maxXDmm: 9090,
          minYDmm: 1180,
          maxYDmm: 23820,
          minZDmm: 200,
          maxZDmm: 5800,
        },
      },
      {
        id: "SHELF_01",
        role: "SHELF",
        placement: {
          minXDmm: 180,
          maxXDmm: 8910,
          minYDmm: 12000,
          maxYDmm: 12180,
          minZDmm: 200,
          maxZDmm: 5800,
        },
      },
      {
        id: "DRAWER_FRONT_01",
        role: "DRAWER_FRONT",
        placement: {
          minXDmm: 180,
          maxXDmm: 8910,
          minYDmm: 2000,
          maxYDmm: 3500,
          minZDmm: 200,
          maxZDmm: 380,
        },
      },
      {
        id: "DRAWER_SIDE_L_01",
        role: "DRAWER_SIDE_L",
        placement: {
          minXDmm: 200,
          maxXDmm: 360,
          minYDmm: 2100,
          maxYDmm: 3400,
          minZDmm: 380,
          maxZDmm: 5200,
        },
      },
      {
        id: "DRAWER_SIDE_R_01",
        role: "DRAWER_SIDE_R",
        placement: {
          minXDmm: 8730,
          maxXDmm: 8890,
          minYDmm: 2100,
          maxYDmm: 3400,
          minZDmm: 380,
          maxZDmm: 5200,
        },
      },
      {
        id: "DRAWER_BACK_01",
        role: "DRAWER_BACK",
        placement: {
          minXDmm: 360,
          maxXDmm: 8730,
          minYDmm: 2100,
          maxYDmm: 3400,
          minZDmm: 5040,
          maxZDmm: 5200,
        },
      },
      {
        id: "DRAWER_BOT_01",
        role: "DRAWER_BOTTOM",
        placement: {
          minXDmm: 360,
          maxXDmm: 8730,
          minYDmm: 2100,
          maxYDmm: 2160,
          minZDmm: 380,
          maxZDmm: 5040,
        },
      },
    ],
  };

  it("renders each PartGraph part as an independent THREE.BoxGeometry positioned via bounding datums", () => {
    const group = buildPartGraphMeshes(samplePartGraph);
    expect(group.userData.panelCount).toBe(11);

    const gableL = group.children.find((c) => c.name === "panel_GABLE_L");
    expect(gableL).toBeDefined();
    expect(gableL.geometry.type).toBe("BoxGeometry");

    // Dimensions: (180 - 0) / 10 = 18 mm -> 0.018 m
    // Height: (23820 - 1180) / 10 = 2264 mm -> 2.264 m
    // Depth: (6000 - 200) / 10 = 580 mm -> 0.580 m
    expect(gableL.geometry.parameters.width).toBeCloseTo(0.018, 5);
    expect(gableL.geometry.parameters.height).toBeCloseTo(2.264, 5);
    expect(gableL.geometry.parameters.depth).toBeCloseTo(0.580, 5);

    // Center position: X = 9 mm -> 0.009 m, Y = (1180 + 23820)/20 = 1250 mm -> 1.25 m, Z = (200 + 6000)/20 = 310 mm -> 0.310 m
    expect(gableL.position.x).toBeCloseTo(0.009, 5);
    expect(gableL.position.y).toBeCloseTo(1.25, 5);
    expect(gableL.position.z).toBeCloseTo(0.31, 5);

    // Bounding datums in userData
    expect(gableL.userData.datumsMm.minXMm).toBe(0);
    expect(gableL.userData.datumsMm.maxXMm).toBe(18);
    expect(gableL.userData.datumsMm.minYMm).toBe(118);
    expect(gableL.userData.datumsMm.maxYMm).toBe(2382);
    expect(gableL.userData.datumsMm.minZMm).toBe(20);
    expect(gableL.userData.datumsMm.maxZMm).toBe(600);
  });

  it("mounts discrete drawer parts (DRAWER_FRONT, DRAWER_SIDE_L, DRAWER_SIDE_R, DRAWER_BACK, DRAWER_BOTTOM)", () => {
    const group = buildDiscretePartGraphPanels(samplePartGraph);
    const drawerParts = [
      "panel_DRAWER_FRONT_01",
      "panel_DRAWER_SIDE_L_01",
      "panel_DRAWER_SIDE_R_01",
      "panel_DRAWER_BACK_01",
      "panel_DRAWER_BOT_01",
    ];

    for (const name of drawerParts) {
      const mesh = group.children.find((c) => c.name === name);
      expect(mesh, `Missing discrete drawer mesh ${name}`).toBeDefined();
      expect(mesh.geometry.type).toBe("BoxGeometry");
    }
  });

  it("applies 1.0 mm visual edge-banding tint on front-facing edges", () => {
    const group = buildPartGraphMeshes(samplePartGraph);

    // Gables, dividers, shelves, and drawer fronts should have edge banding attached
    const checkEdgeBanded = (panelName) => {
      const panel = group.children.find((c) => c.name === panelName);
      expect(panel).toBeDefined();
      expect(panel.userData.hasEdgeBanding).toBe(true);
      expect(panel.userData.edgeBandThicknessMm).toBe(1.0);

      const edgeMesh = panel.children.find((c) => c.userData?.isEdgeBanding);
      expect(edgeMesh).toBeDefined();
      expect(edgeMesh.geometry.type).toBe("BoxGeometry");
      // 1.0 mm in metres = 0.001 m
      expect(edgeMesh.geometry.parameters.depth).toBeCloseTo(0.001, 5);
      // Positioned at front face (-depth/2 + 0.001/2)
      const expectedZ = -panel.geometry.parameters.depth / 2 + 0.0005;
      expect(edgeMesh.position.z).toBeCloseTo(expectedZ, 5);
    };

    checkEdgeBanded("panel_GABLE_L");
    checkEdgeBanded("panel_GABLE_R");
    checkEdgeBanded("panel_DIV_01");
    checkEdgeBanded("panel_SHELF_01");
    checkEdgeBanded("panel_DRAWER_FRONT_01");
  });

  it("renders System 32 review pins with 37 mm front/rear offsets and 32 mm pitch when toggled ON", () => {
    const group = buildPartGraphMeshes(samplePartGraph, { showSystem32Pins: true });
    const pinsGroup = group.userData.system32Group;
    expect(pinsGroup).toBeDefined();
    expect(pinsGroup.visible).toBe(true);
    expect(pinsGroup.userData.isSystem32Pins).toBe(true);
    expect(pinsGroup.userData.pinDiameterMm).toBe(5);
    expect(pinsGroup.userData.pitchMm).toBe(32);
    expect(pinsGroup.userData.frontOffsetMm).toBe(37);
    expect(pinsGroup.userData.rearOffsetMm).toBe(37);
    expect(pinsGroup.userData.startOffsetMm).toBe(64);
    expect(pinsGroup.userData.totalPins).toBeGreaterThan(0);

    // Bottom panel top datum is 118 mm -> baseline is 118 + 64 = 182 mm
    // Check front and rear row pin offsets on GABLE_L (minZ = 20 mm, maxZ = 600 mm)
    // Front row Z: 20 + 37 = 57 mm -> 0.057 m
    // Rear row Z: 600 - 37 = 563 mm -> 0.563 m
    const frontPin = pinsGroup.children.find(
      (c) => c.userData.parentGableId === "GABLE_L" && c.userData.row === "front" && Math.round(c.userData.heightMm) === 182
    );
    expect(frontPin).toBeDefined();
    expect(frontPin.position.z).toBeCloseTo(0.057, 4);
    expect(frontPin.position.y).toBeCloseTo(0.182, 4);

    const rearPin = pinsGroup.children.find(
      (c) => c.userData.parentGableId === "GABLE_L" && c.userData.row === "rear" && Math.round(c.userData.heightMm) === 182
    );
    expect(rearPin).toBeDefined();
    expect(rearPin.position.z).toBeCloseTo(0.563, 4);
    expect(rearPin.position.y).toBeCloseTo(0.182, 4);

    // Verify next pin height interval is exactly 32 mm (182 + 32 = 214 mm)
    const nextFrontPin = pinsGroup.children.find(
      (c) => c.userData.parentGableId === "GABLE_L" && c.userData.row === "front" && Math.round(c.userData.heightMm) === 214
    );
    expect(nextFrontPin).toBeDefined();
    expect(nextFrontPin.position.y).toBeCloseTo(0.214, 4);
  });

  it("respects showSystem32Pins: false and allows dynamic toggling", () => {
    const group = buildPartGraphMeshes(samplePartGraph, { showSystem32Pins: false });
    expect(group.userData.system32Group.visible).toBe(false);

    // Toggle on dynamically
    const stateOn = group.userData.toggleSystem32Pins(true);
    expect(stateOn).toBe(true);
    expect(group.userData.system32Group.visible).toBe(true);

    // Toggle off
    const stateOff = group.userData.toggleSystem32Pins(false);
    expect(stateOff).toBe(false);
    expect(group.userData.system32Group.visible).toBe(false);
  });

  it("recursively disposes all geometries and materials on recompilation", () => {
    const group = buildPartGraphMeshes(samplePartGraph, { showSystem32Pins: true });

    const disposedGeometries = [];
    const disposedMaterials = [];

    group.traverse((obj) => {
      if (obj.geometry) {
        vi.spyOn(obj.geometry, "dispose").mockImplementation(function () {
          disposedGeometries.push(this);
        });
      }
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (!m.__spied) {
            m.__spied = true;
            vi.spyOn(m, "dispose").mockImplementation(function () {
              disposedMaterials.push(this);
            });
          }
        }
      }
    });

    // Execute disposal
    disposeGeometryGroup(group);

    expect(disposedGeometries.length).toBeGreaterThan(0);
    expect(disposedMaterials.length).toBeGreaterThan(0);
    expect(group.children).toHaveLength(0);
  });

  it("mounts architectural filler panels and dual-tier dimension anchors when scribes are specified", () => {
    const group = buildPartGraphMeshes(samplePartGraph, {
      scribeLeftMm: 60,
      scribeRightMm: 80,
    });

    const fillerL = group.children.find((c) => c.name === "panel_FILLER_LEFT");
    const fillerR = group.children.find((c) => c.name === "panel_FILLER_RIGHT");

    expect(fillerL).toBeDefined();
    expect(fillerR).toBeDefined();

    expect(fillerL.userData.isFiller).toBe(true);
    expect(fillerL.userData.widthMm).toBe(60);
    expect(fillerR.userData.widthMm).toBe(80);

    expect(fillerL.position.x).toBeCloseTo(-0.03, 4);
    expect(fillerL.position.z).toBeCloseTo(0.029, 4);
    expect(fillerR.position.x).toBeCloseTo(1.84, 4);
    expect(fillerR.position.z).toBeCloseTo(0.029, 4);

    const dims = group.userData.dimensions;
    expect(dims).toBeDefined();
    expect(dims.netCarcassWidthMm).toBe(1800);
    expect(dims.overallRoomWidthMm).toBe(1940);
    expect(dims.scribeLeftMm).toBe(60);
    expect(dims.scribeRightMm).toBe(80);
    expect(dims.carcassDimensionString).toBe("1800 mm (net carcass)");
    expect(dims.roomDimensionString).toBe("1940 mm (wall-to-wall room)");

    expect(dims.anchors.carcassLeft.y).toBeCloseTo(2.46, 4);
    expect(dims.anchors.carcassRight.y).toBeCloseTo(2.46, 4);
    expect(dims.anchors.roomLeft.y).toBeCloseTo(2.52, 4);
    expect(dims.anchors.roomRight.y).toBeCloseTo(2.52, 4);
  });

  it("attaches visual reveal outline only to DRAWER_FRONT panels, avoiding edge-banding on internal drawer box parts", () => {
    const group = buildPartGraphMeshes(samplePartGraph);

    const drawerFront = group.children.find((c) => c.name === "panel_DRAWER_FRONT_01");
    expect(drawerFront).toBeDefined();
    expect(drawerFront.userData.hasRevealOutline).toBe(true);

    const revealEdges = drawerFront.children.find((c) => c.name.startsWith("reveal_edges_"));
    expect(revealEdges).toBeDefined();
    expect(revealEdges.isLineSegments).toBe(true);

    for (const partId of ["DRAWER_SIDE_L_01", "DRAWER_SIDE_R_01", "DRAWER_BACK_01", "DRAWER_BOT_01"]) {
      const panel = group.children.find((c) => c.name === `panel_${partId}`);
      expect(panel).toBeDefined();
      expect(panel.userData.hasRevealOutline).toBeUndefined();
      expect(panel.userData.edgeBandThicknessMm).toBeUndefined();
      const edgeChildren = panel.children.filter((c) => c.name.startsWith("edgeband_"));
      expect(edgeChildren).toHaveLength(0);
    }
  });

  it("safely handles 50 rapid dynamic updates and disposals without context/memory leakage", () => {
    let currentGroup = null;

    for (let i = 0; i < 50; i++) {
      if (currentGroup) {
        disposeGeometryGroup(currentGroup);
      }

      const dynamicGraph = {
        ...samplePartGraph,
        sourceSpecId: `stress-test-${i}`,
        parts: samplePartGraph.parts.filter((p, idx) => {
          if (p.role === "SHELF" && i % 3 === 0) return false;
          if (String(p.role).startsWith("DRAWER") && i % 2 === 0 && idx > 7) return false;
          return true;
        }),
      };

      currentGroup = buildPartGraphMeshes(dynamicGraph, {
        showSystem32Pins: i % 2 === 1,
        scribeLeftMm: (i % 5) * 10,
        scribeRightMm: (i % 4) * 15,
      });

      expect(currentGroup.children.length).toBeGreaterThan(0);
    }

    disposeGeometryGroup(currentGroup);
    expect(currentGroup.children).toHaveLength(0);
  });

  it("delegates polymorphic buildGeometry(partGraph) to buildPartGraphMeshes", () => {
    const group = buildGeometry(samplePartGraph, { showSystem32Pins: true });
    expect(group.name).toContain("partgraph_model");
    expect(group.userData.panelCount).toBe(11);
    expect(group.userData.system32Group.visible).toBe(true);
  });
});
