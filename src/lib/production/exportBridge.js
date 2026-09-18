/**
 * exportBridge.js — Manufacturing & Blueprints Export Utilities
 * =============================================================
 * Pure-JS browser/Node download bridges for:
 *   - Shop Blueprints (SVG / PDF) via projectionEngine
 *   - CNC Package (DXF ZIP) via compileCabinetDxfPackage + standard PKZip packer
 *   - Cut List (CSV) via generateCutListCsv
 *   - Nesting Report via compileNestingManifest
 */

import { compileCabinetDxfPackage } from "./dxfCompiler.js";
import {
  generateCutListCsv,
  compileNestingManifest,
  buildCutListRows,
} from "./nestingCompiler.js";

// --- CRC32 calculation ---
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

export function computeCrc32(bytes) {
  let crc = 0 ^ -1;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

/**
 * Creates a standard PKZip (uncompressed Store) archive in pure JavaScript.
 *
 * @param {Array<{ name: string, data: string | Uint8Array }>} files
 * @returns {Uint8Array}
 */
export function createZipBuffer(files) {
  const encoder = new TextEncoder();
  const fileEntries = files.map((f) => {
    const nameBytes = encoder.encode(f.name);
    const dataBytes = typeof f.data === "string" ? encoder.encode(f.data) : f.data;
    const crc = computeCrc32(dataBytes);
    return { nameBytes, dataBytes, crc, size: dataBytes.length };
  });

  let totalSize = 0;
  for (const f of fileEntries) {
    totalSize += 30 + f.nameBytes.length + f.size; // local header + name + data
    totalSize += 46 + f.nameBytes.length; // central dir entry
  }
  totalSize += 22; // EOCD

  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);
  let offset = 0;
  const centralDirOffsets = [];

  // Write local headers and file data
  for (const f of fileEntries) {
    centralDirOffsets.push(offset);
    view.setUint32(offset, 0x04034b50, true); // Local file header signature
    view.setUint16(offset + 4, 10, true); // Version needed (1.0)
    view.setUint16(offset + 6, 0, true); // Flags
    view.setUint16(offset + 8, 0, true); // Compression: 0 = Store
    view.setUint16(offset + 10, 0, true); // Mod time
    view.setUint16(offset + 12, 0, true); // Mod date
    view.setUint32(offset + 14, f.crc, true); // CRC-32
    view.setUint32(offset + 18, f.size, true); // Compressed size
    view.setUint32(offset + 22, f.size, true); // Uncompressed size
    view.setUint16(offset + 26, f.nameBytes.length, true); // Filename length
    view.setUint16(offset + 28, 0, true); // Extra field length
    offset += 30;

    buf.set(f.nameBytes, offset);
    offset += f.nameBytes.length;

    buf.set(f.dataBytes, offset);
    offset += f.size;
  }

  const centralDirStart = offset;

  // Write central directory
  for (let i = 0; i < fileEntries.length; i++) {
    const f = fileEntries[i];
    const localHeaderOffset = centralDirOffsets[i];

    view.setUint32(offset, 0x02014b50, true); // Central dir signature
    view.setUint16(offset + 4, 20, true); // Version made by
    view.setUint16(offset + 6, 10, true); // Version needed
    view.setUint16(offset + 8, 0, true); // Flags
    view.setUint16(offset + 10, 0, true); // Compression: 0 = Store
    view.setUint16(offset + 12, 0, true); // Mod time
    view.setUint16(offset + 14, 0, true); // Mod date
    view.setUint32(offset + 16, f.crc, true); // CRC-32
    view.setUint32(offset + 20, f.size, true); // Compressed size
    view.setUint32(offset + 24, f.size, true); // Uncompressed size
    view.setUint16(offset + 28, f.nameBytes.length, true); // Filename length
    view.setUint16(offset + 30, 0, true); // Extra field length
    view.setUint16(offset + 32, 0, true); // Comment length
    view.setUint16(offset + 34, 0, true); // Disk number start
    view.setUint16(offset + 36, 0, true); // Internal file attributes
    view.setUint32(offset + 38, 0, true); // External file attributes
    view.setUint32(offset + 42, localHeaderOffset, true); // Offset of local header
    offset += 46;

    buf.set(f.nameBytes, offset);
    offset += f.nameBytes.length;
  }

  const centralDirSize = offset - centralDirStart;

  // Write End of Central Directory (EOCD)
  view.setUint32(offset, 0x06054b50, true); // EOCD signature
  view.setUint16(offset + 4, 0, true); // Disk number
  view.setUint16(offset + 6, 0, true); // Disk with central dir
  view.setUint16(offset + 8, fileEntries.length, true); // Entries on disk
  view.setUint16(offset + 10, fileEntries.length, true); // Total entries
  view.setUint32(offset + 12, centralDirSize, true); // Size of central dir
  view.setUint32(offset + 16, centralDirStart, true); // Offset of central dir
  view.setUint16(offset + 20, 0, true); // Comment length

  return buf;
}

