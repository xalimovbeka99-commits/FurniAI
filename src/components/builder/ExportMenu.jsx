"use client";

import { useState } from "react";
import { useFurnitureStore } from "@/store/furnitureStore";
import { exportShopDrawingsSVG, exportShopDrawingsPDF } from "@/lib/drawing/projectionEngine";
import { exportCabinetDxfZip, exportCutListCSV, formatNestingReport } from "@/lib/production/exportBridge";
import { compileNestingManifest } from "@/lib/production/nestingCompiler";
import { buildStructuralPartGraph } from "@/lib/partgraph/buildStructuralPartGraph";
import { adaptWardrobeModelToFurniSpec } from "@/lib/partgraph/wardrobeModelAdapter";
import goldenFixture from "@/lib/furnispec/goldenWardrobe.fixture.json";

export function formatMaterialTupleLabel(material, thicknessMm) {
  const t = Math.round(Number(thicknessMm) || 0);
  const mat = String(material || "").trim();
  const upper = mat.toUpperCase();

  if (upper === "MEL_WHITE_18" || (t === 18 && (upper.includes("CARCASS") || upper.includes("MFC")))) {
    return "18mm Carcass Melamine";
  }
  if (upper === "HDF_WHITE_6" || (t === 6 && (upper.includes("HDF") || upper.includes("BACK")))) {
    return "6mm HDF Backing";
  }
  if (upper === "BIRCH_PLY_15" || (t === 15 && (upper.includes("BIRCH") || upper.includes("PLY") || upper.includes("DRAWER")))) {
    return "15mm Birch Ply";
  }

  // Descriptives
  if (t === 18) return `18mm Carcass Melamine (${mat})`;
  if (t === 6) return `6mm HDF Backing (${mat})`;
  if (t === 15) return `15mm Birch Ply (${mat})`;
  return `${t ? `${t}mm ` : ""}${mat || "Unrouted Material"}`;
}

export function computeMaterialRuns(graph) {
  if (!graph || typeof graph !== "object" || !Array.isArray(graph.parts)) {
    return [];
  }

  const getThicknessMm = (part) => {
    if (!part || typeof part !== "object") return 0;
    if (part.finished && part.finished.thicknessDmm != null) {
      return part.finished.thicknessDmm / 10;
    }
    if (part.raw && part.raw.thicknessDmm != null) {
      return part.raw.thicknessDmm / 10;
    }
    if (part.thicknessMm != null) return Number(part.thicknessMm) || 0;
    if (part.thickness != null) return Number(part.thickness) || 0;
    return 0;
  };

  const buckets = {
    carcass_18mm: {
      id: "carcass_18mm",
      name: "Carcass 18mm",
      parts: [],
    },
    back_6mm: {
      id: "back_6mm",
      name: "Back Panel 6mm",
      parts: [],
    },
    drawer_15mm: {
      id: "drawer_15mm",
      name: "Drawer Box 15mm",
      parts: [],
    },
  };

  const unroutedParts = [];

  for (const part of graph.parts) {
    if (!part || typeof part !== "object") continue;
    const thick = Math.round(getThicknessMm(part));
    const role = String(part.role || "").toUpperCase();

    // 1. Back panel (6mm or BACK_PANEL role)
    if (role === "BACK_PANEL" || thick === 6) {
      buckets.back_6mm.parts.push(part);
    }
    // 2. Drawer box (15mm or DRAWER_* role)
    else if (role.startsWith("DRAWER_") || thick === 15) {
      buckets.drawer_15mm.parts.push(part);
    }
    // 3. Carcass (18mm standard panels)
    else if (thick === 18) {
      buckets.carcass_18mm.parts.push(part);
    }
    // 4. Other materials / unrouted
    else {
      unroutedParts.push(part);
    }
  }

  const runConfigs = [
    buckets.carcass_18mm,
    buckets.back_6mm,
    buckets.drawer_15mm,
  ];

  if (unroutedParts.length > 0) {
    runConfigs.push({
      id: "unrouted",
      name: "Other Materials",
      parts: unroutedParts,
    });
  }

  return runConfigs.map((cfg) => {
    const partsCount = cfg.parts.length;
    let sheetCount = 0;
    let yieldPct = 0;
    let status = partsCount === 0 ? "No parts scheduled" : "Optimized";
    let stockFormat = "2440 × 1220 mm";

    if (partsCount > 0) {
      try {
        const subGraph = { ...graph, parts: cfg.parts };
        const manifest = compileNestingManifest(subGraph);
        if (manifest) {
          sheetCount = Number.isFinite(manifest.sheetCount) ? manifest.sheetCount : 0;
          yieldPct = Number.isFinite(manifest.yieldEfficiencyPct) ? manifest.yieldEfficiencyPct : 0;
          if (manifest.stock) {
            stockFormat = `${manifest.stock.lengthMm} × ${manifest.stock.widthMm} mm`;
          }
          status = "Optimized";
        }
      } catch {
        sheetCount = 0;
        yieldPct = 0;
        status = "Unpackable";
      }
    }

    return {
      id: cfg.id,
      name: cfg.name,
      partsCount: Number.isFinite(partsCount) ? partsCount : 0,
      sheetCount: Number.isFinite(sheetCount) ? sheetCount : 0,
      yieldPct: Number.isFinite(yieldPct) ? yieldPct : 0,
      status,
      stockFormat,
    };
  });
}

