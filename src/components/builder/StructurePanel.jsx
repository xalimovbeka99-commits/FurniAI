"use client";

/**
 * StructurePanel (LEFT) — what the piece IS.
 * Furniture type, and per-module structure: kind, door/drawer/shelf counts.
 * Click a door/drawer in the 3D view to select its module here.
 */
import { useFurnitureStore } from "@/store/furnitureStore";
import { FURNITURE_TYPES } from "@/lib/knowledgeBase";

const MODULE_KINDS = [
  ["door", "Doors"],
  ["drawerBank", "Drawers"],
  ["openShelf", "Open shelves"],
];

export default function StructurePanel() {
  const config = useFurnitureStore((s) => s.config);
  const setType = useFurnitureStore((s) => s.setType);
  const addModule = useFurnitureStore((s) => s.addModule);
  const removeModule = useFurnitureStore((s) => s.removeModule);
  const updateModule = useFurnitureStore((s) => s.updateModule);
  const selectedModule = useFurnitureStore((s) => s.selectedModule);
  const selectModule = useFurnitureStore((s) => s.selectModule);

  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-r border-[#EDE8DC] bg-[#FAF9F5]/90 backdrop-blur-sm p-4 text-sm shadow-sm flex flex-col">
      <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-[#5C626E]">Structure</h2>

      <label className="mb-1 block text-[#5C626E] font-medium text-xs">Furniture type</label>
      <select
        className="mb-5 w-full rounded-lg border border-[#DFD9CC] bg-[#FAF9F5] px-3 py-2 text-sm text-[#1C1E21] focus:border-[#00B4D8] focus:outline-none transition-colors duration-150 shadow-sm"
        value={config.type}
        onChange={(e) => setType(e.target.value)}
      >
        {Object.entries(FURNITURE_TYPES).map(([key, t]) => (
          <option key={key} value={key}>{t.label}</option>
        ))}
      </select>

      <div className="mb-3 flex items-center justify-between">
        <span className="text-[#5C626E] font-medium text-xs">Sections ({config.modules.length})</span>
        <button 
          onClick={addModule} 
          className="rounded-lg bg-[#1C1E21] px-3 py-1.5 text-xs text-[#FAF9F5] hover:bg-[#00B4D8] hover:shadow-[0_0_8px_rgba(0,180,216,0.3)] transition-all duration-150 font-mono font-medium"
        >
          Add section
        </button>
      </div>

      <div className="space-y-3 overflow-y-auto pr-1 flex-1">
        {config.modules.map((m, i) => {
          const selected = selectedModule === i;
          return (
            <div
              key={i}
              onClick={() => selectModule(i)}
              className={`cursor-pointer rounded-xl border p-3 transition-all duration-150 ${
                selected ? "border-[#00B4D8] bg-[#F0FDFD] shadow-[0_0_10px_rgba(0,180,216,0.1)]" : "border-[#EDE8DC] bg-white hover:border-[#C5A880]/45"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold text-[#1C1E21] text-xs">Section {i + 1}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeModule(i); }}
                  className="text-xs text-[#5C626E]/60 hover:text-red-600 transition-colors"
                >
                  Remove
                </button>
              </div>

              <select
                className="mb-2 w-full rounded-lg border border-[#DFD9CC] bg-[#FAF9F5] px-2 py-1.5 text-xs text-[#1C1E21] focus:border-[#00B4D8] focus:outline-none transition-colors duration-150"
                value={m.kind}
                onChange={(e) => updateModule(i, { kind: e.target.value })}
              >
                {MODULE_KINDS.map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>

              {m.kind === "door" && (
                <Row label="Doors" value={m.doorCount}
                  onChange={(v) => updateModule(i, { doorCount: v })} min={1} max={4} />
              )}
              {m.kind === "drawerBank" && (
                <Row label="Drawer rows" value={m.drawerRows}
                  onChange={(v) => updateModule(i, { drawerRows: v })} min={1} max={6} />
              )}
              {(m.kind === "door" || m.kind === "openShelf") && (
                <Row label="Shelves" value={m.shelfCount}
                  onChange={(v) => updateModule(i, { shelfCount: v })} min={0} max={8} />
              )}
              {m.kind === "door" && (
                <div className="mt-3 flex gap-2">
                  {["left", "right"].map((side) => (
                    <button key={side}
                      onClick={(e) => { e.stopPropagation(); updateModule(i, { hingeSide: side }); }}
                      className={`flex-1 rounded-lg border px-2 py-1 text-xs font-mono transition-all duration-150 ${
                        m.hingeSide === side 
                          ? "border-[#00B4D8] bg-[#00B4D8] text-white shadow-sm" 
                          : "border-[#DFD9CC] bg-white text-[#5C626E] hover:border-[#00B4D8] hover:text-[#00B4D8]"
                      }`}>
                      Hinge {side}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function Row({ label, value, onChange, min, max }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <span className="text-xs text-[#5C626E] font-medium">{label}</span>
      <div className="flex items-center gap-1.5">
        <button 
          onClick={(e) => { e.stopPropagation(); onChange(Math.max(min, value - 1)); }}
          className="h-6 w-6 rounded-md border border-[#DFD9CC] bg-[#FAF9F5] text-xs font-bold hover:border-[#00B4D8] hover:text-[#00B4D8] transition-colors flex items-center justify-center"
        >
          −
        </button>
        <span className="w-6 text-center tabular-nums text-xs font-semibold text-[#1C1E21]">{value}</span>
        <button 
          onClick={(e) => { e.stopPropagation(); onChange(Math.min(max, value + 1)); }}
          className="h-6 w-6 rounded-md border border-[#DFD9CC] bg-[#FAF9F5] text-xs font-bold hover:border-[#00B4D8] hover:text-[#00B4D8] transition-colors flex items-center justify-center"
        >
          +
        </button>
      </div>
    </div>
  );
}
