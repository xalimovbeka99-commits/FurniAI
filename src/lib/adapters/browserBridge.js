/**
 * src/lib/adapters/browserBridge.js
 * ---------------------------------------------------------------------
 * Browser runtime bridge connecting validated PartGraph to the Builder.
 */

import goldenSpec from "../furnispec/goldenWardrobe.fixture.json";
import { validateFurniSpec } from "../furnispec/validate.js";
import { buildStructuralPartGraph } from "../partgraph/buildStructuralPartGraph.js";
import {
  partGraphToThree,
  disposePartGraphGroup,
  DMM_TO_THREE,
} from "./partGraphToThree.js";
import {
  proposeWardrobe,
  approveAndPreview,
  previewDraftWardrobe,
  applyConversationalEdit,
  parseConversationalCommand,
  draftPreviewSafety,
  runConversationToWardrobe,
  PIPELINE_STAGE,
  APPROVAL_STATE,
} from "../conversation/pipeline.js";
import { OBSERVATION_ORIGIN, BEKZOD_APPROVED_DEFAULTS } from "../conversation/intakeModel.js";
import { createDeterministicPhraseAdapter } from "../conversation/proposalAdapter.js";
import { createProposal, validateApproval } from "../conversation/approval.js";
import {
  parseAndValidateClarifyInput,
  parseDimension,
  ACCEPTED_DIMENSION_UNITS,
} from "../conversation/clarifyInput.js";

export {
  goldenSpec,
  validateFurniSpec,
  buildStructuralPartGraph,
  partGraphToThree,
  disposePartGraphGroup,
  DMM_TO_THREE,
  proposeWardrobe,
  approveAndPreview,
  previewDraftWardrobe,
  applyConversationalEdit,
  parseConversationalCommand,
  draftPreviewSafety,
  runConversationToWardrobe,
  PIPELINE_STAGE,
  APPROVAL_STATE,
  OBSERVATION_ORIGIN,
  BEKZOD_APPROVED_DEFAULTS,
  createDeterministicPhraseAdapter,
  createProposal,
  validateApproval,
  parseAndValidateClarifyInput,
  parseDimension,
  ACCEPTED_DIMENSION_UNITS,
};

const FALLBACK_MAT = {
  oak: { color: 0xc8a87a, rough: 0.75, metal: 0 },
  walnut: { color: 0x6e5236, rough: 0.7, metal: 0 },
  white: { color: 0xf2f1ec, rough: 0.45, metal: 0 },
  grey: { color: 0x4e4f52, rough: 0.5, metal: 0 },
  taupe: { color: 0xb0a294, rough: 0.55, metal: 0 },
  cream: { color: 0xe6ddcd, rough: 0.5, metal: 0 },
  black: { color: 0x1c1c1c, rough: 0.4, metal: 0 },
  navy: { color: 0x2c3e50, rough: 0.55, metal: 0 },
  sage: { color: 0x9caf88, rough: 0.55, metal: 0 },
  terracotta: { color: 0xb5651d, rough: 0.6, metal: 0 },
  mahogany: { color: 0x6f3329, rough: 0.68, metal: 0 },
  ash: { color: 0xd9d0c0, rough: 0.72, metal: 0 },
  ivory: { color: 0xf5f0e6, rough: 0.42, metal: 0 },
};

/**
 * Updates the materials of an active PartGraph wardrobe in place
 * without rebuilding geometry or touching legacy Builder.cfg.
 *
 * @param {object} builder - The global Builder object from index.html
 * @param {string} matKey - Material key from MATKEYS (e.g. 'oak', 'walnut')
 */
export function updateParametricMaterial(builder, matKey) {
  if (!builder || !builder.scene) return;
  const MAT = (typeof window !== "undefined" && window.MAT) || (typeof globalThis !== "undefined" && globalThis.MAT) || FALLBACK_MAT;
  const matDef = (MAT && MAT[matKey]) || FALLBACK_MAT[matKey] || { color: 0xe8e4dc, rough: 0.6, metal: 0 };

  const furnitureGroup = builder.parts.find(
    (p) => p && p.userData && p.userData.materialMap
  ) || builder.scene.getObjectByName("furniture_furnispec-golden-wardrobe-01");

  if (!furnitureGroup || !furnitureGroup.userData?.materialMap) {
    return;
  }

  const materials = furnitureGroup.userData.materialMap;
  const color = matDef.color;
  const rough = matDef.rough !== undefined ? matDef.rough : 0.6;
  const metal = matDef.metal !== undefined ? matDef.metal : 0.02;

  if (materials.CARCASS) {
    materials.CARCASS.color.setHex(color);
    materials.CARCASS.roughness = rough;
    materials.CARCASS.metalness = metal;
    materials.CARCASS.needsUpdate = true;
  }

  if (materials.DOOR) {
    materials.DOOR.color.setHex(color);
    materials.DOOR.roughness = Math.max(0.25, rough * 0.9);
    materials.DOOR.metalness = metal;
    materials.DOOR.needsUpdate = true;
  }

  if (materials.PLINTH) {
    const dkFn = typeof window !== "undefined" && typeof window.dk === "function" ? window.dk : null;
    const plinthColor = dkFn ? dkFn(color, 0.75) : color;
    materials.PLINTH.color.setHex(plinthColor);
    materials.PLINTH.roughness = Math.max(0.7, rough);
    materials.PLINTH.metalness = metal;
    materials.PLINTH.needsUpdate = true;
  }

  builder.parametricMat = matKey;

  // Update swatch classes
  if (typeof document !== "undefined") {
    const swatches = document.querySelectorAll(".b-sw");
    swatches.forEach((s) => {
      s.classList.toggle("active", s.dataset.mat === matKey);
    });
  }
}