/**
 * Triggers browser file download using a Blob and anchor element.
 */
export function triggerFileDownload(filename, mimeType, data) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export Cut List CSV and trigger browser download.
 *
 * @param {object} partGraph
 * @param {string} [filename]
 * @returns {{ filename: string, mimeType: string, content: string }}
 */
export function exportCutListCSV(partGraph, filename) {
  const csvContent = generateCutListCsv(partGraph);
  const name =
    filename || `${partGraph?.sourceSpecId || "furniai"}-cut-list.csv`;

  triggerFileDownload(name, "text/csv;charset=utf-8;", csvContent);

  return {
    filename: name,
    mimeType: "text/csv",
    content: csvContent,
  };
}

/**
 * Export CNC Package (DXF ZIP) containing individual AutoCAD DXFs for each panel.
 *
 * @param {object} partGraph
 * @param {string} [filename]
 * @param {object} [options]
 * @returns {{ filename: string, mimeType: string, buffer: Uint8Array, fileCount: number }}
 */
export function exportCabinetDxfZip(partGraph, filename, options = {}) {
  const dxfFiles = compileCabinetDxfPackage(partGraph, options);
  const name =
    filename || `${partGraph?.sourceSpecId || "furniai"}-cnc-dxf.zip`;

  const filesToZip = dxfFiles.map((f) => ({
    name: f.filename,
    data: f.dxfContent,
  }));

  // Add an informative README / MANIFEST
  const manifestText = [
    "============================================================",
    "FurniAI CNC Fabrication Package — AutoCAD R12 DXF Layer Set",
    "============================================================",
    `Source Spec ID: ${partGraph?.sourceSpecId || "N/A"}`,
    `Qualification Status: ${partGraph?.qualificationStatus || "WORKSHOP_REVIEW_NOT_CNC_QUALIFIED"}`,
    `Total Machinable Panels: ${dxfFiles.length}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "LAYERS INCLUDED:",
    "  - OUTLINE_CONTOUR: Closed perimeter polyline (outer dimension)",
    "  - GROOVE_BACK_PANEL: Back panel insert groove toolpath (7.0 mm width)",
    "  - DRILL_SYSTEM_32: Shelf pin holes (Fail-closed: requires CNC_QUALIFIED)",
    "",
    "PANEL FILES:",
    ...dxfFiles.map((f) => `  * ${f.filename}`),
    "============================================================",
  ].join("\n");

  filesToZip.push({
    name: "README_CNC_PACKAGE.txt",
    data: manifestText,
  });

  const zipBuffer = createZipBuffer(filesToZip);

  triggerFileDownload(name, "application/zip", zipBuffer);

  return {
    filename: name,
    mimeType: "application/zip",
    buffer: zipBuffer,
    fileCount: dxfFiles.length,
  };
}

/**
 * Formats a clean Nesting Report summarizing sheet count, material yield %,
 * and edge-banding linear meters.
 *
 * @param {object} manifest - compiled nesting manifest from compileNestingManifest
 * @returns {object} formatted report with stats, plain text, and HTML
 */
export function formatNestingReport(manifest) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("formatNestingReport requires a compiled nesting manifest.");
  }

  const stockW = manifest.stock?.lengthMm || 2440;
  const stockH = manifest.stock?.widthMm || 1220;
  const totalSheetM2 = (manifest.totalSheetAreaMm2 / 1e6).toFixed(2);
  const totalPanelM2 = (manifest.totalPanelAreaMm2 / 1e6).toFixed(2);
  // Prefer largest-run yield as headline; list per-run yields when present.
  const yieldPct = Number(manifest.yieldEfficiencyPct ?? manifest.blendedYieldEfficiencyPct ?? 0).toFixed(1);

  const edgeBandingLines = [];
  const bandingEntries = Object.entries(
    manifest.edgeBandingLinearMetersByThicknessMm || {}
  );
  for (const [thickness, meters] of bandingEntries) {
    const label =
      thickness === "1" || thickness === "1.0"
        ? "1.0 mm ABS (Front / Exposed Edges)"
        : `${thickness} mm Edge Tape`;
    edgeBandingLines.push({
      thicknessMm: Number(thickness),
      label,
      linearMeters: meters,
    });
  }

  const textLines = [
    "============================================================",
    "FurniAI Sheet Nesting & Material Optimization Report",
    "============================================================",
    `Stock Format:       ${manifest.primaryStockId} (${stockW} × ${stockH} mm)`,
    `Required Sheets:    ${manifest.sheetCount} sheets`,
    `Material Yield:     ${yieldPct}% (primary run; see per-material runs)`,
    `Total Sheet Area:   ${totalSheetM2} m²`,
    `Net Panel Area:     ${totalPanelM2} m²`,
    `Kerf Width:         ${manifest.kerfMm} mm`,
    `Perimeter Trim:     ${manifest.perimeterTrimMm} mm`,
    "------------------------------------------------------------",
    "EDGE-BANDING SCHEDULE:",
    ...edgeBandingLines.map(
      (e) => `  • ${e.label}: ${e.linearMeters.toFixed(2)} m`
    ),
    "------------------------------------------------------------",
    ...(Array.isArray(manifest.runs) && manifest.runs.length
      ? [
          "MATERIAL RUNS (independent nests — yield per group):",
          ...manifest.runs.map(
            (r) =>
              `  • ${r.material} @ ${r.thicknessMm} mm: ${r.sheetCount} sheet(s), yield ${Number(r.yieldEfficiencyPct).toFixed(1)}%`
          ),
          "------------------------------------------------------------",
        ]
      : []),
    `Total Parts Placed: ${manifest.cutList?.length || 0}`,
    "============================================================",
  ];

  const html = `
<div class="nesting-report-modal-content">
  <div style="font-family:'Space Mono',monospace;font-size:11px;color:#888;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">Manufacturing Preflight</div>
  <h3 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1C1E21;">Sheet Nesting &amp; Material Report</h3>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px;">
    <div style="background:#F5F3EF;padding:12px;border-radius:8px;border:1px solid #E5E0D6;">
      <div style="font-size:10.5px;color:#666;text-transform:uppercase;letter-spacing:.05em;">Sheets Required</div>
      <div style="font-size:22px;font-weight:700;color:#1C1E21;margin-top:2px;">${manifest.sheetCount} <span style="font-size:12px;font-weight:400;color:#666;">sheets</span></div>
      <div style="font-size:10px;color:#888;margin-top:2px;">${stockW} × ${stockH} mm</div>
    </div>
    <div style="background:#F5F3EF;padding:12px;border-radius:8px;border:1px solid #E5E0D6;">
      <div style="font-size:10.5px;color:#666;text-transform:uppercase;letter-spacing:.05em;">Material Yield</div>
      <div style="font-size:22px;font-weight:700;color:#00B4D8;margin-top:2px;">${yieldPct}%</div>
      <div style="font-size:10px;color:#888;margin-top:2px;">${totalPanelM2} m² of ${totalSheetM2} m²</div>
    </div>
    <div style="background:#F5F3EF;padding:12px;border-radius:8px;border:1px solid #E5E0D6;">
      <div style="font-size:10.5px;color:#666;text-transform:uppercase;letter-spacing:.05em;">Cut Parts</div>
      <div style="font-size:22px;font-weight:700;color:#1C1E21;margin-top:2px;">${manifest.cutList?.length || 0}</div>
      <div style="font-size:10px;color:#888;margin-top:2px;">Kerf: ${manifest.kerfMm} mm</div>
    </div>
  </div>

  <div style="margin-bottom:18px;">
    <div style="font-size:11px;font-weight:600;color:#1C1E21;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Edge-Banding Linear Meters</div>
    <div style="background:#fff;border:1px solid #E5E0D6;border-radius:8px;padding:10px 14px;">
      ${edgeBandingLines
        .map(
          (e) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #F0ECE4;font-size:12px;">
          <span style="color:#444;">${e.label}</span>
          <strong style="font-family:'Space Mono',monospace;color:#1C1E21;">${e.linearMeters.toFixed(2)} m</strong>
        </div>`
        )
        .join("")}
    </div>
  </div>

  <div style="font-size:10.5px;color:#888;line-height:1.4;">
    Optimization: First-Fit Decreasing Height (FFDH) shelf packing. Guillotine cut compatible.
  </div>
</div>
  `.trim();

  return {
    sheetCount: manifest.sheetCount,
    primaryStockId: manifest.primaryStockId,
    stockDimensionsMm: { length: stockW, width: stockH },
    yieldEfficiencyPct: manifest.yieldEfficiencyPct,
    totalSheetAreaM2: Number(totalSheetM2),
    totalPanelAreaM2: Number(totalPanelM2),
    edgeBanding: edgeBandingLines,
    partsCount: manifest.cutList?.length || 0,
    text: textLines.join("\n"),
    html,
  };
}