export default function ExportMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [nestingModalOpen, setNestingModalOpen] = useState(false);
  const [nestingReport, setNestingReport] = useState(null);
  const [manifestRuns, setManifestRuns] = useState([]);
  const config = useFurnitureStore((s) => s.config);

  function getPartGraph() {
    try {
      if (config && config.type === "wardrobe" && config.dimensions) {
        const model = {
          id: `wardrobe-${Date.now()}`,
          revision: 1,
          widthMm: config.dimensions.width,
          heightMm: config.dimensions.height,
          depthMm: config.dimensions.depth,
          sections: (config.modules || []).map((m, idx) => ({
            id: `bay-${idx + 1}`,
            components: [
              ...(m.kind === "openShelf" ? [{ id: `shelf-${idx + 1}`, type: "SHELF_ADJUSTABLE" }] : []),
              ...(m.kind === "drawerBank" ? [{ id: `drawers-${idx + 1}`, type: "DRAWER_BANK", rows: 3 }] : []),
              { id: `rail-${idx + 1}`, type: "HANGING_RAIL_SHORT" }
            ]
          }))
        };
        const spec = adaptWardrobeModelToFurniSpec(model);
        return buildStructuralPartGraph(spec);
      }
    } catch {
      // Fallback to canonical golden wardrobe
    }
    return buildStructuralPartGraph(goldenFixture);
  }

  function handleExport(type) {
    setIsOpen(false);
    const graph = getPartGraph();
    if (!graph) return;

    switch (type) {
      case "SVG":
        exportShopDrawingsSVG(graph);
        break;
      case "PDF":
        exportShopDrawingsPDF(graph);
        break;
      case "DXF":
        exportCabinetDxfZip(graph);
        break;
      case "CSV":
        exportCutListCSV(graph);
        break;
      case "NESTING": {
        try {
          const manifest = compileNestingManifest(graph);
          const report = formatNestingReport(manifest);
          setNestingReport(report);

          const runs = Array.isArray(manifest.runs) && manifest.runs.length > 0
            ? manifest.runs.map((r) => {
                const stockW = r.stock?.lengthMm || 2440;
                const stockH = r.stock?.widthMm || 1220;
                return {
                  id: r.groupKey || `${r.material}_${r.thicknessMm}`,
                  groupKey: r.groupKey,
                  displayName: formatMaterialTupleLabel(r.material, r.thicknessMm),
                  material: r.material,
                  thicknessMm: r.thicknessMm,
                  sheetCount: Number.isFinite(r.sheetCount) ? r.sheetCount : 0,
                  yieldPct: Number.isFinite(r.yieldEfficiencyPct) ? r.yieldEfficiencyPct : 0,
                  partsCount: Array.isArray(r.items) ? r.items.length : (Array.isArray(r.cutRows) ? r.cutRows.length : 0),
                  status: r.sheetCount > 0 ? "Optimized" : "No parts scheduled",
                  stockFormat: `${stockW} × ${stockH} mm`,
                };
              })
            : computeMaterialRuns(graph).map((r) => ({
                ...r,
                displayName: formatMaterialTupleLabel(r.id, r.id.includes("18") ? 18 : (r.id.includes("6") ? 6 : 15)),
              }));

          setManifestRuns(runs);
          setNestingModalOpen(true);
        } catch (err) {
          alert(`Nesting preflight error: ${err.message}`);
        }
        break;
      }
    }
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-[#DFD9CC] bg-[#FAF9F5] px-3 py-1.5 text-xs font-medium text-[#1C1E21] hover:border-[#00B4D8] hover:bg-white transition-all shadow-sm"
      >
        <span>⚡ Manufacturing &amp; Blueprints</span>
        <span className="text-[9px] opacity-70">▼</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-1.5 w-60 rounded-xl border border-[#DFD9CC] bg-[#FAF9F5] p-1.5 shadow-xl">
            <div className="px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-wider text-[#888]">
              Blueprints &amp; Technical 2D
            </div>
            <button
              type="button"
              onClick={() => handleExport("SVG")}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[#1C1E21] hover:bg-[#EFECE6] hover:text-[#00B4D8] transition-colors text-left"
            >
              <span>📐</span> Shop Blueprints (SVG)
            </button>
            <button
              type="button"
              onClick={() => handleExport("PDF")}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[#1C1E21] hover:bg-[#EFECE6] hover:text-[#00B4D8] transition-colors text-left"
            >
              <span>📄</span> Shop Blueprints (PDF)
            </button>

            <div className="my-1 h-[1px] bg-[#EDE8DC]" />

            <div className="px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-wider text-[#888]">
              Fabrication &amp; CNC
            </div>
            <button
              type="button"
              onClick={() => handleExport("DXF")}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[#1C1E21] hover:bg-[#EFECE6] hover:text-[#00B4D8] transition-colors text-left"
            >
              <span>📦</span> CNC Package (DXF ZIP)
            </button>
            <button
              type="button"
              onClick={() => handleExport("CSV")}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[#1C1E21] hover:bg-[#EFECE6] hover:text-[#00B4D8] transition-colors text-left"
            >
              <span>📊</span> Cut List (CSV)
            </button>
            <button
              type="button"
              onClick={() => handleExport("NESTING")}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[#1C1E21] hover:bg-[#EFECE6] hover:text-[#00B4D8] transition-colors text-left"
            >
              <span>📋</span> Nesting Report
            </button>
          </div>
        </>
      )}

      {nestingModalOpen && nestingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#DFD9CC] bg-[#FAF9F5] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EDE8DC] px-5 py-3.5">
              <h3 className="font-semibold text-sm text-[#1C1E21]">FurniAI Manufacturing Report</h3>
              <button
                type="button"
                onClick={() => setNestingModalOpen(false)}
                className="text-lg leading-none text-[#888] hover:text-[#1C1E21]"
              >
                &times;
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">
              {manifestRuns && manifestRuns.length > 0 && (
                <div className="mb-4 rounded-xl border border-[#E5E0D6] bg-[#FDFBF7] p-3.5">
                  <div className="font-mono text-[10.5px] uppercase tracking-wider text-[#666] font-semibold mb-2.5">
                    Material Runs &amp; Multi-Sheet Optimization
                  </div>
                  <div className="space-y-2">
                    {manifestRuns.map((run) => (
                      <div
                        key={run.id}
                        className="flex items-center justify-between rounded-lg border border-[#EBE6DC] bg-white px-3.5 py-2.5 shadow-sm"
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-[#1C1E21]">{run.displayName}</span>
                          <span className="text-[10px] text-[#888]">
                            {run.partsCount} {run.partsCount === 1 ? "part" : "parts"} &bull; {run.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <div className="text-xs font-bold text-[#1C1E21]">
                              {run.sheetCount} <span className="text-[10px] font-normal text-[#666]">{run.sheetCount === 1 ? "sheet" : "sheets"}</span>
                            </div>
                            <div className="text-[9.5px] text-[#888]">{run.stockFormat || "2440 × 1220 mm"}</div>
                          </div>
                          <div className="min-w-[65px]">
                            <span className="inline-block rounded bg-[#E6F8FB] px-2 py-0.5 text-xs font-semibold text-[#0096B4]">
                              {Number.isFinite(run.yieldPct) ? run.yieldPct.toFixed(1) : "0.0"}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div
                dangerouslySetInnerHTML={{ __html: nestingReport.html }}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-[#EDE8DC] bg-[#F5F3EF] px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  const printWin = window.open("", "_blank");
                  if (printWin) {
                    const runsHtml = (manifestRuns || []).map((r) => `
                      <div style="display:flex;justify-content:space-between;align-items:center;background:#FDFBF7;border:1px solid #EBE6DC;border-radius:6px;padding:8px 12px;margin-bottom:6px;">
                        <div>
                          <strong style="font-size:12px;color:#1C1E21;">${r.displayName}</strong>
                          <div style="font-size:10px;color:#888;">${r.partsCount} parts &bull; ${r.status}</div>
                        </div>
                        <div style="text-align:right;">
                          <div style="font-size:12px;font-weight:700;color:#1C1E21;">${r.sheetCount} sheets (${r.stockFormat})</div>
                          <div style="font-size:11px;font-weight:600;color:#0096B4;">${r.yieldPct.toFixed(1)}% yield</div>
                        </div>
                      </div>
                    `).join("");

                    const batchesSection = runsHtml ? `
                      <div style="margin-bottom:16px;">
                        <div style="font-size:11px;font-weight:600;color:#1C1E21;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Material Runs (Independent Nests)</div>
                        <div>${runsHtml}</div>
                      </div>
                    ` : "";

                    printWin.document.write(`<!DOCTYPE html><html><head><title>Nesting Report</title><style>body{font-family:sans-serif;padding:24px;color:#1C1E21;}</style></head><body>${batchesSection}${nestingReport.html}<script>window.onload=function(){window.print();}</script></body></html>`);
                    printWin.document.close();
                  }
                }}
                className="rounded-lg border border-[#DFD9CC] bg-white px-3 py-1.5 text-xs font-medium text-[#1C1E21] hover:bg-neutral-50"
              >
                Print Report
              </button>
              <button
                type="button"
                onClick={() => setNestingModalOpen(false)}
                className="rounded-lg bg-[#1C1E21] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#00B4D8] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
