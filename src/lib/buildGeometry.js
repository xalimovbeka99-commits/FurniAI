/**
 * buildGeometry — pure function: FurnitureConfig -> flat list of parts.
 * --------------------------------------------------------------------
 * No Three.js, no React. Just maths. Each part is:
 *   { id, role, size: [w, h, d] (metres), position: [x, y, z] (centre), material }
 *
 * The SAME list is rendered as <boxGeometry> meshes AND converted to a cut list.
 * That's the whole point: the model is parametric all the way down to the panel,
 * so anything you see can be cut, priced, and machined.
 *
 * Coordinate frame: piece is centred on X, sits on the floor at Y=0, depth
 * centred on Z. Units are metres.
 */
import * as THREE from "three";
import { PANEL_THICKNESS as T, BACK_THICKNESS as BT, normaliseModules } from "./furnitureConfig.js";

export function buildGeometry(configOrPartGraph, options = {}) {
  // If a PartGraph is passed, delegate to discrete PartGraph panel mounting
  if (configOrPartGraph && (Array.isArray(configOrPartGraph.parts) || configOrPartGraph.partGraphVersion)) {
    return buildPartGraphMeshes(configOrPartGraph, options);
  }
  const config = configOrPartGraph;
  const parts = [];
  const { width: W, height: H, depth: D } = config.dimensions;
  const mat = config.material;
  let id = 0;
  const push = (role, size, position, extra = {}) =>
    parts.push({ id: `P${id++}`, role, size, position, material: mat, ...extra });

  // Plinth raises the carcass; everything above sits on top of it.
  const plinth = config.hasPlinth ? config.plinthHeight : 0;
  const carcassH = H - plinth;
  const baseY = plinth;             // floor of the carcass interior
  const midY = baseY + carcassH / 2;

  // --- Carcass shell -------------------------------------------------------
  // Sides
  push("side", [T, carcassH, D], [-W / 2 + T / 2, midY, 0]);
  push("side", [T, carcassH, D], [W / 2 - T / 2, midY, 0]);
  // Top + bottom (between the sides)
  const innerW = W - 2 * T;
  push("top", [innerW, T, D], [0, baseY + carcassH - T / 2, 0]);
  push("bottom", [innerW, T, D], [0, baseY + T / 2, 0]);
  // Back
  push("back", [innerW, carcassH - 2 * T, BT], [0, midY, -D / 2 + BT / 2]);

  // Plinth (recessed slightly)
  if (plinth > 0) {
    push("plinth", [W - 0.04, plinth, T], [0, plinth / 2, D / 2 - 0.05]);
  }

  // --- Modules (vertical bays, left -> right) ------------------------------
  const modules = normaliseModules(config.modules || []);
  const interiorLeft = -W / 2 + T;     // inner face of left side
  const interiorW = innerW;
  const interiorBottom = baseY + T;
  const interiorH = carcassH - 2 * T;
  // Dividers occupy real width inside the carcass. Ratios divide only the
  // remaining clear bay width; otherwise every divider is added on top of
  // `interiorW` and the final bay/door extends beyond the right side panel.
  const dividerCount = Math.max(0, modules.length - 1);
  const clearBayWidth = interiorW - dividerCount * T;

  let cursorX = interiorLeft;
  modules.forEach((mod, i) => {
    const modW = clearBayWidth * mod.widthRatio;
    const modCenterX = cursorX + modW / 2;

    // Divider between modules (not after the last one)
    if (i < modules.length - 1) {
      push("divider", [T, interiorH, D - BT], [cursorX + modW + T / 2, midY, BT / 2]);
    }

    // Shelves
    if (mod.shelfCount > 0) {
      const gaps = mod.shelfCount + 1;
      for (let s = 1; s <= mod.shelfCount; s++) {
        const y = interiorBottom + (interiorH * s) / gaps;
        push("shelf", [modW - 0.004, T, D - BT - 0.02], [modCenterX, y, BT / 2], { module: i });
      }
    }

    // Drawer fronts
    if (mod.drawerRows > 0) {
      const rowH = interiorH / mod.drawerRows;
      for (let r = 0; r < mod.drawerRows; r++) {
        const y = interiorBottom + rowH * (r + 0.5);
        push("drawerFront", [modW - 0.006, rowH - 0.006, T], [modCenterX, y, D / 2 - T / 2], {
          module: i,
          handle: config.handleStyle,
        });
      }
    }

    // Doors
    if (mod.doorCount > 0) {
      const doorW = modW / mod.doorCount;
      for (let dn = 0; dn < mod.doorCount; dn++) {
        const x = cursorX + doorW * (dn + 0.5);
        push("door", [doorW - 0.006, interiorH - 0.006, T], [x, interiorBottom + interiorH / 2, D / 2 - T / 2], {
          module: i,
          hingeSide: mod.hingeSide,
          doorType: config.doorType,
          handle: config.handleStyle,
        });
      }
    }

    cursorX += modW + (i < modules.length - 1 ? T : 0);
  });

  return parts;
}

