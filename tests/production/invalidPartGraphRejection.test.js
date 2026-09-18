import { describe, it, expect } from 'vitest';
import { generateShopDrawingsSVG } from '../../src/lib/drawing/projectionEngine.js';
import { compileCabinetDxfPackage, compilePanelToDxf } from '../../src/lib/production/dxfCompiler.js';
import { generateCutListCsv, compileNestingManifest } from '../../src/lib/production/nestingCompiler.js';

function createTestGraph(partOverrides = {}) {
  return {
    qualificationStatus: 'WORKSHOP_REVIEW_NOT_CNC_QUALIFIED',
    metadata: {
      productName: 'invalid-partgraph-test',
      overall: { widthMm: 900, heightMm: 2100, depthMm: 580 },
    },
    parts: [
      {
        id: 'TEST_PANEL_INVALID',
        role: 'DRAWER_BACK',
        quantity: 1,
        materialCode: 'MEL_WHITE_18',
        geometryType: 'RECTANGULAR_PANEL',
        grainDirection: 'LENGTH',
        finished: { lengthDmm: 1760, widthDmm: 0, thicknessDmm: 150, ...partOverrides.finished },
        raw: { lengthDmm: 1760, widthDmm: 0, thicknessDmm: 150, ...partOverrides.raw },
        edges: { LENGTH_EDGE_1: 0, LENGTH_EDGE_2: 0, WIDTH_EDGE_1: 0, WIDTH_EDGE_2: 0 },
        ...partOverrides,
      },
    ],
    operations: [],
  };
}

describe('Permanent Exporter Invalid PartGraph Rejection & Precision Matrix', () => {
  describe('DXF Compiler fail-closed checks', () => {
    it('refuses panel with zero width (PL-006 back width = 0)', () => {
      const graph = createTestGraph({ finished: { lengthDmm: 1760, widthDmm: 0, thicknessDmm: 150 } });
      expect(() => compilePanelToDxf(graph.parts[0], graph)).toThrow(/non-positive flat dimensions/i);
      expect(() => compileCabinetDxfPackage(graph)).toThrow(/non-positive flat dimensions/i);
    });

    it('refuses panel with negative width', () => {
      const graph = createTestGraph({ finished: { lengthDmm: 1760, widthDmm: -100, thicknessDmm: 150 } });
      expect(() => compilePanelToDxf(graph.parts[0], graph)).toThrow(/non-positive flat dimensions/i);
      expect(() => compileCabinetDxfPackage(graph)).toThrow(/non-positive flat dimensions/i);
    });

    it('refuses panel with zero or negative length', () => {
      const graphZeroL = createTestGraph({ finished: { lengthDmm: 0, widthDmm: 500, thicknessDmm: 150 } });
      expect(() => compileCabinetDxfPackage(graphZeroL)).toThrow(/non-positive flat dimensions/i);

      const graphNegL = createTestGraph({ finished: { lengthDmm: -50, widthDmm: 500, thicknessDmm: 150 } });
      expect(() => compileCabinetDxfPackage(graphNegL)).toThrow(/non-positive flat dimensions/i);
    });
  });

  describe('Cut-list CSV fail-closed checks', () => {
    it('refuses panel with zero cut dimensions', () => {
      const graph = createTestGraph({
        raw: { lengthDmm: 1760, widthDmm: 0, thicknessDmm: 150 },
        finished: { lengthDmm: 1760, widthDmm: 0, thicknessDmm: 150 },
      });
      expect(() => generateCutListCsv(graph)).toThrow(/non-positive cut dimensions/i);
    });

    it('refuses panel with negative cut dimensions', () => {
      const graph = createTestGraph({
        raw: { lengthDmm: 1760, widthDmm: -20, thicknessDmm: 150 },
        finished: { lengthDmm: 1760, widthDmm: -20, thicknessDmm: 150 },
      });
      expect(() => generateCutListCsv(graph)).toThrow(/non-positive cut dimensions/i);
    });
  });

  describe('Nesting Preflight fail-closed checks', () => {
    it('refuses manifest compilation when panel has non-positive cut dimensions', () => {
      const graph = createTestGraph({
        raw: { lengthDmm: 1760, widthDmm: 0, thicknessDmm: 150 },
        finished: { lengthDmm: 1760, widthDmm: 0, thicknessDmm: 150 },
      });
      expect(() => compileNestingManifest(graph)).toThrow(/non-positive cut dimensions/i);
    });
  });

  describe('SVG Exporter input rejection boundary (PL-006 closed)', () => {
    it('refuses zero-width finished panel (throw = reject invalid input)', () => {
      const graph = createTestGraph({ finished: { lengthDmm: 1760, widthDmm: 0, thicknessDmm: 150 } });
      // A returned SVG string would be a failure to REJECT invalid input —
      // it would not alone prove a degenerate part was rendered.
      expect(() => generateShopDrawingsSVG(graph)).toThrow(/non-positive|INVALID_FINISHED|refuses an invalid PartGraph/i);
    });

    it('refuses negative width and non-positive thickness', () => {
      expect(() =>
        generateShopDrawingsSVG(
          createTestGraph({ finished: { lengthDmm: 1760, widthDmm: -10, thicknessDmm: 150 } })
        )
      ).toThrow(/non-positive|INVALID_FINISHED|refuses an invalid PartGraph/i);
      expect(() =>
        generateShopDrawingsSVG(
          createTestGraph({ finished: { lengthDmm: 1760, widthDmm: 400, thicknessDmm: 0 } })
        )
      ).toThrow(/non-positive|INVALID_FINISHED|refuses an invalid PartGraph/i);
    });
  });

  describe('Precision boundary checks (0.1 mm / 1 deci-mm precision)', () => {
    it('accepts smallest valid strictly positive panel (1 dmm = 0.1 mm) without arithmetic failure', () => {
      const graphMinPos = createTestGraph({
        finished: { lengthDmm: 1, widthDmm: 1, thicknessDmm: 150 },
        raw: { lengthDmm: 1, widthDmm: 1, thicknessDmm: 150 },
      });
      // DXF, CSV and nesting accept strictly positive dimensions (> 0)
      expect(() => compileCabinetDxfPackage(graphMinPos)).not.toThrow();
      expect(() => generateCutListCsv(graphMinPos)).not.toThrow();
    });
  });
});
