"use client";

/**
 * /builder — the customization page.
 * Left tool panel | 3D viewport | Right tool panel.
 * The hardcoded models are gone; the centre renders whatever the config says.
 */
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import StructurePanel from "@/components/builder/StructurePanel";
import AppearancePanel from "@/components/builder/AppearancePanel";
import FurnitureModel from "@/components/builder/FurnitureModel";
import WardrobeAIPanel from "@/components/builder/WardrobeAIPanel";
import LocalEnvironment from "@/components/builder/LocalEnvironment";
import SceneEnhancementBoundary from "@/components/builder/SceneEnhancementBoundary";
import { useFurnitureStore } from "@/store/furnitureStore";
import { getDesign } from "@/lib/designs";

function BuilderContent() {
  const config = useFurnitureStore((s) => s.config);
  const selectModule = useFurnitureStore((s) => s.selectModule);
  const loadConfig = useFurnitureStore((s) => s.loadConfig);
  const searchParams = useSearchParams();
  const designId = searchParams.get("design");
  // Closed by default: the page is pixel-identical to before until a user
  // opts in. See docs/WARDROBE_AI_BASELINE.md's frozen-surface decision.
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  useEffect(() => {
    if (designId) {
      const design = getDesign(designId);
      if (design && design.config) {
        // Deep clone configuration to prevent mutation issues
        loadConfig(JSON.parse(JSON.stringify(design.config)));
      }
    }
  }, [designId, loadConfig]);

  return (
    <div className="flex h-screen w-full flex-col bg-neutral-100">
      {/* Minimal top bar with back link */}
      <header className="flex items-center justify-between border-b border-[#EDE8DC] bg-[#FAF9F5] px-5 py-2.5 shrink-0 z-10">
        <Link
          href="/"
          className="font-mono text-xs tracking-wider text-[#5C626E] hover:text-[#1C1E21] transition-colors flex items-center gap-2"
        >
          ← Back
        </Link>
        <div className="brand text-base font-bold">
          <span>Furni</span>
          <span className="bg-gradient-to-r from-[#C5A880] to-[#00B4D8] bg-clip-text text-transparent">AI</span>
          <span className="font-mono text-[10px] tracking-widest text-[#5C626E] uppercase font-normal ml-1.5 hidden sm:inline-block">Configurator</span>
        </div>
        <button
          type="button"
          onClick={() => setAiPanelOpen((v) => !v)}
          className="font-mono text-xs tracking-wider text-[#5C626E] hover:text-[#1C1E21] transition-colors"
        >
          {aiPanelOpen ? "Hide AI" : "Ask AI"}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <StructurePanel />

      <main className="relative flex-1">
        <Canvas
          shadows
          camera={{ position: [2.6, 1.9, 3.2], fov: 45 }}
          onPointerMissed={() => selectModule(null)}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 8, 5]} intensity={1.1} castShadow />
          <SceneEnhancementBoundary>
            <LocalEnvironment />
          </SceneEnhancementBoundary>
          <Grid args={[20, 20]} cellColor="#ddd" sectionColor="#bbb" infiniteGrid fadeDistance={18} position={[0, 0, 0]} />

          {/* recenter vertically so the piece sits nicely in frame */}
          <group position={[0, -config.dimensions.height / 2, 0]}>
            <FurnitureModel />
          </group>

          <OrbitControls makeDefault target={[0, 0, 0]} minDistance={1.2} maxDistance={9} />
        </Canvas>

        <div className="pointer-events-none absolute left-4 top-4 rounded bg-white/80 px-3 py-1.5 text-xs text-neutral-600 backdrop-blur">
          Click a door or drawer to edit that section · drag to orbit
        </div>

        {aiPanelOpen && <WardrobeAIPanel onClose={() => setAiPanelOpen(false)} />}
      </main>

        <AppearancePanel />
      </div>
    </div>
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center bg-neutral-100 font-mono text-neutral-600">
        Loading Configurator...
      </div>
    }>
      <BuilderContent />
    </Suspense>
  );
}

