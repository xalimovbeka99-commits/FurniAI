"use client";

import { useState, useEffect, useRef, useMemo, Suspense, useCallback } from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { DESIGNS } from "@/lib/designs";
import { MATERIALS } from "@/lib/knowledgeBase";
import FurnitureModel from "@/components/builder/FurnitureModel";
import LocalEnvironment from "@/components/builder/LocalEnvironment";
import SceneEnhancementBoundary from "@/components/builder/SceneEnhancementBoundary";

// Slow rotation for the hero 3D model
function RotatingModel({ config }) {
  const groupRef = useRef();
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.12;
    }
  });
  return (
    <group ref={groupRef} position={[0, -config.dimensions.height / 2, 0]}>
      <FurnitureModel config={config} />
    </group>
  );
}

// Simple rotation for individual gallery cards
function GalleryCardModel({ config }) {
  const groupRef = useRef();
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.18;
    }
  });
  return (
    <group ref={groupRef} position={[0, -config.dimensions.height / 2.3, 0]}>
      <FurnitureModel config={config} />
    </group>
  );
}

// Mounts the Canvas only while the card is in (or near) the viewport.
// This keeps WebGL context count bounded regardless of gallery size.
function LazyCardCanvas({ config, materialColor }) {
  const containerRef = useRef();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full">
      {active ? (
        <Canvas shadows camera={{ position: [2.0, 1.4, 2.0], fov: 40 }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[3, 5, 2]} intensity={1.2} />
          <pointLight position={[-2, 3, -1]} intensity={0.4} color="#ffffff" />
          <Suspense fallback={null}>
            <GalleryCardModel config={config} />
          </Suspense>
        </Canvas>
      ) : (
        /* Placeholder shown before the card enters the viewport */
        <div
          className="w-full h-full"
          style={{ background: `linear-gradient(135deg, ${materialColor}33, ${materialColor}11)` }}
        />
      )}
    </div>
  );
}

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeMaterial, setActiveMaterial] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  // Monitor scroll for header background opacity
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Filter designs dynamically
  const filteredDesigns = useMemo(() => {
    if (selectedCategory === "all") return DESIGNS;
    return DESIGNS.filter((d) => d.category === selectedCategory);
  }, [selectedCategory]);

  // Categories extracted dynamically from designs catalog
  const categories = useMemo(() => {
    return ["all", ...new Set(DESIGNS.map((d) => d.category))];
  }, []);

  // Use the walnut-glass wardrobe as our landing page hero showcase model
  const heroDesign = DESIGNS.find((d) => d.id === "wardrobe-walnut-mirror") || DESIGNS[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAF9F5] to-[#F4F1E8] text-[#1C1E21] font-sans selection:bg-[#00B4D8] selection:text-[#FAF9F5]">
      
      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12 transition-all duration-300 ${
        scrolled ? "bg-[#FAF9F5]/90 backdrop-blur-md border-b border-[#EDE8DC] py-3 shadow-sm" : "bg-transparent"
      }`}>
        <div className="brand flex items-baseline gap-2 text-2xl font-bold tracking-tight">
          <span>Furni</span><span className="bg-gradient-to-r from-[#C5A880] to-[#00B4D8] bg-clip-text text-transparent">AI</span>
          <span className="text-xs font-mono tracking-widest text-[#5C626E] uppercase font-normal ml-1 hidden sm:inline-block">Parametric</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#5C626E]">
          <a href="#gallery" className="relative hover:text-[#1C1E21] transition-colors py-1 group">
            Gallery
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#00B4D8] transition-all duration-200 group-hover:w-full"></span>
          </a>
          <a href="#pipeline" className="relative hover:text-[#1C1E21] transition-colors py-1 group">
            Pipeline
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#00B4D8] transition-all duration-200 group-hover:w-full"></span>
          </a>
          <a href="#materials" className="relative hover:text-[#1C1E21] transition-colors py-1 group">
            Materials
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#00B4D8] transition-all duration-200 group-hover:w-full"></span>
          </a>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/builder" className="btn bg-[#1C1E21] text-[#FAF9F5] border border-[#1C1E21] px-5 py-2.5 rounded-full font-mono text-xs tracking-wider transition-all duration-200 hover:bg-[#00B4D8] hover:border-[#00B4D8] hover:shadow-[0_0_15px_rgba(0,180,216,0.35)] hover:-translate-y-0.5 inline-flex items-center gap-2">
            <span>Configure Space</span>
            <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-16 md:pt-40 md:pb-24 max-w-7xl mx-auto px-6 md:px-12 min-h-[90vh] flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <span className="eyebrow inline-flex items-center gap-2 mb-4 text-[#00B4D8] font-mono text-xs uppercase tracking-widest">
              CNC Integrated config
            </span>
            <h1 className="brand text-4xl sm:text-5xl md:text-6xl font-light tracking-tight leading-[1.05] mb-6">
              Custom furniture, built to the <em className="italic bg-gradient-to-r from-[#C5A880] to-[#00B4D8] bg-clip-text text-transparent font-semibold">millimetre</em>.
            </h1>
            <p className="text-base sm:text-lg text-[#5C626E] max-w-xl mb-8 leading-relaxed">
              No generic sizes, no flatpack compromises. Configure wardrobes, shelves, and kitchens to your exact room size, then send your spec straight to production.
            </p>
            <div className="flex flex-wrap gap-4 mb-12">
              <Link href="/builder" className="btn bg-[#1C1E21] text-[#FAF9F5] border border-[#1C1E21] px-6 py-3.5 rounded-full font-mono text-sm tracking-wide transition-all duration-200 hover:bg-[#00B4D8] hover:border-[#00B4D8] hover:shadow-[0_0_20px_rgba(0,180,216,0.4)] hover:-translate-y-0.5">
                Start Customising
              </Link>
              <a href="#gallery" className="btn border border-[#1C1E21] text-[#1C1E21] px-6 py-3.5 rounded-full font-mono text-sm tracking-wide transition-all duration-200 hover:bg-[#1C1E21] hover:text-[#FAF9F5]">
                View Gallery
              </a>
            </div>
            
            <div className="flex flex-wrap gap-8 border-t border-[#DFD9CC] pt-8">
              <div className="font-mono">
                <span className="block text-2xl font-bold text-[#1C1E21] leading-none">0.0 mm</span>
                <span className="block text-[10px] uppercase tracking-wider text-[#5C626E] mt-1.5">Tolerance Limit</span>
              </div>
              <div className="font-mono">
                <span className="block text-2xl font-bold text-[#1C1E21] leading-none">Direct</span>
                <span className="block text-[10px] uppercase tracking-wider text-[#5C626E] mt-1.5">Factory Dispatch</span>
              </div>
              <div className="font-mono">
                <span className="block text-2xl font-bold text-[#1C1E21] leading-none">Live</span>
                <span className="block text-[10px] uppercase tracking-wider text-[#5C626E] mt-1.5">3D Preview</span>
              </div>
            </div>
          </div>

          {/* 3D Showcase Viewport */}
          <div className="lg:col-span-6 relative aspect-square w-full rounded-2xl border border-[#C5BCA9] overflow-hidden bg-gradient-to-tr from-[#E0D5C2] via-[#EDE4D4] to-[#FBF7EF] shadow-inner">
            <Canvas shadows camera={{ position: [2.5, 1.6, 2.5], fov: 45 }}>
              <ambientLight intensity={0.6} />
              <directionalLight position={[4, 6, 3]} intensity={1.2} castShadow />
              <SceneEnhancementBoundary>
                <LocalEnvironment />
              </SceneEnhancementBoundary>
              <Grid args={[10, 10]} cellColor="#dcd4c6" sectionColor="#c5bca9" infiniteGrid fadeDistance={8} position={[0, -0.01, 0]} />
              <Suspense fallback={null}>
                <RotatingModel config={heroDesign.config} />
              </Suspense>
              <OrbitControls enableZoom={false} makeDefault target={[0, 0.05, 0]} />
            </Canvas>
            <div className="absolute left-4 bottom-4 font-mono text-[10px] text-[#5A5347] bg-[#F2ECE1]/70 backdrop-blur px-3 py-1.5 rounded-lg border border-[#C5BCA9]/50">
              Interactive 3D model · <b>Drag to rotate</b>
            </div>
          </div>
        </div>
      </section>

      {/* Scrolling Ticker */}
      <div className="w-full border-y border-[#EDE8DC] bg-[#1C1E21] text-[#FAF9F5] overflow-hidden py-4">
        <div className="whitespace-nowrap flex animate-ticker">
          {Array(4).fill([
            "Designed by AI",
            "Crafted by code",
            "Exact to the millimetre",
            "Local Workshops",
            "Fast Delivery",
          ]).flat().map((text, idx) => (
            <span key={idx} className="font-mono text-xs tracking-[0.2em] uppercase inline-flex items-center">
              {text} <span className="text-[#00B4D8] px-8">★</span>
            </span>
          ))}
        </div>
      </div>

      {/* Pipeline Steps Section */}
      <section id="pipeline" className="py-24 max-w-7xl mx-auto px-6 md:px-12 border-b border-[#EDE8DC]">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div>
            <span className="eyebrow inline-flex items-center gap-2 mb-3 text-[#00B4D8] font-mono text-xs uppercase tracking-widest">
              Digital Craftsmanship
            </span>
            <h2 className="brand text-3xl sm:text-4xl md:text-5xl font-light tracking-tight">
              AI design, built by <em className="italic bg-gradient-to-r from-[#C5A880] to-[#00B4D8] bg-clip-text text-transparent font-semibold">pure code</em>.
            </h2>
          </div>
          <p className="text-[#5C626E] max-w-md text-sm sm:text-base leading-relaxed">
            We bridge the gap between imagination and physical fabrication. No middle-man design files, just robust geometry automation.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[#EDE8DC] border border-[#EDE8DC] rounded-2xl overflow-hidden shadow-sm">
          {[
            {
              num: "01",
              title: "Concept & Gallery",
              desc: "Select a custom configuration template from the dynamic gallery to instantly load it.",
              badge: "Parametric presets",
            },
            {
              num: "02",
              title: "Refinement",
              desc: "Modify the width, height, or depth. The internal sections reflow dynamically in 3D.",
              badge: "Automatic rebuild",
            },
            {
              num: "03",
              title: "Review & Confirm",
              desc: "Walk through the finished spec — dimensions, material, hardware — before it's sent onward.",
              badge: "Manufacturable check",
            },
            {
              num: "04",
              title: "Production Dispatch",
              desc: "Confirmed configuration automatically compiles into a CSV & production PDF for the factory.",
              badge: "Direct CNC Pipeline",
            },
          ].map((step, idx) => (
            <div key={idx} className="glass-card p-8 hover:bg-[#FAF9F5] hover:shadow-[0_8px_30px_rgba(0,180,216,0.08)] flex flex-col justify-between min-h-[260px]">
              <div>
                <span className="font-mono text-xs text-[#00B4D8] block mb-4">{step.num}</span>
                <h3 className="brand text-xl font-medium tracking-tight mb-3 text-[#1C1E21]">{step.title}</h3>
                <p className="text-xs sm:text-sm text-[#5C626E] leading-relaxed">{step.desc}</p>
              </div>
              <div className="mt-6">
                <span className="inline-block font-mono text-[9px] uppercase tracking-wider text-[#00B4D8] px-2.5 py-1 border border-[#00B4D8]/30 bg-[#F0FDFD] rounded-md font-semibold">
                  {step.badge}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Dynamic Gallery Section */}
      <section id="gallery" className="py-24 max-w-7xl mx-auto px-6 md:px-12 border-b border-[#EDE8DC]">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
          <div>
            <span className="eyebrow inline-flex items-center gap-2 mb-3 text-[#00B4D8] font-mono text-xs uppercase tracking-widest">
              Design Gallery
            </span>
            <h2 className="brand text-3xl sm:text-4xl md:text-5xl font-light tracking-tight">
              Pre-engineered <em className="italic bg-gradient-to-r from-[#C5A880] to-[#00B4D8] bg-clip-text text-transparent font-semibold">catalogs</em>.
            </h2>
          </div>
          
          {/* Category Filter Chips */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`font-mono text-xs tracking-wider px-4 py-2 rounded-full border transition-all duration-150 capitalize ${
                  selectedCategory === cat
                    ? "bg-[#1C1E21] text-[#FAF9F5] border-[#1C1E21] shadow-sm"
                    : "bg-[#FAF9F5] text-[#5C626E] border-[#EDE8DC] hover:border-[#00B4D8] hover:text-[#00B4D8]"
                }`}
              >
                {cat.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredDesigns.map((design) => {
            return (
              <Link
                key={design.id}
                href={`/builder?design=${design.id}`}
                className="group flex flex-col glass-card rounded-2xl overflow-hidden shadow-sm hover:-translate-y-1"
              >
                {/* 3D Preview inside card */}
                <div className="aspect-[4/3] relative w-full overflow-hidden bg-gradient-to-tr from-[#E2D8C7] to-[#FAF6EE] border-b border-[#C5BCA9]/50">
                  <LazyCardCanvas
                    config={design.config}
                    materialColor={MATERIALS[design.config.material]?.color || "#c8a878"}
                  />

                  {/* Hover Customize overlay */}
                  <div className="absolute inset-0 bg-[#1C1E21]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                    <span className="font-mono text-xs tracking-wider bg-[#00B4D8] text-[#FAF9F5] px-4 py-2.5 rounded-full shadow-[0_4px_15px_rgba(0,180,216,0.35)] transform translate-y-3 group-hover:translate-y-0 transition-transform duration-200">
                      Configure Preset
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <span className="font-mono text-[10px] tracking-widest text-[#C5A880] uppercase block mb-1 font-semibold">
                    {design.config.type} · {design.style}
                  </span>
                  <h3 className="brand text-xl font-medium tracking-tight text-[#1C1E21] mb-3">
                    {design.name}
                  </h3>
                  <div className="flex items-center gap-4 text-xs font-mono text-[#5C626E]">
                    <span>W: <b>{Math.round(design.config.dimensions.width * 1000)}</b></span>
                    <span>H: <b>{Math.round(design.config.dimensions.height * 1000)}</b></span>
                    <span>D: <b>{Math.round(design.config.dimensions.depth * 1000)}</b> mm</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Materials Showcase Section */}
      <section id="materials" className="py-24 max-w-7xl mx-auto px-6 md:px-12 border-b border-[#EDE8DC]">
        <div className="mb-16">
          <span className="eyebrow inline-flex items-center gap-2 mb-3 text-[#00B4D8] font-mono text-xs uppercase tracking-widest">
            Material Catalog
            </span>
          <h2 className="brand text-3xl sm:text-4xl md:text-5xl font-light tracking-tight">
            Premium finishes, <em className="italic bg-gradient-to-r from-[#C5A880] to-[#00B4D8] bg-clip-text text-transparent font-semibold">durable sheets</em>.
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {Object.entries(MATERIALS).map(([key, mat]) => (
            <button
              key={key}
              onClick={() => setActiveMaterial(key === activeMaterial ? null : key)}
              className="flex flex-col items-center text-center focus:outline-none group"
            >
              <div 
                style={{ backgroundColor: mat.color }} 
                className={`w-20 h-20 rounded-2xl border border-[#EDE8DC] mb-4 shadow-sm transition-transform duration-200 group-hover:scale-105 ${
                  activeMaterial === key ? "ring-2 ring-[#00B4D8] ring-offset-2 ring-offset-[#FAF9F5]" : ""
                }`}
              />
              <span className="brand text-base font-medium text-[#1C1E21] block">{mat.label}</span>
              <span className="font-mono text-[10px] text-[#5C626E] uppercase tracking-wider mt-1 block font-semibold">
                {mat.tier} tier
              </span>
              
              {activeMaterial === key && (
                <div className="mt-2 text-xs font-mono text-[#00B4D8] animate-fade-in font-bold">
                  AED {mat.costPerM2}/m²
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* CTA section */}
      <section className="py-28 text-center max-w-4xl mx-auto px-6">
        <span className="eyebrow inline-flex items-center gap-2 mb-4 text-[#00B4D8] font-mono text-xs uppercase tracking-widest">
          Build Your Project
        </span>
        <h2 className="brand text-4xl sm:text-5xl md:text-6xl font-light tracking-tight leading-none mb-8">
          Configure your space, <br />
          <em className="italic bg-gradient-to-r from-[#C5A880] to-[#00B4D8] bg-clip-text text-transparent font-semibold">exactly as it fits</em>.
        </h2>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link href="/builder" className="btn bg-[#1C1E21] text-[#FAF9F5] border border-[#1C1E21] px-8 py-4 rounded-full font-mono text-sm tracking-wide transition-all duration-200 hover:bg-[#00B4D8] hover:border-[#00B4D8] hover:shadow-[0_0_25px_rgba(0,180,216,0.4)] hover:-translate-y-0.5">
            Open Configurator
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#EDE8DC] bg-[#F4F1E8] py-16 px-6 md:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <div className="brand text-2xl font-bold tracking-tight mb-4">
              <span>Furni</span><span className="bg-gradient-to-r from-[#C5A880] to-[#00B4D8] bg-clip-text text-transparent">AI</span>
            </div>
            <p className="text-sm text-[#5C626E] max-w-md leading-relaxed">
              Parametric custom furniture configurator. Engineered dynamically for UAE workshops. From browser layout to factory cutting instructions in minutes.
            </p>
          </div>
          <div>
            <h4 className="font-mono text-xs tracking-wider text-[#5C626E] uppercase mb-4">System Links</h4>
            <ul className="flex flex-col gap-2.5 text-sm">
              <li><Link href="/builder" className="hover:text-[#00B4D8] transition-colors">3D Configurator</Link></li>
              <li><a href="#gallery" className="hover:text-[#00B4D8] transition-colors">Catalog Gallery</a></li>
              <li><a href="#pipeline" className="hover:text-[#00B4D8] transition-colors">Direct CNC Pipeline</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-mono text-xs tracking-wider text-[#5C626E] uppercase mb-4">Tech Specs</h4>
            <ul className="flex flex-col gap-2.5 text-sm text-[#5C626E]">
              <li>React 18 / Next.js 14</li>
              <li>Three.js / React Three Fiber</li>
              <li>Parametric Cut-List Engine</li>
            </ul>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto border-t border-[#EDE8DC] mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-mono text-[#5C626E]">
          <span>© {new Date().getFullYear()} FurniAI. CNC Integrated System.</span>
          <span>Designed & Built for UAE Fabrication Workshops.</span>
        </div>
      </footer>

    </div>
  );
}

