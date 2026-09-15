"use client";

import { useState } from "react";
import { useFurnitureStore } from "@/store/furnitureStore";
import { exportShopDrawingsSVG, exportShopDrawingsPDF } from "@/lib/drawing/projectionEngine";
import { exportCabinetDxfZip, exportCutListCSV, formatNestingReport } from "@/lib/production/exportBridge";
import { compileNestingManifest } from "@/lib/production/nestingCompiler";
import { buildStructuralPartGraph } from "@/lib/partgraph/buildStructuralPartGraph";
import { adaptWardrobeModelToFurniSpec } from "@/lib/partgraph/wardrobeModelAdapter";
import goldenFixture from "@/lib/furnispec/goldenWardrobe.fixture.json";

export default function ExportMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [nestingModalOpen, setNestingModalOpen] = useState(false);
  const [nestingReport, setNestingReport] = useState(null);
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
            <div
              className="max-h-[70vh] overflow-y-auto p-5"
              dangerouslySetInnerHTML={{ __html: nestingReport.html }}
            />
            <div className="flex justify-end gap-2 border-t border-[#EDE8DC] bg-[#F5F3EF] px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  const printWin = window.open("", "_blank");
                  if (printWin) {
                    printWin.document.write(`<!DOCTYPE html><html><head><title>Nesting Report</title><style>body{font-family:sans-serif;padding:24px;color:#1C1E21;}</style></head><body>${nestingReport.html}<script>window.onload=function(){window.print();}</script></body></html>`);
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
