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

export {
  goldenSpec,
  validateFurniSpec,
  buildStructuralPartGraph,
  partGraphToThree,
  disposePartGraphGroup,
  DMM_TO_THREE,
};

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
  const THREE = window.THREE;
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

  // Align floor to bottom of plinth
  const fl = builder.scene.getObjectByName("floor");
  if (fl) {
    fl.position.y = -envH / 2 - 0.001;
  }

  // Reset and align camera to framing
  builder.camDist = 4.6;
  builder.rotY = 0.5;
  builder.rotX = 0.06;
  builder.lookAtZ = 0;

  return {
    partGraph,
    furnitureGroup,
    envelope: {
      widthMm: envW * 1000,
      heightMm: envH * 1000,
      depthMm: envD * 1000,
    },
    partCount: partGraph.parts.length,
  };
}
