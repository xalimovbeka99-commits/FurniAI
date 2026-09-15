import { describe, expect, it, vi } from "vitest";
import {
  extractPanelDatums,
  analyzePartGraphStructure,
  projectOrthographicViews,
  generateShopDrawingsSVG,
  exportShopDrawingsSVG,
  exportShopDrawingsPDF,
  SHEET_SIZES,
} from "./projectionEngine.js";
import { buildStructuralPartGraph } from "../partgraph/buildStructuralPartGraph.js";
import goldenFixture from "../furnispec/goldenWardrobe.fixture.json";

describe("projectionEngine — PartGraph Panel Datum Extraction & Structural Analysis", () => {
  const goldenPartGraph = buildStructuralPartGraph(goldenFixture);

  it("extracts panel datums from deci-mm to mm with zero precision drift", () => {
    const topPart = goldenPartGraph.parts.find((p) => p.role === "TOP_PANEL" || p.id === "CARC_TOP");
    expect(topPart).toBeDefined();

    const datums = extractPanelDatums(topPart);
    expect(datums.id).toBe(topPart.id);
    expect(datums.minX).toBe(0);
    expect(datums.maxX).toBe(1800);
    expect(datums.minY).toBe(2382);
    expect(datums.maxY).toBe(2400);
    expect(datums.minZ).toBe(20);
    expect(datums.maxZ).toBe(600);
    expect(datums.width).toBe(1800);
    expect(datums.height).toBe(18);
    expect(datums.depth).toBe(580);
  });

  it("analyzes carcass envelope, clear bay openings, and dividers from Golden Wardrobe", () => {
    const structure = analyzePartGraphStructure(goldenPartGraph);
    const { bounds, bays, dividers } = structure;

    expect(bounds.carcassWidthMm).toBe(1800);
    expect(bounds.totalHeightMm).toBe(2400);
    expect(bounds.carcassHeightMm).toBe(2300);
    expect(bounds.plinthHeightMm).toBe(100);
    expect(bounds.carcassDepthMm).toBe(580);
    expect(bounds.totalDepthMm).toBe(600);

    // Golden wardrobe has 1 divider and 2 bays of 873 mm
    expect(dividers).toHaveLength(1);
    expect(bays).toHaveLength(2);
    expect(bays[0].widthMm).toBe(873);
    expect(bays[1].widthMm).toBe(873);
  });
});

