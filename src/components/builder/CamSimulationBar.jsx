"use client";

/**
 * src/components/builder/CamSimulationBar.jsx
 * =====================================================================
 * Non-intrusive CAM Simulation & Timeline Scrubber Toolbar
 *
 * Placed below the 3D canvas viewport:
 * - Normalized scrubber slider (t in [0, 1]) stepping through tool operations
 * - Dynamic playback (Play, Pause, Step Forward, Step Back, Reset)
 * - Real-time telemetry (Coordinates X/Y/Z, Z-depth, Feedrate, G00/G01 move type)
 * - Layer visibility toggles: [x] Carcass Panels, [x] Cut Vectors, [x] Rapid Trajectories, [x] Vacuum Pods, [x] Kerf Ribbon
 * - Collision status indicator (15 mm vacuum pod safety halo)
 */

import { useState, useEffect, useRef } from "react";

export default function CamSimulationBar({
  currentT = 0,
  onSeek,
  stepInfo = null,
  collisionStatus = null,
  visibleLayers = {
    carcass: true,
    cutVectors: true,
    rapidTrajectories: true,
    vacuumPods: true,
    kerfRibbon: true,
  },
  onToggleLayer,
  onReset,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(null);

  // Playback animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = null;
      return;
    }

    const durationMs = 12000 / playbackSpeed; // 12s per complete cycle at 1x

    const loop = (now) => {
      if (!lastTimeRef.current) lastTimeRef.current = now;
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      const deltaT = delta / durationMs;
      const nextT = currentT + deltaT;

      if (nextT >= 1) {
        if (onSeek) onSeek(1);
        setIsPlaying(false);
      } else {
        if (onSeek) onSeek(nextT);
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, currentT, playbackSpeed, onSeek]);

  const handleSliderChange = (e) => {
    const val = parseFloat(e.target.value);
    if (onSeek) onSeek(val);
  };

  const total = stepInfo?.totalOps || (Array.isArray(stepInfo?.operations) ? stepInfo.operations.length : 10);

  const handleStepBack = () => {
    const currentOpIdx = stepInfo?.opIndex != null ? stepInfo.opIndex - 1 : Math.floor(currentT * total);
    const prevIdx = Math.max(0, currentOpIdx - 1);
    const next = prevIdx / Math.max(1, total);
    if (onSeek) onSeek(next);
  };

  const handleStepForward = () => {
    const currentOpIdx = stepInfo?.opIndex != null ? stepInfo.opIndex - 1 : Math.floor(currentT * total);
    const nextIdx = Math.min(total - 1, currentOpIdx + 1);
    const next = nextIdx / Math.max(1, total);
    if (onSeek) onSeek(next);
  };

  const activeOp = stepInfo?.activeOp;
  const isRapid = activeOp?.type === "G00" || activeOp?.category === "RAPID" || !activeOp?.isCutting;
  const hasCollision = collisionStatus?.hasCollision;

  return (
    <div className="cam-sim-bar-container fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-5xl transition-all duration-300">
      <div className="bg-[#16181e]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-3 text-white">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              CAM Simulation (M3)
            </span>

            {/* Collision Status Badge */}
            {hasCollision ? (
              <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1">
                <span>⚠️</span> COLLISION HAZARD ({collisionStatus.collisions.length} pods within 15mm halo)
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[11px] font-medium rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span>✓</span> 15mm Vacuum Clearance OK
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-xs text-neutral-400 hover:text-white px-2 py-0.5 rounded border border-white/10 hover:bg-white/5 transition"
            >
              {isCollapsed ? "Expand ▲" : "Collapse ▼"}
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <>
            {/* Timeline Slider & Controls */}
            <div className="flex flex-col md:flex-row items-center gap-3 my-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    if (onReset) onReset();
                    else if (onSeek) onSeek(0);
                    setIsPlaying(false);
                  }}
                  title="Reset to Start"
                  className="p-1.5 rounded hover:bg-white/10 text-neutral-300 hover:text-white transition text-xs font-bold"
                >
                  ⏮
                </button>
                <button
                  onClick={handleStepBack}
                  title="Step Back Operation"
                  className="p-1.5 rounded hover:bg-white/10 text-neutral-300 hover:text-white transition text-xs"
                >
                  ◀
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  title={isPlaying ? "Pause Simulation" : "Play Simulation"}
                  className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow flex items-center gap-1"
                >
                  {isPlaying ? "❚❚ Pause" : "▶ Play"}
                </button>
                <button
                  onClick={handleStepForward}
                  title="Step Forward Operation"
                  className="p-1.5 rounded hover:bg-white/10 text-neutral-300 hover:text-white transition text-xs"
                >
                  ▶
                </button>
              </div>

              {/* Scrubber Range Slider */}
              <div className="flex-1 w-full flex items-center gap-2">
                <span className="text-[11px] font-mono text-neutral-400 w-10 text-right">
                  {(currentT * 100).toFixed(0)}%
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.0005"
                  value={currentT}
                  onChange={handleSliderChange}
                  className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-400 focus:outline-none"
                />
              </div>

              {/* Playback speed selector */}
              <div className="flex items-center gap-1 text-[11px]">
                {[1, 2, 5].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`px-1.5 py-0.5 rounded text-xs transition ${
                      playbackSpeed === spd
                        ? "bg-white/20 text-white font-bold"
                        : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Telemetry & Operation Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs bg-black/30 p-2 rounded-lg border border-white/5 font-mono my-2">
              <div>
                <span className="text-neutral-500 block text-[10px] uppercase">Operation</span>
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      isRapid ? "bg-amber-500/20 text-amber-300" : "bg-cyan-500/20 text-cyan-300"
                    }`}
                  >
                    {activeOp?.type || "G00"}
                  </span>
                  <span className="truncate text-neutral-200">
                    {activeOp?.description || "Idle Clearance"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-neutral-500 block text-[10px] uppercase">Coordinates (mm)</span>
                <span className="text-neutral-200">
                  X: {stepInfo?.coords?.xMm != null ? stepInfo.coords.xMm.toFixed(1) : "0.0"} | Y:{" "}
                  {stepInfo?.coords?.yMm != null ? stepInfo.coords.yMm.toFixed(1) : "0.0"}
                </span>
              </div>

              <div>
                <span className="text-neutral-500 block text-[10px] uppercase">Z-Depth / Feed</span>
                <span className={`${((stepInfo?.zDepthMm ?? activeOp?.zDepthMm ?? 0) < 0) ? "text-cyan-300 font-bold" : "text-amber-300"}`}>
                  Z: {(stepInfo?.zDepthMm ?? activeOp?.zDepthMm ?? 0).toFixed(1)} mm
                  <span className="text-neutral-400 text-[10px] ml-1 font-normal">
                    ({activeOp?.feedRate ? `${activeOp.feedRate} mm/min` : "RAPID"})
                  </span>
                </span>
              </div>

              <div>
                <span className="text-neutral-500 block text-[10px] uppercase">Active Tool & Status</span>
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-neutral-200 truncate block">
                    {activeOp?.toolSku || `T01 Ø${(activeOp?.cutterDiameterMm || activeOp?.kerfMm || 6.0).toFixed(1)}mm`}
                  </span>
                  {activeOp?.status && (
                    <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                      activeOp.status.includes("GATED") || activeOp.status.includes("BLOCKED")
                        ? "bg-rose-500/30 text-rose-300"
                        : "bg-amber-500/20 text-amber-300"
                    }`}>
                      {activeOp.status}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Layer Visibility Toggles */}
            <div className="flex flex-wrap items-center gap-4 text-xs pt-1 border-t border-white/5 text-neutral-300">
              <span className="text-neutral-500 text-[11px] font-medium uppercase tracking-wide">
                Layers:
              </span>
              {[
                { key: "carcass", label: "Carcass Panels" },
                { key: "cutVectors", label: "Cut Vectors (G01)" },
                { key: "rapidTrajectories", label: "Rapid Trajectories (G00)" },
                { key: "grooves", label: "Grooves (Lime)" },
                { key: "vacuumPods", label: "Vacuum Pods & Halo" },
                { key: "kerfRibbon", label: "Kerf Ribbon (Width)" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-1.5 cursor-pointer hover:text-white select-none">
                  <input
                    type="checkbox"
                    checked={visibleLayers[key] !== false}
                    onChange={(e) => {
                      if (onToggleLayer) {
                        onToggleLayer(key, e.target.checked);
                      }
                    }}
                    className="rounded border-neutral-600 bg-neutral-800 text-emerald-500 focus:ring-emerald-400 h-3.5 w-3.5"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