/**
 * Deterministic geometry QA for the rectangular-panel kernel. Furniture-
 * specific construction and hardware rules belong in the domain validator.
 *
 * @returns {{ code: string, partId: string|null, message: string }[]}
 */
export function validateGeometry(parts, config, tolerance = 1e-9) {
  const issues = [];
  const { width: W, height: H, depth: D } = config.dimensions;
  const bounds = {
    minX: -W / 2,
    maxX: W / 2,
    minY: 0,
    maxY: H,
    minZ: -D / 2,
    maxZ: D / 2,
  };

  for (const part of parts) {
    const values = [...(part.size || []), ...(part.position || [])];
    if (values.length !== 6 || values.some((value) => !Number.isFinite(value))) {
      issues.push({
        code: "NON_FINITE_GEOMETRY",
        partId: part.id || null,
        message: `Part "${part.id || "unknown"}" has incomplete or non-finite size/position values.`,
      });
      continue;
    }

    const [w, h, d] = part.size;
    const [x, y, z] = part.position;
    if (w <= 0 || h <= 0 || d <= 0) {
      issues.push({
        code: "NON_POSITIVE_PART_SIZE",
        partId: part.id || null,
        message: `Part "${part.id || "unknown"}" must have positive width, height and depth.`,
      });
      continue;
    }

    const extents = {
      minX: x - w / 2,
      maxX: x + w / 2,
      minY: y - h / 2,
      maxY: y + h / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
    };
    const outside =
      extents.minX < bounds.minX - tolerance ||
      extents.maxX > bounds.maxX + tolerance ||
      extents.minY < bounds.minY - tolerance ||
      extents.maxY > bounds.maxY + tolerance ||
      extents.minZ < bounds.minZ - tolerance ||
      extents.maxZ > bounds.maxZ + tolerance;

    if (outside) {
      issues.push({
        code: "PART_OUTSIDE_ENVELOPE",
        partId: part.id || null,
        message: `Part "${part.id || "unknown"}" extends outside the configured furniture envelope.`,
      });
    }
  }

  return issues;
}

/** Total finished panel area in m² (drives material cost). */
export function panelAreaFromParts(parts) {
  // Largest face of each part × quantity (parts already expanded, qty = 1 each).
  return parts.reduce((sum, p) => {
    const [w, h, d] = p.size;
    const faces = [w * h, w * d, h * d].sort((a, b) => b - a);
    return sum + faces[0];
  }, 0);
}

/** Convert parts to a factory cut list (mm), grouped by identical dimensions. */
export function partsToCutList(parts) {
  const mm = (m) => Math.round(m * 1000);
  const map = new Map();
  for (const p of parts) {
    const [w, h, d] = p.size;
    // length = longest, width = next, thickness = smallest
    const [length, width, thk] = [w, h, d].sort((a, b) => b - a);
    const key = `${p.role}|${mm(length)}x${mm(width)}x${mm(thk)}|${p.material}`;
    const row = map.get(key);
    if (row) row.qty += 1;
    else
      map.set(key, {
        role: p.role,
        length: mm(length),
        width: mm(width),
        thickness: mm(thk),
        material: p.material,
        qty: 1,
      });
  }
  return [...map.values()];
}

// -----------------------------------------------------------------------------
// PartGraph Discrete Panel Mounting & System 32 Review Guides (Gate G2.2 / 3D)
// -----------------------------------------------------------------------------

