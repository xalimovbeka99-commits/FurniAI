/**
 * src/lib/adapters/partGraphToThree.js
 * ---------------------------------------------------------------------
 * Pure Three.js Adapter for FurniAI PartGraph v0.1
 *
 * Converts a validated PartGraph into a THREE.Group of meshes.
 *
 * INVARIANTS:
 * - Deterministic, pure geometry conversion.
 * - Exact scale conversion: 1 deci-mm = 0.0001 Three.js world units (metres).
 * - Preserves the FurniAI coordinate contract:
 *     +X = right
 *     +Y = upward
 *     +Z = rearward
 * - Exactly one mesh per structural panel in PartGraph.
 * - Mesh dimensions equal placement bounding box extents.
 * - Mesh center equals ((min + max) / 2).
 * - Every mesh receives complete userData metadata.
 * - Full recursive disposal of geometry and materials.
 * - Contains NO furniture dimension constants.
 * - PartGraph is the sole geometric authority.
 */

import * as THREE from "three";

/**
 * Scale factor converting integer deci-millimetres (0.1 mm)
 * to Three.js world units (metres).
 * 1 dmm = 0.1 mm = 0.0001 m.
 */
export const DMM_TO_THREE = 0.0001;

/**
 * Creates distinct readable materials by semantic role.
 *
 * @param {typeof THREE} [threeInstance] - Three.js module
 * @returns {Record<string, THREE.Material>}
 */
export function createPartGraphMaterials(threeInstance = THREE) {
  return {
    CARCASS: new threeInstance.MeshStandardMaterial({
      color: 0xf5f3ed,
      roughness: 0.65,
      metalness: 0.02,
      name: "mat_carcass_white_melamine",
    }),
    DOOR: new threeInstance.MeshStandardMaterial({
      color: 0xfbf9f5,
      roughness: 0.4,
      metalness: 0.05,
      name: "mat_door_front_melamine",
    }),
    BACK_PANEL: new threeInstance.MeshStandardMaterial({
      color: 0xe5e1d5,
      roughness: 0.85,
      metalness: 0.0,
      name: "mat_back_panel_hdf",
    }),
    PLINTH: new threeInstance.MeshStandardMaterial({
      color: 0x3d3a36,
      roughness: 0.75,
      metalness: 0.1,
      name: "mat_plinth_fascia",
    }),
    EDGE: new threeInstance.LineBasicMaterial({
      color: 0x24221f,
      transparent: true,
      opacity: 0.35,
      name: "mat_door_edge",
    }),
    DEFAULT: new threeInstance.MeshStandardMaterial({
      color: 0xd9d5cb,
      roughness: 0.5,
      metalness: 0.05,
      name: "mat_default_panel",
    }),
  };
}

/**
 * Resolves the appropriate semantic material for a part role.
 *
 * @param {string} role - PART_ROLES enum value
 * @param {Record<string, THREE.Material>} materials
 * @returns {THREE.Material}
 */
export function getMaterialForRole(role, materials) {
  switch (role) {
    case "TOP_PANEL":
    case "BOTTOM_PANEL":
    case "SIDE_PANEL_LEFT":
    case "SIDE_PANEL_RIGHT":
    case "DIVIDER_PANEL":
    case "FIXED_SHELF":
    case "ADJUSTABLE_SHELF":
      return materials.CARCASS;
    case "DOOR_PANEL":
      return materials.DOOR;
    case "BACK_PANEL":
      return materials.BACK_PANEL;
    case "PLINTH_FRONT_FASCIA":
    case "PLINTH_REAR_RAIL":
    case "PLINTH_SIDE_RETURN_LEFT":
    case "PLINTH_SIDE_RETURN_RIGHT":
    case "PLINTH_CROSS_STRETCHER":
      return materials.PLINTH;
    default:
      return materials.DEFAULT;
  }
}

/**
 * Converts a validated PartGraph into a THREE.Group.
 *
 * @param {object} partGraph - Validated PartGraph v0.1 object
 * @param {object} [options]
 * @param {typeof THREE} [options.threeInstance] - Optional Three.js instance
 * @param {boolean} [options.centerOrigin=false] - Whether to offset group so center is (0,0,0)
 * @returns {THREE.Group} Root furniture group
 */
