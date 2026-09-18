/**
 * Independent probe: minimal invalid PartGraph (DRAWER_BACK width 0)
 * against SVG / DXF / CSV / nesting exporters separately.
 */
import { generateShopDrawingsSVG } from '../../src/lib/drawing/projectionEngine.js';
import { compileCabinetDxfPackage, compilePanelToDxf } from '../../src/lib/production/dxfCompiler.js';
import {
  generateCutListCsv,
  compileNestingManifest,
  buildCutListRows,
} from '../../src/lib/production/nestingCompiler.js';
import { formatNestingReport } from '../../src/lib/production/exportBridge.js';

function panelZeroBack() {
  // finished widthDmm = 0 → 0 mm (DRAWER_BACK at W=51 bay)
  // length 176 mm as cited in PL006 (176×0)
  return {
    id: 'DRW_BACK_ZERO',
    role: 'DRAWER_BACK',
    quantity: 1,
    materialCode: 'MEL_WHITE_18',
    geometryType: 'RECTANGULAR_PANEL',
    grainDirection: 'LENGTH',
    finished: { lengthDmm: 1760, widthDmm: 0, thicknessDmm: 120 },
    raw: { lengthDmm: 1760, widthDmm: 0, thicknessDmm: 120 },
    edges: { LENGTH_EDGE_1: 0, LENGTH_EDGE_2: 0, WIDTH_EDGE_1: 0, WIDTH_EDGE_2: 0 },
  };
}

function panelValidCompanion() {
  return {
    id: 'SIDE_OK',
    role: 'LEFT_SIDE',
    quantity: 1,
    materialCode: 'MEL_WHITE_18',
    geometryType: 'RECTANGULAR_PANEL',
    grainDirection: 'LENGTH',
    finished: { lengthDmm: 24000, widthDmm: 5800, thicknessDmm: 180 },
    raw: { lengthDmm: 24000, widthDmm: 5800, thicknessDmm: 180 },
    edges: { LENGTH_EDGE_1: 0, LENGTH_EDGE_2: 0, WIDTH_EDGE_1: 0, WIDTH_EDGE_2: 0 },
  };
}

const graph = {
  qualificationStatus: 'WORKSHOP_REVIEW_NOT_CNC_QUALIFIED',
  metadata: { productName: 'PL006-invalid-probe', overall: { widthMm: 900, heightMm: 2100, depthMm: 580 } },
  parts: [panelZeroBack(), panelValidCompanion()],
  operations: [],
};

const graphSolo = {
  qualificationStatus: 'WORKSHOP_REVIEW_NOT_CNC_QUALIFIED',
  metadata: { productName: 'PL006-invalid-solo', overall: { widthMm: 900, heightMm: 2100, depthMm: 580 } },
  parts: [panelZeroBack()],
  operations: [],
};

function run(label, fn) {
  try {
    const result = fn();
    const summary =
      typeof result === 'string'
        ? { type: 'string', length: result.length, head: result.slice(0, 120).replace(/\n/g, '\\n') }
        : Array.isArray(result)
          ? { type: 'array', length: result.length, filenames: result.map((r) => r.filename || r.id || '?') }
          : result && typeof result === 'object'
            ? {
                type: 'object',
                keys: Object.keys(result).slice(0, 12),
                sheets: result.sheets?.length,
                status: result.status || result.preflightStatus || result.ok,
                issues: result.issues || result.errors || result.warnings,
              }
            : { type: typeof result, value: result };
    return { label, outcome: 'RETURNED', summary };
  } catch (err) {
    return { label, outcome: 'THREW', error: String(err && err.message ? err.message : err) };
  }
}

const results = [];

// SVG
results.push(
  run('SVG generateShopDrawingsSVG(graph with zero BACK + valid side)', () => {
    const svg = generateShopDrawingsSVG(graph);
    return typeof svg === 'string' ? svg : svg?.svg || svg?.content || JSON.stringify(svg).slice(0, 200);
  })
);
results.push(
  run('SVG generateShopDrawingsSVG(solo zero BACK)', () => {
    const svg = generateShopDrawingsSVG(graphSolo);
    return typeof svg === 'string' ? svg : svg?.svg || svg?.content || JSON.stringify(svg).slice(0, 200);
  })
);

// DXF package
results.push(
  run('DXF compileCabinetDxfPackage(graph with zero BACK + valid)', () => compileCabinetDxfPackage(graph))
);
results.push(
  run('DXF compileCabinetDxfPackage(solo zero BACK)', () => compileCabinetDxfPackage(graphSolo))
);
results.push(
  run('DXF compilePanelToDxf(zero BACK panel alone)', () =>
    compilePanelToDxf(panelZeroBack())
  )
);

// CSV / cut list
results.push(
  run('CSV buildCutListRows(graph with zero BACK)', () => buildCutListRows(graph))
);
results.push(
  run('CSV generateCutListCsv(graph with zero BACK)', () => generateCutListCsv(graph))
);
results.push(
  run('CSV generateCutListCsv(solo zero BACK)', () => generateCutListCsv(graphSolo))
);

// Nesting
results.push(
  run('NEST compileNestingManifest(graph with zero BACK)', () => compileNestingManifest(graph))
);
results.push(
  run('NEST compileNestingManifest(solo zero BACK)', () => compileNestingManifest(graphSolo))
);
results.push(
  run('NEST formatNestingReport after compile (if compile succeeds)', () => {
    const m = compileNestingManifest(graph);
    return formatNestingReport(m);
  })
);

console.log(JSON.stringify({ tipProbe: 'invalid-DRAWER_BACK-width-0', results }, null, 2));