describe("projectionEngine — Orthographic Projections (Front, Section, Plan)", () => {
  const goldenPartGraph = buildStructuralPartGraph(goldenFixture);

  it("projects Front Elevation View with all carcass panels, plinth, and running dimensions", () => {
    const proj = projectOrthographicViews(goldenPartGraph);
    const { frontElevation } = proj.views;

    expect(frontElevation.panels.length).toBeGreaterThan(5);

    // Gables, divider, top, bottom, and plinth must be present
    const topPanel = frontElevation.panels.find((p) => p.role === "TOP_PANEL");
    const botPanel = frontElevation.panels.find((p) => p.role === "BOTTOM_PANEL");
    const plinthFascia = frontElevation.panels.find((p) => p.role.includes("PLINTH"));

    expect(topPanel).toBeDefined();
    expect(topPanel.width).toBe(1800);
    expect(topPanel.height).toBe(18);
    expect(botPanel).toBeDefined();
    expect(botPanel.width).toBe(1800);
    expect(plinthFascia).toBeDefined();

    // Check running dimensions
    const dims = frontElevation.dimensions;
    const widthDim = dims.find((d) => d.tier === "OVERALL" && d.axis === "X");
    const heightDim = dims.find((d) => d.tier === "OVERALL" && d.axis === "Y");
    const plinthDim = dims.find((d) => d.tier === "SUB" && d.axis === "Y");

    expect(widthDim).toBeDefined();
    expect(widthDim.label).toContain("1800 mm");
    expect(heightDim).toBeDefined();
    expect(heightDim.label).toContain("2400 mm");
    expect(plinthDim).toBeDefined();
    expect(plinthDim.label).toBe("100 mm");

    // Bay dimensions
    const bayDims = dims.filter((d) => d.tier === "BAYS");
    expect(bayDims).toHaveLength(2);
    expect(bayDims[0].label).toContain("873 mm");
    expect(bayDims[1].label).toContain("873 mm");
  });

  it("projects Cross-Section A-A with grooved back panel and shelf setbacks", () => {
    const proj = projectOrthographicViews(goldenPartGraph);
    const { crossSection } = proj.views;

    // Top, bottom, plinth rails, back panel
    const secTop = crossSection.panels.find((p) => p.id === "SEC_TOP");
    const secBot = crossSection.panels.find((p) => p.id === "SEC_BOT");
    const secBack = crossSection.panels.find((p) => p.id === "SEC_BACK");
    const plinthF = crossSection.panels.find((p) => p.id === "SEC_PLINTH_F");
    const plinthR = crossSection.panels.find((p) => p.id === "SEC_PLINTH_R");

    expect(secTop).toBeDefined();
    expect(secTop.depth).toBe(580);
    expect(secBot).toBeDefined();
    expect(secBot.depth).toBe(580);

    expect(plinthF).toBeDefined();
    expect(plinthR).toBeDefined();

    // Back panel housed in 7mm groove, 6mm thickness, 20mm from rear datum
    expect(secBack).toBeDefined();
    expect(secBack.depth).toBe(6);
    expect(secBack.z).toBe(600 - 20 - 6);

    // Check Cross-Section dimensions
    const totalDepthDim = crossSection.dimensions.find((d) => d.tier === "OVERALL");
    const carcassDepthDim = crossSection.dimensions.find((d) => d.tier === "CARCASS");
    const grooveDim = crossSection.dimensions.find((d) => d.tier === "GROOVE");

    expect(totalDepthDim.label).toContain("600 mm");
    expect(carcassDepthDim.label).toContain("580 mm");
    expect(grooveDim.label).toContain("20 mm");
  });

  it("projects Plan View (Top-Down) with gables, dividers, and back panel", () => {
    const proj = projectOrthographicViews(goldenPartGraph);
    const { plan } = proj.views;

    const gableL = plan.panels.find((p) => p.id === "PLAN_GABLE_L");
    const gableR = plan.panels.find((p) => p.id === "PLAN_GABLE_R");
    const back = plan.panels.find((p) => p.id === "PLAN_BACK");

    expect(gableL).toBeDefined();
    expect(gableL.width).toBe(18);
    expect(gableL.depth).toBe(580);

    expect(gableR).toBeDefined();
    expect(gableR.width).toBe(18);
    expect(gableR.depth).toBe(580);

    expect(back).toBeDefined();
    expect(back.depth).toBe(6);

    const roomDim = plan.dimensions.find((d) => d.tier === "ROOM");
    expect(roomDim.label).toBe("1800 mm");
  });

  it("handles architectural scribes (FILLER_LEFT and FILLER_RIGHT) with dual-tier room dimensions", () => {
    const proj = projectOrthographicViews(goldenPartGraph, {
      scribeLeftMm: 50,
      scribeRightMm: 75,
    });

    expect(proj.bounds.scribeLeftMm).toBe(50);
    expect(proj.bounds.scribeRightMm).toBe(75);
    expect(proj.bounds.carcassWidthMm).toBe(1800);
    expect(proj.bounds.roomWidthMm).toBe(1925);

    // Front elevation fillers
    const fillerL = proj.views.frontElevation.panels.find((p) => p.id === "FILLER_LEFT");
    const fillerR = proj.views.frontElevation.panels.find((p) => p.id === "FILLER_RIGHT");
    expect(fillerL).toBeDefined();
    expect(fillerL.width).toBe(50);
    expect(fillerR).toBeDefined();
    expect(fillerR.width).toBe(75);

    // Plan view fillers
    const planFillerL = proj.views.plan.panels.find((p) => p.id === "PLAN_SCRIBE_L");
    const planFillerR = proj.views.plan.panels.find((p) => p.id === "PLAN_SCRIBE_R");
    expect(planFillerL).toBeDefined();
    expect(planFillerL.width).toBe(50);
    expect(planFillerR).toBeDefined();
    expect(planFillerR.width).toBe(75);

    // Overall dimension reflects room width
    const overallDim = proj.views.frontElevation.dimensions.find((d) => d.tier === "OVERALL" && d.axis === "X");
    expect(overallDim.label).toContain("1925 mm");
  });

  it("projects drawer pack entities with 2.0 mm reveal outline in Front Elevation and box profile in Section", () => {
    const partGraphWithDrawers = {
      sourceSpecId: "spec-drawers-01",
      revision: 2,
      parts: [
        ...goldenPartGraph.parts,
        {
          id: "DRAWER_FRONT_01",
          role: "DRAWER_FRONT",
          placement: {
            minXDmm: 180,
            maxXDmm: 8910,
            minYDmm: 1180,
            maxYDmm: 3680,
            minZDmm: 0,
            maxZDmm: 180,
          },
        },
        {
          id: "DRAWER_SIDE_L_01",
          role: "DRAWER_SIDE_L",
          placement: {
            minXDmm: 200,
            maxXDmm: 350,
            minYDmm: 1330,
            maxYDmm: 3530,
            minZDmm: 180,
            maxZDmm: 5180,
          },
        },
      ],
    };

    const proj = projectOrthographicViews(partGraphWithDrawers);

    // Front elevation drawer front
    const df = proj.views.frontElevation.panels.find((p) => p.id === "DRAWER_FRONT_01");
    expect(df).toBeDefined();
    expect(df.isRevealOutline).toBe(true);

    // Cross section drawer front and internal box
    const secDf = proj.views.crossSection.panels.find((p) => p.id === "SEC_DF_DRAWER_FRONT_01");
    const secBox = proj.views.crossSection.panels.find((p) => p.id === "SEC_DBOX_DRAWER_FRONT_01");
    expect(secDf).toBeDefined();
    expect(secDf.depth).toBe(18);
    expect(secBox).toBeDefined();
    expect(secBox.isInternalBox).toBe(true);
  });
});