export function partGraphToThree(partGraph, options = {}) {
  if (!partGraph || typeof partGraph !== "object") {
    throw new TypeError("partGraphToThree requires a valid PartGraph object.");
  }
  if (!Array.isArray(partGraph.parts)) {
    throw new TypeError("partGraphToThree: partGraph.parts must be an array.");
  }

  const T = options.threeInstance || THREE;
  const rootGroup = new T.Group();
  rootGroup.name = `furniture_${partGraph.sourceSpecId || "partgraph"}`;

  const materials = createPartGraphMaterials(T);

  // Track created materials for recursive disposal
  const allocatedMaterials = Object.values(materials);

  const doorParts = partGraph.parts.filter(
    (p) => p.role === "DOOR_PANEL" || (typeof p.id === "string" && p.id.startsWith("DOOR_"))
  );
  const doorPivots = [];

  for (const part of partGraph.parts) {
    const { placement, finished, id, role } = part;
    if (!placement) {
      throw new Error(`Part "${id}" is missing placement coordinates.`);
    }

    // Derive dimensions strictly from bounding box extents
    const widthDmm = placement.maxXDmm - placement.minXDmm;
    const heightDmm = placement.maxYDmm - placement.minYDmm;
    const depthDmm = placement.maxZDmm - placement.minZDmm;

    const widthThree = widthDmm * DMM_TO_THREE;
    const heightThree = heightDmm * DMM_TO_THREE;
    const depthThree = depthDmm * DMM_TO_THREE;

    // Derive center strictly from (min + max) / 2
    const centerXDmm = (placement.minXDmm + placement.maxXDmm) / 2;
    const centerYDmm = (placement.minYDmm + placement.maxYDmm) / 2;
    const centerZDmm = (placement.minZDmm + placement.maxZDmm) / 2;

    const geometry = new T.BoxGeometry(widthThree, heightThree, depthThree);
    const material = getMaterialForRole(role, materials);
    const mesh = new T.Mesh(geometry, material);

    mesh.name = `part_${id}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const isDoor = role === "DOOR_PANEL" || (typeof id === "string" && id.startsWith("DOOR_"));

    if (isDoor) {
      // Add subtle edge definition to make door leaf boundaries clearly distinct
      const edgeGeometry = new T.EdgesGeometry(geometry);
      const edgeLine = new T.LineSegments(edgeGeometry, materials.EDGE);
      edgeLine.name = `edges_${id}`;
      edgeLine.raycast = () => {}; // Edge-definition LineSegments must not become selectable
      mesh.add(edgeLine);

      const doorIdx = doorParts.indexOf(part);
      const isLeftHinged = doorIdx % 2 === 0;
      const hinge = isLeftHinged ? "left" : "right";

      // Hinge position derived strictly from bounding box edge
      const pivotX = isLeftHinged
        ? placement.minXDmm * DMM_TO_THREE
        : placement.maxXDmm * DMM_TO_THREE;
      const pivotY = centerYDmm * DMM_TO_THREE;
      const pivotZ = centerZDmm * DMM_TO_THREE;

      // In PartGraph space (+Z rearward), front is towards -Z;
      // left door opens outward towards -Z with +openY,
      // right door opens outward towards -Z with -openY.
      const openY = isLeftHinged ? Math.PI * 0.55 : -Math.PI * 0.55;

      const pivot = new T.Group();
      pivot.name = `pivot_${id}`;
      pivot.position.set(pivotX, pivotY, pivotZ);
      pivot.userData = {
        interactive: true,
        kind: "door",
        openY,
        cur: 0,
        base: 0,
        hover: 0,
        suppress: 0,
        partId: id,
        hinge,
        doorMesh: mesh,
      };

      // Door mesh relative to its hinge pivot
      const meshRelX = isLeftHinged ? widthThree / 2 : -widthThree / 2;
      mesh.position.set(meshRelX, 0, 0);

      // Attach required metadata to mesh
      mesh.userData = {
        partId: id,
        role,
        isDoorMesh: true,
        finishedDimensionsMm: finished
          ? {
              lengthMm: finished.lengthDmm / 10,
              widthMm: finished.widthDmm / 10,
              thicknessMm: finished.thicknessDmm / 10,
            }
          : null,
        placementDmm: {
          minXDmm: placement.minXDmm,
          maxXDmm: placement.maxXDmm,
          minYDmm: placement.minYDmm,
          maxYDmm: placement.maxYDmm,
          minZDmm: placement.minZDmm,
          maxZDmm: placement.maxZDmm,
        },
        sourceSpecId: partGraph.sourceSpecId || null,
        interactive: true,
        pivot,
        hinge,
        materialCode: part.materialCode || null,
        rawDimensionsMm: part.raw
          ? {
              lengthMm: part.raw.lengthDmm / 10,
              widthMm: part.raw.widthDmm / 10,
              thicknessMm: part.raw.thicknessDmm / 10,
            }
          : null,
        edgesMm: part.edges
          ? {
              lengthEdge1Mm: part.edges.LENGTH_EDGE_1 / 10,
              lengthEdge2Mm: part.edges.LENGTH_EDGE_2 / 10,
              widthEdge1Mm: part.edges.WIDTH_EDGE_1 / 10,
              widthEdge2Mm: part.edges.WIDTH_EDGE_2 / 10,
            }
          : null,
        partData: part,
      };

      pivot.add(mesh);
      rootGroup.add(pivot);
      doorPivots.push(pivot);
    } else {
      mesh.position.set(
        centerXDmm * DMM_TO_THREE,
        centerYDmm * DMM_TO_THREE,
        centerZDmm * DMM_TO_THREE
      );

      mesh.userData = {
        partId: id,
        role,
        isDoorMesh: false,
        finishedDimensionsMm: finished
          ? {
              lengthMm: finished.lengthDmm / 10,
              widthMm: finished.widthDmm / 10,
              thicknessMm: finished.thicknessDmm / 10,
            }
          : null,
        placementDmm: {
          minXDmm: placement.minXDmm,
          maxXDmm: placement.maxXDmm,
          minYDmm: placement.minYDmm,
          maxYDmm: placement.maxYDmm,
          minZDmm: placement.minZDmm,
          maxZDmm: placement.maxZDmm,
        },
        sourceSpecId: partGraph.sourceSpecId || null,
        interactive: false,
        materialCode: part.materialCode || null,
        rawDimensionsMm: part.raw
          ? {
              lengthMm: part.raw.lengthDmm / 10,
              widthMm: part.raw.widthDmm / 10,
              thicknessMm: part.raw.thicknessDmm / 10,
            }
          : null,
        edgesMm: part.edges
          ? {
              lengthEdge1Mm: part.edges.LENGTH_EDGE_1 / 10,
              lengthEdge2Mm: part.edges.LENGTH_EDGE_2 / 10,
              widthEdge1Mm: part.edges.WIDTH_EDGE_1 / 10,
              widthEdge2Mm: part.edges.WIDTH_EDGE_2 / 10,
            }
          : null,
        partData: part,
      };

      rootGroup.add(mesh);
    }
  }

  // Attach disposal helper and door pivots directly to group
  rootGroup.userData = {
    sourceSpecId: partGraph.sourceSpecId,
    partGraphVersion: partGraph.partGraphVersion,
    structuralPartCount: partGraph.parts.length,
    materials: allocatedMaterials,
    materialMap: materials,
    doorPivots,
    dispose: () => disposePartGraphGroup(rootGroup),
  };

  if (options.centerOrigin && partGraph.summary?.envelope) {
    const env = partGraph.summary.envelope;
    rootGroup.position.set(
      (-env.widthDmm / 2) * DMM_TO_THREE,
      (-env.heightDmm / 2) * DMM_TO_THREE,
      (-env.depthDmm / 2) * DMM_TO_THREE
    );
  }

  return rootGroup;
}

/**
 * Completely and recursively disposes all geometries and materials
 * created for a PartGraph group.
 *
 * @param {THREE.Group} group
 */
export function disposePartGraphGroup(group) {
  if (!group) return;

  const materialsToDispose = new Set();

  group.traverse((obj) => {
    if (obj.geometry && typeof obj.geometry.dispose === "function") {
      obj.geometry.dispose();
    }
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m && materialsToDispose.add(m));
      } else {
        materialsToDispose.add(obj.material);
      }
    }
  });

  if (group.userData?.materials && Array.isArray(group.userData.materials)) {
    group.userData.materials.forEach((mat) => mat && materialsToDispose.add(mat));
  }

  materialsToDispose.forEach((mat) => {
    if (typeof mat.dispose === "function") {
      mat.dispose();
    }
  });

  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }
}