/**
 * Creates standard materials for PartGraph panel roles.
 */
export function createPartMaterials(T = THREE, customOptions = {}) {
  return {
    GABLE: new T.MeshStandardMaterial({
      color: 0xf5f3ed,
      roughness: 0.65,
      metalness: 0.02,
      name: "mat_gable_melamine",
    }),
    DIVIDER: new T.MeshStandardMaterial({
      color: 0xf0eee8,
      roughness: 0.65,
      metalness: 0.02,
      name: "mat_divider_melamine",
    }),
    SHELF: new T.MeshStandardMaterial({
      color: 0xf5f3ed,
      roughness: 0.65,
      metalness: 0.02,
      name: "mat_shelf_melamine",
    }),
    DRAWER_FRONT: new T.MeshStandardMaterial({
      color: 0xfbf9f5,
      roughness: 0.45,
      metalness: 0.05,
      name: "mat_drawer_front",
    }),
    DRAWER_BODY: new T.MeshStandardMaterial({
      color: 0xe8e4dc,
      roughness: 0.7,
      metalness: 0.02,
      name: "mat_drawer_body",
    }),
    DOOR: new T.MeshStandardMaterial({
      color: 0xfbf9f5,
      roughness: 0.4,
      metalness: 0.05,
      name: "mat_door",
    }),
    BACK: new T.MeshStandardMaterial({
      color: 0xe5e1d5,
      roughness: 0.85,
      metalness: 0.0,
      name: "mat_back_panel",
    }),
    PLINTH: new T.MeshStandardMaterial({
      color: 0x3d3a36,
      roughness: 0.75,
      metalness: 0.1,
      name: "mat_plinth",
    }),
    DEFAULT: new T.MeshStandardMaterial({
      color: 0xdedad2,
      roughness: 0.6,
      metalness: 0.02,
      name: "mat_panel_default",
    }),
    EDGE_BANDING: new T.MeshStandardMaterial({
      color: customOptions.edgeBandingColor || 0x4a4238, // 1.0 mm subtle visual tint
      roughness: 0.55,
      metalness: 0.05,
      name: "mat_edge_banding_tint",
    }),
    SYSTEM32_PIN: new T.MeshStandardMaterial({
      color: customOptions.system32PinColor || 0x2563eb, // Carpenter/debug blue marker
      roughness: 0.3,
      metalness: 0.7,
      name: "mat_system32_pin",
    }),
  };
}

/**
 * Resolves appropriate material for a PartGraph part role.
 */
export function getMaterialForPartRole(role, materials) {
  const r = String(role || "").toUpperCase();
  if (r.includes("GABLE") || r.startsWith("SIDE_PANEL") || r === "SIDE" || r.startsWith("CARC_SIDE")) {
    return materials.GABLE;
  }
  if (r.includes("DIVIDER") || r.startsWith("CARC_DIV")) {
    return materials.DIVIDER;
  }
  if (r.includes("SHELF")) {
    return materials.SHELF;
  }
  if (r === "DRAWER_FRONT" || r === "DRAWERFRONT") {
    return materials.DRAWER_FRONT;
  }
  if (r.startsWith("DRAWER_") || r === "DRAWER") {
    return materials.DRAWER_BODY;
  }
  if (r.includes("DOOR")) {
    return materials.DOOR;
  }
  if (r.includes("BACK")) {
    return materials.BACK;
  }
  if (r.startsWith("PLINTH")) {
    return materials.PLINTH;
  }
  return materials.DEFAULT;
}

/**
 * Checks if a role represents a vertical gable/divider.
 */
function isVerticalGableRole(role) {
  const r = String(role || "").toUpperCase();
  return (
    r.includes("GABLE") ||
    r.startsWith("SIDE_PANEL") ||
    r === "SIDE" ||
    r.startsWith("CARC_SIDE") ||
    r.includes("DIVIDER") ||
    r.startsWith("CARC_DIV")
  );
}

/**
 * Checks if a role is a shelf.
 */
function isShelfRole(role) {
  const r = String(role || "").toUpperCase();
  return r.includes("SHELF");
}

/**
 * Checks if a role is a drawer part.
 */
