import { describe, it, expect } from 'vitest';
import { buildStructuralPartGraph } from '../../src/lib/partgraph/buildStructuralPartGraph.js';
import goldenSpec from '../../src/lib/furnispec/goldenWardrobe.fixture.json';
import { generateShopDrawingsSVG } from '../../src/lib/drawing/projectionEngine.js';
import { compileCabinetDxfPackage, compilePanelToDxf } from '../../src/lib/production/dxfCompiler.js';
import { generateCutListCsv, compileNestingManifest } from '../../src/lib/production/nestingCompiler.js';

/** Positive control: verified valid baseline PartGraph */
function createPositiveControlGraph() {
  return buildStructuralPartGraph(goldenSpec);
}

/** Mutate exactly one dimension of one target part in a deep-cloned graph */
function mutateSingleDimension(baseGraph, targetPartId, category, dimKey, value) {
  const cloned = JSON.parse(JSON.stringify(baseGraph));
  const part = cloned.parts.find((p) => p.id === targetPartId);
  if (!part) throw new Error('Target part "' + targetPartId + '" not found in positive control.');
  part[category][dimKey] = value;
  return cloned;
}

describe('Permanent Exporter Invalid PartGraph Rejection Matrix', () => {
  const positiveControl = createPositiveControlGraph();
  const testPartId = positiveControl.parts[0].id; // e.g. CARC_TOP

  describe('Positive Control Baseline', () => {
    it('verifies positive control passes all exporters without throwing', () => {
      expect(() => compileCabinetDxfPackage(positiveControl)).not.toThrow();
      expect(() => generateCutListCsv(positiveControl)).not.toThrow();
      expect(() => compileNestingManifest(positiveControl)).not.toThrow();
      const svg = generateShopDrawingsSVG(positiveControl);
      expect(typeof svg).toBe('string');
      expect(svg.length).toBeGreaterThan(0);
    });
  });

  describe('Single-Dimension Mutation: Finished Dimensions (DXF fail-closed)', () => {
    const finishedFailClosedMutations = [
      { dim: 'lengthDmm', value: 0, label: 'zero finished length' },
      { dim: 'lengthDmm', value: -100, label: 'negative finished length' },
      { dim: 'widthDmm', value: 0, label: 'zero finished width (PL-006 boundary)' },
      { dim: 'widthDmm', value: -50, label: 'negative finished width' },
    ];

    for (const { dim, value, label } of finishedFailClosedMutations) {
      it('DXF refuses ' + label, () => {
        const mutated = mutateSingleDimension(positiveControl, testPartId, 'finished', dim, value);
        expect(() => compileCabinetDxfPackage(mutated)).toThrow(/non-positive flat dimensions/i);
      });
    }
  });

  describe('Single-Dimension Mutation: Raw Cut Dimensions (CSV & Nesting fail-closed)', () => {
    const rawFailClosedMutations = [
      { dim: 'lengthDmm', value: 0, label: 'zero raw length' },
      { dim: 'lengthDmm', value: -200, label: 'negative raw length' },
      { dim: 'widthDmm', value: 0, label: 'zero raw width' },
      { dim: 'widthDmm', value: -150, label: 'negative raw width' },
    ];

    for (const { dim, value, label } of rawFailClosedMutations) {
      it('CSV cut list refuses ' + label, () => {
        const mutated = mutateSingleDimension(positiveControl, testPartId, 'raw', dim, value);
        expect(() => generateCutListCsv(mutated)).toThrow(/non-positive cut dimensions/i);
      });

      it('Nesting preflight refuses ' + label, () => {
        const mutated = mutateSingleDimension(positiveControl, testPartId, 'raw', dim, value);
        expect(() => compileNestingManifest(mutated)).toThrow(/non-positive cut dimensions/i);
      });
    }
  });

  describe('Thickness Exporter Rejection Gap (Defect Characterization)', () => {
    // Current baseline behavior: DXF, CSV, and Nesting do not yet validate panel thickness <= 0.
    // NOTE FOR GROK/CLAUDE: When the thickness validation gate lands in dxfCompiler & nestingCompiler,
    // replace these characterization assertions with expect(...).toThrow(/non-positive/i).
    it('documents current gap: DXF does not yet reject non-positive finished thickness', () => {
      const zeroThick = mutateSingleDimension(positiveControl, testPartId, 'finished', 'thicknessDmm', 0);
      const negThick = mutateSingleDimension(positiveControl, testPartId, 'finished', 'thicknessDmm', -180);
      expect(() => compileCabinetDxfPackage(zeroThick)).not.toThrow();
      expect(() => compileCabinetDxfPackage(negThick)).not.toThrow();
    });

    it('documents current gap: CSV cut list does not yet reject non-positive raw thickness', () => {
      const zeroThick = mutateSingleDimension(positiveControl, testPartId, 'raw', 'thicknessDmm', 0);
      const negThick = mutateSingleDimension(positiveControl, testPartId, 'raw', 'thicknessDmm', -180);
      expect(() => generateCutListCsv(zeroThick)).not.toThrow();
      expect(() => generateCutListCsv(negThick)).not.toThrow();
    });

    it('documents current gap: Nesting preflight does not yet reject non-positive raw thickness', () => {
      const zeroThick = mutateSingleDimension(positiveControl, testPartId, 'raw', 'thicknessDmm', 0);
      const negThick = mutateSingleDimension(positiveControl, testPartId, 'raw', 'thicknessDmm', -180);
      expect(() => compileNestingManifest(zeroThick)).not.toThrow();
      expect(() => compileNestingManifest(negThick)).not.toThrow();
    });
  });

  describe('SVG Exporter Rejection Gap (Defect Characterization)', () => {
    it('documents failure to reject invalid zero-width input (to be replaced with rejection assertion when fix lands)', () => {
      const zeroBack = mutateSingleDimension(positiveControl, testPartId, 'finished', 'widthDmm', 0);
      // NOTE FOR GROK/CLAUDE: Returning SVG proves failure to reject invalid input;
      // it does not alone prove a degenerate part was visually rendered.
      // Replace this characterization assertion with expect(...).toThrow(...) once the SVG gate is wired.
      const result = generateShopDrawingsSVG(zeroBack);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Precision Boundary vs Manufacturability', () => {
    it('DXF and CSV accept 0.1 mm (1 dmm) strictly positive dimensions without arithmetic underflow on ungrooved panels', () => {
      // Use SHELF_FIX_L1 (no back groove) to test pure flat dimension handling at minimum precision boundary
      const ungroovedPartId = 'SHELF_FIX_L1';
      const minPosGraph = mutateSingleDimension(positiveControl, ungroovedPartId, 'finished', 'widthDmm', 1);
      const targetPart = minPosGraph.parts.find((p) => p.id === ungroovedPartId);
      targetPart.raw.widthDmm = 1;

      // DXF outline and CSV cut list accept 0.1 mm (1 dmm) without arithmetic underflow
      expect(() => compileCabinetDxfPackage(minPosGraph)).not.toThrow();
      expect(() => generateCutListCsv(minPosGraph)).not.toThrow();

      // CAUTION / LIMITATIONS:
      // 1. Arithmetic acceptance at 0.1 mm does not establish practical manufacturability.
      // 2. Nesting is intentionally not exercised here; precision claims do not extend to nesting stock packing.
      // 3. Grooved panels (like CARC_TOP) fail DXF containment at 0.1 mm because the groove margin (7-10 mm)
      //    crosses the 0.1 mm outer outline.
    });
  });
});
