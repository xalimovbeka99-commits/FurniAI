"use client";

/**
 * FurnitureModel — the parametric 3D piece.
 * -----------------------------------------
 * Reads the config from the store, runs buildGeometry, and renders each part
 * as a memoised box. There is NO hardcoded kitchen/wardrobe mesh any more —
 * every shape is derived from parameters. Change a parameter, the model rebuilds.
 *
 * Drop this inside a <Canvas> (see app/builder/page.jsx).
 */
import { useMemo } from "react";
import { useFurnitureStore } from "@/store/furnitureStore";
import { useWardrobeAIStore } from "@/store/wardrobeAIStore";
import { buildGeometry } from "@/lib/buildGeometry";
import { buildWardrobeGeometry } from "@/lib/wardrobe-model/buildWardrobeGeometry";
import { MATERIALS } from "@/lib/knowledgeBase";

// Roles that should look like the chosen material; others are neutral carcass.
const FRONT_ROLES = new Set(["door", "drawerFront"]);

function partColor(part, materialKey) {
  const m = MATERIALS[materialKey];
  if (FRONT_ROLES.has(part.role)) return m?.color || "#c8a878";
  if (part.role === "back") return "#d8d2c4";
  // carcass slightly darker than the front so structure reads in 3D
  return shade(m?.color || "#c8a878", -0.12);
}

export default function FurnitureModel({ config: customConfig, selectModule: customSelectModule, selectedModule: customSelectedModule }) {
  const storeConfig = useFurnitureStore((s) => s.config);
  const storeSelectModule = useFurnitureStore((s) => s.selectModule);
  const storeSelectedModule = useFurnitureStore((s) => s.selectedModule);

  const config = customConfig || storeConfig;
  const selectModule = customSelectModule || storeSelectModule;
  const selectedModule = customSelectedModule !== undefined ? customSelectedModule : storeSelectedModule;

  // A wardrobe built by the Wardrobe AI (src/lib/wardrobe-model) takes over
  // rendering when one exists; otherwise this falls back to the existing
  // manually-configured piece exactly as before. Same part shape either way
  // — see buildWardrobeGeometry.js.
  const wardrobeModel = useWardrobeAIStore((s) => s.model);
  const parts = useMemo(
    () => (wardrobeModel ? buildWardrobeGeometry(wardrobeModel) : buildGeometry(config)),
    [wardrobeModel, config]
  );

  return (
    <group>
      {parts.map((p) => {
        const isSelected =
          selectedModule != null && p.module === selectedModule && FRONT_ROLES.has(p.role);
        return (
          <mesh
            key={p.id}
            position={p.position}
            castShadow
            receiveShadow
            onClick={(e) => {
              if (p.module != null) {
                e.stopPropagation();
                selectModule(p.module);
              }
            }}
          >
            <boxGeometry args={p.size} />
            <meshStandardMaterial
              color={isSelected ? "#2f6f4f" : partColor(p, config.material)}
              roughness={FRONT_ROLES.has(p.role) ? 0.5 : 0.75}
              metalness={0.05}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// --- tiny colour shader (no deps) -----------------------------------------
function shade(hex, amt) {
  const n = parseInt(hex.replace("#", ""), 16);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp(((n >> 16) & 255) + amt * 255);
  const g = clamp(((n >> 8) & 255) + amt * 255);
  const b = clamp((n & 255) + amt * 255);
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}