function isDrawerRole(role) {
  const r = String(role || "").toUpperCase();
  return r.startsWith("DRAWER_") || r === "DRAWER" || r === "DRAWERFRONT";
}

/**
 * Generates System 32 review pins along vertical gables.
 *
 * Rules:
 * - Front row: 37 mm from front edge datum.
 * - Rear row: 37 mm from rear edge datum.
 * - Pitch: 32 mm intervals starting 64 mm above the bottom panel.
 * - Diameter: 5 mm (radius = 2.5 mm).
 *
 * @param {object} partGraph - Validated PartGraph object
 * @param {object} options
 * @param {typeof THREE} [options.threeInstance]
 * @param {number} [options.unitScale=0.001]
 * @param {Record<string, THREE.Material>} [options.materials]
 * @returns {THREE.Group} Group containing System 32 pin meshes
 */
export function generateSystem32Pins(partGraph, options = {}) {
  const T = options.threeInstance || THREE;
  const unitScale = options.unitScale !== undefined ? options.unitScale : 0.001; // default metres
  const materials = options.materials || createPartMaterials(T, options);

  const pinsGroup = new T.Group();
  pinsGroup.name = "system32_pins";

  if (!partGraph || !Array.isArray(partGraph.parts)) {
    return pinsGroup;
  }

  // Find bottom panel top datum if present
  const bottomPart = partGraph.parts.find((p) => {
    const r = String(p.role || "").toUpperCase();
    return r.includes("BOTTOM") || r === "CARC_BOT";
  });
  const bottomTopMm = bottomPart?.placement
    ? bottomPart.placement.maxYDmm / 10
    : 0;

  // Pin geometry: 5mm diameter cylinder (radius = 2.5 mm)
  // Pin length: 4 mm along X (gable drilling axis)
  const pinRadius = 2.5 * unitScale;
  const pinLength = 4.0 * unitScale;
  const pinGeo = new T.CylinderGeometry(pinRadius, pinRadius, pinLength, 12);
  pinGeo.rotateZ(Math.PI / 2); // Orient horizontal into gable face

  let pinCount = 0;

  for (const part of partGraph.parts) {
    if (!part.placement || !isVerticalGableRole(part.role)) continue;

    const minXMm = part.placement.minXDmm / 10;
    const maxXMm = part.placement.maxXDmm / 10;
    const minYMm = part.placement.minYDmm / 10;
    const maxYMm = part.placement.maxYDmm / 10;
    const minZMm = part.placement.minZDmm / 10;
    const maxZMm = part.placement.maxZDmm / 10;

    const centerXMm = (minXMm + maxXMm) / 2;

    // Front row: 37 mm from front edge datum (minZ in PartGraph space)
    const frontRowZMm = minZMm + 37;
    // Rear row: 37 mm from rear datum (maxZ in PartGraph space)
    const rearRowZMm = maxZMm - 37;

    // Baseline: starting 64 mm above the bottom panel
    const baselineYMm = (bottomTopMm > 0 ? bottomTopMm : minYMm) + 64;

    // Pitch: 32 mm intervals
    for (let y = baselineYMm; y <= maxYMm - 32; y += 32) {
      // Front pin
      const frontPin = new T.Mesh(pinGeo, materials.SYSTEM32_PIN);
      frontPin.name = `system32_pin_front_${part.id}_y${Math.round(y)}`;
      frontPin.position.set(
        centerXMm * unitScale,
        y * unitScale,
        frontRowZMm * unitScale
      );
      frontPin.userData = {
        isSystem32Pin: true,
        row: "front",
        offsetMm: 37,
        heightMm: y,
        diameterMm: 5,
        parentGableId: part.id,
      };
      pinsGroup.add(frontPin);
      pinCount++;

      // Rear pin
      const rearPin = new T.Mesh(pinGeo, materials.SYSTEM32_PIN);
      rearPin.name = `system32_pin_rear_${part.id}_y${Math.round(y)}`;
      rearPin.position.set(
        centerXMm * unitScale,
        y * unitScale,
        rearRowZMm * unitScale
      );
      rearPin.userData = {
        isSystem32Pin: true,
        row: "rear",
        offsetMm: 37,
        heightMm: y,
        diameterMm: 5,
        parentGableId: part.id,
      };
      pinsGroup.add(rearPin);
      pinCount++;
    }
  }

  pinsGroup.userData = {
    isSystem32Pins: true,
    pinDiameterMm: 5,
    pitchMm: 32,
    frontOffsetMm: 37,
    rearOffsetMm: 37,
    startOffsetMm: 64,
    totalPins: pinCount,
  };

  return pinsGroup;
}