/**
 * Loads the Golden Wardrobe into an existing Builder instance.
 *
 * @param {object} builder - The global Builder object from index.html
 * @returns {object} Summary of loaded model
 */
export function loadGoldenWardrobe(builder) {
  if (!builder || !builder.scene) {
    throw new Error("Builder and Builder.scene are required.");
  }

  // Clear existing parts and reset state
  builder.clear();

  // Validate canonical FurniSpec
  const validation = validateFurniSpec(goldenSpec);
  if (!validation.valid) {
    throw new Error(
      "Golden FurniSpec validation failed: " +
        JSON.stringify(validation.errors)
    );
  }

  // Build structural PartGraph deterministically
  const partGraph = buildStructuralPartGraph(goldenSpec);

  // Convert via pure adapter
  const THREE = (typeof window !== "undefined" && window.THREE) || globalThis.THREE;
  const furnitureGroup = partGraphToThree(partGraph, { threeInstance: THREE });

  // Center furniture in Builder coordinate space:
  // - Center X=0 (shift by -envelopeWidth / 2)
  // - Floor Y=-H/2 (shift by -envelopeHeight / 2)
  // - Center Z=0 (shift by -envelopeDepth / 2)
  const env = partGraph.summary.envelope;
  const envW = env.widthDmm * DMM_TO_THREE;
  const envH = env.heightDmm * DMM_TO_THREE;
  const envD = env.depthDmm * DMM_TO_THREE;

  furnitureGroup.position.set(-envW / 2, -envH / 2, -envD / 2);

  // Attach to scene and builder.parts for standard lifecycle management
  builder.attach(furnitureGroup);

  // Register generated door pivots with Builder.doorObjs for interactive animation
  builder.doorObjs = [];
  if (Array.isArray(furnitureGroup.userData?.doorPivots)) {
    builder.doorObjs.push(...furnitureGroup.userData.doorPivots);
  }

  // Align floor to bottom of plinth
  const fl = builder.scene.getObjectByName("floor");
  if (fl) {
    fl.position.y = -envH / 2 - 0.001;
  }

  // Reset and align camera to front-facing perspective framing
  // rotY = Math.PI - 0.42 (~2.72 rad) places camera at +X (right), -Z (in front of wardrobe)
  // so the 4 front doors face the user and open forward into the room towards the camera.
  builder.camDist = 4.8;
  builder.rotY = Math.PI - 0.42;
  builder.rotX = 0.06;
  builder.lookAtZ = 0;

  // Apply current or default material
  const currentMat = builder.parametricMat || "white";
  updateParametricMaterial(builder, currentMat);

  return {
    partGraph,
    furnitureGroup,
    envelope: {
      widthMm: envW * 1000,
      heightMm: envH * 1000,
      depthMm: envD * 1000,
    },
    partCount: partGraph.parts.length,
    doorCount: builder.doorObjs.length,
  };
}

/**
 * Loads an approved PartGraph directly into the Builder scene.
 *
 * @param {object} builder - The global Builder object from index.html
 * @param {object} partGraph - The validated PartGraph from approveAndPreview()
 * @returns {object} Summary of loaded model
 */
export function loadApprovedPartGraph(builder, partGraph) {
  if (!builder || !builder.scene) {
    throw new Error("Builder and Builder.scene are required.");
  }
  if (!partGraph || !Array.isArray(partGraph.parts)) {
    throw new Error("loadApprovedPartGraph requires a valid PartGraph with parts array.");
  }

  // Clear existing parts and reset state
  builder.clear();

  // Convert via pure adapter
  const THREE = (typeof window !== "undefined" && window.THREE) || globalThis.THREE;
  const furnitureGroup = partGraphToThree(partGraph, { threeInstance: THREE });

  const env = partGraph.summary?.envelope;
  const envW = (env?.widthDmm ?? 18000) * DMM_TO_THREE;
  const envH = (env?.heightDmm ?? 24000) * DMM_TO_THREE;
  const envD = (env?.depthDmm ?? 6000) * DMM_TO_THREE;

  furnitureGroup.position.set(-envW / 2, -envH / 2, -envD / 2);

  // Attach to scene and builder.parts
  builder.attach(furnitureGroup);

  // Register generated door pivots with Builder.doorObjs for interactive animation
  builder.doorObjs = [];
  if (Array.isArray(furnitureGroup.userData?.doorPivots)) {
    builder.doorObjs.push(...furnitureGroup.userData.doorPivots);
  }

  // Align floor to bottom of plinth
  const fl = builder.scene.getObjectByName("floor");
  if (fl) {
    fl.position.y = -envH / 2 - 0.001;
  }

  // Reset and align camera to front-facing perspective framing
  builder.camDist = 4.8;
  builder.rotY = Math.PI - 0.42;
  builder.rotX = 0.06;
  builder.lookAtZ = 0;

  // Apply current or default material
  const currentMat = builder.parametricMat || "white";
  updateParametricMaterial(builder, currentMat);

  return {
    partGraph,
    furnitureGroup,
    envelope: {
      widthMm: envW * 1000,
      heightMm: envH * 1000,
      depthMm: envD * 1000,
    },
    partCount: partGraph.parts.length,
    doorCount: builder.doorObjs.length,
  };
}

export const loadDraftPartGraph = loadApprovedPartGraph;