describe("projectionEngine — SVG Drawing Sheet Generation & Title Block", () => {
  const goldenPartGraph = buildStructuralPartGraph(goldenFixture);

  it("generates a valid standalone ISO A3 vector SVG document", () => {
    const svg = generateShopDrawingsSVG(goldenPartGraph, {
      sheetSize: "A3",
      projectName: "Wardrobe Master Suite",
    });

    expect(typeof svg).toBe("string");
    expect(svg.startsWith("<?xml")).toBe(true);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain(`viewBox="0 0 ${SHEET_SIZES.A3.widthMm} ${SHEET_SIZES.A3.heightMm}"`);

    // Title block metadata
    expect(svg).toContain("Wardrobe Master Suite");
    expect(svg).toContain(goldenPartGraph.sourceSpecId);
    expect(svg).toContain("Rev 1");
    expect(svg).toContain("WORKSHOP REVIEW (NOT CNC)");
    expect(svg).toContain("MILLIMETRES (mm)");

    // Views
    expect(svg).toContain('id="view_front_elevation"');
    expect(svg).toContain('id="view_cross_section"');
    expect(svg).toContain('id="view_plan_top_down"');

    // Material schedule
    expect(svg).toContain('id="material_legend"');
    expect(svg).toContain("18.0 mm Melamine Faced Board");
    expect(svg).toContain("6.0 mm HDF Insert into 7.0 mm Groove");
    expect(svg).toContain("1.0 mm ABS");
    expect(svg).toContain("0.4 mm Melamine");
  });

  it("supports ISO A4 sheet sizing", () => {
    const svg = generateShopDrawingsSVG(goldenPartGraph, { sheetSize: "A4" });
    expect(svg).toContain(`viewBox="0 0 ${SHEET_SIZES.A4.widthMm} ${SHEET_SIZES.A4.heightMm}"`);
  });
});

describe("projectionEngine — Export Triggers (SVG & PDF)", () => {
  const goldenPartGraph = buildStructuralPartGraph(goldenFixture);

  it("exports SVG document cleanly in Node/test environments", () => {
    const result = exportShopDrawingsSVG(goldenPartGraph, "test-drawing.svg");
    expect(result.filename).toBe("test-drawing.svg");
    expect(result.mimeType).toBe("image/svg+xml");
    expect(result.content).toContain("<svg");
  });

  it("triggers browser download link when window and document are defined", () => {
    const mockAppend = vi.fn();
    const mockRemove = vi.fn();
    const mockClick = vi.fn();
    const mockCreateObjectURL = vi.fn(() => "blob:http://localhost/mock-blob-url");
    const mockRevokeObjectURL = vi.fn();

    globalThis.window = {};
    globalThis.document = {
      body: {
        appendChild: mockAppend,
        removeChild: mockRemove,
      },
      createElement: vi.fn(() => ({
        href: "",
        download: "",
        click: mockClick,
      })),
    };
    globalThis.Blob = class {
      constructor(content, options) {
        this.content = content;
        this.options = options;
      }
    };
    globalThis.URL = {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    };

    try {
      const result = exportShopDrawingsSVG(goldenPartGraph, "browser-drawing.svg");
      expect(mockAppend).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRemove).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
      expect(result.filename).toBe("browser-drawing.svg");
    } finally {
      delete globalThis.window;
      delete globalThis.document;
      delete globalThis.Blob;
      delete globalThis.URL;
    }
  });

  it("exports PDF wrapper document with print directives", () => {
    const result = exportShopDrawingsPDF(goldenPartGraph, "test-drawing.pdf");
    expect(result.filename).toBe("test-drawing.pdf");
    expect(result.mimeType).toBe("application/pdf");
    expect(result.content).toContain("<svg");
  });
});