/**
 * Builds discrete Three.js panel meshes from a PartGraph.
 *
 * Requirements:
 * - Each PartGraph part (GABLE, DIVIDER, SHELF, DRAWER_*) rendered as independent THREE.BoxGeometry.
 * - Positioned using part bounding datums (placement.minXDmm, minYDmm, minZDmm / 10).
 * - 1.0 mm visual edge-banding tint on front-facing edges.
 * - System 32 preview toggle (showSystem32Pins) with 37 mm front/rear offsets and 32 mm pitch starting at 64 mm.
 *
 * @param {object} partGraph - Validated PartGraph object
 * @param {object} [options]
 * @param {typeof THREE} [options.threeInstance]
 * @param {boolean} [options.showSystem32Pins=false]
 * @param {string} [options.unitScale="m"] - "m" (metres, 0.001) or "mm" (1)
 * @param {number} [options.edgeBandingColor]
 * @param {Record<string, THREE.Material>} [options.materials]
 * @returns {THREE.Group} Root Three.js group with discrete panel meshes
 */
export function buildPartGraphMeshes(partGraph, options = {}) {
  if (!partGraph || typeof partGraph !== "object") {
    throw new TypeError("buildPartGraphMeshes requires a valid PartGraph object.");
  }
  if (!Array.isArray(partGraph.parts)) {
    throw new TypeError("buildPartGraphMeshes: partGraph.parts must be an array.");
  }

  const T = options.threeInstance || THREE;
  const rootGroup = new T.Group();
  rootGroup.name = `partgraph_model_${partGraph.sourceSpecId || "discrete"}`;

  const unitScale = options.unitScale === "mm" ? 1 : 0.001; // default metres
  const materials = options.materials || createPartMaterials(T, options);

  const edgeBandThickness = 1.0 * unitScale; // 1.0 mm visual edge-banding thickness
  const allocatedMaterials = Object.values(materials);

  const panelMeshes = [];

  for (const part of partGraph.parts) {
    const { placement, id, role } = part;
    if (!placement) {
      throw new Error(`Part "${id}" is missing placement coordinates.`);
    }

    // Exact bounding datums in mm
    const minXMm = placement.minXDmm / 10;
    const maxXMm = placement.maxXDmm / 10;
    const minYMm = placement.minYDmm / 10;
    const maxYMm = placement.maxYDmm / 10;
    const minZMm = placement.minZDmm / 10;
    const maxZMm = placement.maxZDmm / 10;

    const widthMm = maxXMm - minXMm;
    const heightMm = maxYMm - minYMm;
    const depthMm = maxZMm - minZMm;

    // Converted to Three.js units
    const widthThree = widthMm * unitScale;
    const heightThree = heightMm * unitScale;
    const depthThree = depthMm * unitScale;

    // Center position derived strictly from bounding datums: (min + max) / 2
    const centerXMm = (minXMm + maxXMm) / 2;
    const centerYDmm = (minYMm + maxYMm) / 2;
    const centerZDmm = (minZMm + maxZMm) / 2;

    // Independent THREE.BoxGeometry
    const geometry = new T.BoxGeometry(widthThree, heightThree, depthThree);
    const material = getMaterialForPartRole(role, materials);
    const mesh = new T.Mesh(geometry, material);

    mesh.name = `panel_${id}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(
      centerXMm * unitScale,
      centerYDmm * unitScale,
      centerZDmm * unitScale
    );

    // Attach complete datum metadata to mesh
    mesh.userData = {
      partId: id,
      role,
      datumsMm: {
        minXMm,
        maxXMm,
        minYMm,
        maxYMm,
        minZMm,
        maxZMm,
        widthMm,
        heightMm,
        depthMm,
      },
      placementDmm: {
        minXDmm: placement.minXDmm,
        maxXDmm: placement.maxXDmm,
        minYDmm: placement.minYDmm,
        maxYDmm: placement.maxYDmm,
        minZDmm: placement.minZDmm,
        maxZDmm: placement.maxZDmm,
      },
      finishedDimensionsMm: part.finished
        ? {
            lengthMm: part.finished.lengthDmm / 10,
            widthMm: part.finished.widthDmm / 10,
            thicknessMm: part.finished.thicknessDmm / 10,
          }
        : null,
      rawDimensionsMm: part.raw
        ? {
            lengthMm: part.raw.lengthDmm / 10,
            widthMm: part.raw.widthDmm / 10,
            thicknessMm: part.raw.thicknessDmm / 10,
          }
        : null,
      sourcePart: part,
    };

    // Apply 1.0 mm visual edge-banding tint on front-facing edges
    // In FurniAI space, front is at minZ (-Z local mesh direction).
    const needsEdgeBanding =
      isVerticalGableRole(role) ||
      isShelfRole(role) ||
      isDrawerRole(role);

    if (needsEdgeBanding) {
      const edgeBandGeo = new T.BoxGeometry(
        widthThree,
        heightThree,
        edgeBandThickness
      );
      const edgeBandMesh = new T.Mesh(edgeBandGeo, materials.EDGE_BANDING);
      edgeBandMesh.name = `edgeband_${id}`;
      // Position at front face of the panel
      edgeBandMesh.position.set(0, 0, -depthThree / 2 + edgeBandThickness / 2);
      edgeBandMesh.userData = {
        isEdgeBanding: true,
        thicknessMm: 1.0,
        parentPartId: id,
      };
      mesh.add(edgeBandMesh);
      mesh.userData.hasEdgeBanding = true;
      mesh.userData.edgeBandThicknessMm = 1.0;
    }

    rootGroup.add(mesh);
    panelMeshes.push(mesh);
  }

  // System 32 Review Guides
  const system32Group = generateSystem32Pins(partGraph, {
    threeInstance: T,
    unitScale,
    materials,
  });

  const showPins = !!options.showSystem32Pins;
  system32Group.visible = showPins;
  rootGroup.add(system32Group);

  // Group metadata and lifecycle
  rootGroup.userData = {
    sourceSpecId: partGraph.sourceSpecId || null,
    partGraphVersion: partGraph.partGraphVersion || null,
    panelCount: panelMeshes.length,
    panels: panelMeshes,
    materials: allocatedMaterials,
    materialMap: materials,
    system32Group,
    showSystem32Pins: showPins,
    toggleSystem32Pins: (visible) => {
      system32Group.visible = !!visible;
      rootGroup.userData.showSystem32Pins = !!visible;
      return system32Group.visible;
    },
    dispose: () => disposeGeometryGroup(rootGroup),
  };

  return rootGroup;
}

/** Alias for buildPartGraphMeshes */
export const buildDiscretePartGraphPanels = buildPartGraphMeshes;

/**
 * Traverses a Three.js group/object and disposes all geometries and materials.
 * Ensures zero WebGL memory leaks, zero context loss, and complete cleanup.
 *
 * @param {THREE.Object3D} group - The root Three.js object to dispose
 */
export function disposeGeometryGroup(group) {
  if (!group) return;

  const geometriesToDispose = new Set();
  const materialsToDispose = new Set();

  group.traverse((obj) => {
    if (obj.geometry && typeof obj.geometry.dispose === "function") {
      geometriesToDispose.add(obj.geometry);
    }
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach((mat) => mat && materialsToDispose.add(mat));
      } else {
        materialsToDispose.add(obj.material);
      }
    }
  });

  // Check group's stored material map if present
  if (Array.isArray(group.userData?.materials)) {
    group.userData.materials.forEach((m) => m && materialsToDispose.add(m));
  }

  // Dispose all geometries
  geometriesToDispose.forEach((geo) => {
    try {
      geo.dispose();
    } catch (_) {}
  });

  // Dispose all materials
  materialsToDispose.forEach((mat) => {
    try {
      mat.dispose();
    } catch (_) {}
  });

  // Detach all children from parent
  while (group.children && group.children.length > 0) {
    group.remove(group.children[0]);
  }
}
