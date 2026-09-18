"use client";

/**
 * src/components/viewer3d/CamOverlayLayer.jsx
 * =====================================================================
 * Three.js 3D CAM Toolpath & Vacuum Pod Clamp Visualization (Milestone M3)
 *
 * Isolated presentation layer attached to 3D scene:
 * - Mounts an isolated THREE.Group named 'camToolpathsGroup'.
 * - G00 Rapid Trajectories: High-contrast dashed amber THREE.LineDashedMaterial.
 * - G01/G02/G03 Cutting Feeds: Solid cyan/lime line segments with directional vectors.
 * - Kerf Ribbon Geometry: Flat ribbon normal to panel face displaying true cutter kerf width.
 * - Vacuum Clamp Exclusion Zones: Box geometries with 15 mm exclusion halo.
 * - Visual warning material: Semi-transparent red wireframe triggered on kerf-clamp collision.
 * - Dynamic Spindle/Toolhead Mesh tracking active coordinates & Z-depth during simulation scrubbing.
 */

import { useEffect, useRef } from "react";
import * as THREE_MODULE from "three";
import { DMM_TO_THREE } from "@/lib/adapters/partGraphToThree";
import { compileNeutralOperations } from "@/lib/cam/neutralOperations";
import { adaptNeutralOperationsToOverlay } from "@/lib/cam/camOverlayAdapter";

export const DEFAULT_KERF_MM = 9.525; // 3/8" standard CNC compression router bit
export const GROOVE_KERF_MM = 6.0;   // 6.0 mm back groove router bit
export const EXCLUSION_HALO_MM = 15.0; // 15 mm required safety clearance around pods/clamps
export const MM_TO_THREE = 0.001;     // 1 mm = 0.001 Three.js world units (metres)

/**
 * Material definitions for CAM overlay.
 */
export function createCamMaterials(THREE = THREE_MODULE) {
  return {
    rapidMove: new THREE.LineDashedMaterial({
      color: 0xffb703, // high-contrast amber
      linewidth: 2,
      scale: 1,
      dashSize: 0.02,
      gapSize: 0.015,
      name: "mat_cam_rapid_amber",
    }),
    cutFeed: new THREE.LineBasicMaterial({
      color: 0x00f5d4, // vibrant cyan
      linewidth: 2.5,
      name: "mat_cam_feed_cyan",
    }),
    cutFeedLime: new THREE.LineBasicMaterial({
      color: 0x39ff14, // neon lime for groove cuts
      linewidth: 2.5,
      name: "mat_cam_feed_lime",
    }),
    kerfRibbon: new THREE.MeshBasicMaterial({
      color: 0x00f5d4,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false,
      name: "mat_cam_kerf_ribbon",
    }),
    vacuumPodSolid: new THREE.MeshStandardMaterial({
      color: 0x343a40,
      metalness: 0.7,
      roughness: 0.3,
      name: "mat_cam_vacuum_pod_solid",
    }),
    vacuumHaloSafe: new THREE.MeshBasicMaterial({
      color: 0x2a9d8f,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
      name: "mat_cam_vacuum_halo_safe",
    }),
    vacuumHaloWarning: new THREE.MeshBasicMaterial({
      color: 0xff0033, // hazard warning red
      wireframe: true,
      transparent: true,
      opacity: 0.9,
      name: "mat_cam_vacuum_halo_warning",
    }),
    vacuumPodWarning: new THREE.MeshStandardMaterial({
      color: 0xff1e42,
      metalness: 0.5,
      roughness: 0.4,
      transparent: true,
      opacity: 0.75,
      name: "mat_cam_vacuum_pod_warning",
    }),
    toolheadCutter: new THREE.MeshStandardMaterial({
      color: 0xff7b00, // safety orange toolhead
      metalness: 0.85,
      roughness: 0.2,
      name: "mat_cam_toolhead_cutter",
    }),
    toolheadSpindle: new THREE.MeshStandardMaterial({
      color: 0xced4da,
      metalness: 0.95,
      roughness: 0.15,
      name: "mat_cam_toolhead_spindle",
    }),
  };
}

/**
 * Generates discrete toolpath operations (G00 rapid, G01 feed) for a PartGraph panel.
 * Coordinates are in panel world space (metres).
 *
 * @param {object} part - PartGraph part
 * @param {object} [options]
 * @returns {Array<{ type: string, from: {x,y,z}, to: {x,y,z}, isCutting: boolean, feedRate: number, zDepthMm: number, kerfMm: number, description: string }>}
 */
export function generatePanelToolpaths(part, options = {}) {
  const kerfMm = options.kerfMm || DEFAULT_KERF_MM;
  const kerfThree = kerfMm * MM_TO_THREE;
  const clearanceZMm = options.clearanceZMm || 25.0; // 25 mm clearance plane
  const clearanceZThree = clearanceZMm * MM_TO_THREE;

  const b = (part && part.placement && part.placement.boundingDmm) || (part && part.placement);
  if (!b || b.minXDmm == null || b.maxXDmm == null) {
    return [];
  }
  const minX = b.minXDmm * DMM_TO_THREE;
  const maxX = b.maxXDmm * DMM_TO_THREE;
  const minY = b.minYDmm * DMM_TO_THREE;
  const maxY = b.maxYDmm * DMM_TO_THREE;
  const minZ = b.minZDmm * DMM_TO_THREE;
  const maxZ = b.maxZDmm * DMM_TO_THREE;

  const dx = maxX - minX;
  const dy = maxY - minY;
  const dz = maxZ - minZ;

  // Determine panel orientation and primary cutting plane
  const operations = [];

  // Face normal calculation: find thin axis (thickness)
  let axis = "z";
  if (dx <= dy && dx <= dz) axis = "x";
  else if (dy <= dx && dy <= dz) axis = "y";

  if (axis === "z") {
    // Panel flat or facing XY plane (e.g. Back, Door)
    const zRef = maxZ;
    const zSafe = zRef + clearanceZThree;
    const zCut = minZ - (0.5 * MM_TO_THREE); // 0.5 mm through-cut spoilboard allowance
    const zDepthVal = -((maxZ - minZ) / MM_TO_THREE + 0.5);

    // 1. Rapid move to approach point
    const p0 = { x: minX - kerfThree, y: minY - kerfThree, z: zSafe };
    const p1 = { x: minX, y: minY, z: zSafe };
    const p2 = { x: minX, y: minY, z: zCut };

    operations.push({
      type: "G00",
      from: p0,
      to: p1,
      isCutting: false,
      feedRate: 30000,
      zDepthMm: clearanceZMm,
      kerfMm,
      description: `Rapid to approach (${part.id})`,
    });

    // 2. Plunge feed
    operations.push({
      type: "G01",
      from: p1,
      to: p2,
      isCutting: true,
      feedRate: 3000,
      zDepthMm: zDepthVal,
      kerfMm,
      description: `Plunge to full depth (${part.id})`,
    });

    // 3. Perimeter contour climb cut: (minX, minY) -> (maxX, minY) -> (maxX, maxY) -> (minX, maxY) -> (minX, minY)
    const corners = [
      { x: maxX, y: minY, z: zCut },
      { x: maxX, y: maxY, z: zCut },
      { x: minX, y: maxY, z: zCut },
      { x: minX, y: minY, z: zCut },
    ];

    let curr = p2;
    for (let i = 0; i < corners.length; i++) {
      operations.push({
        type: "G01",
        from: curr,
        to: corners[i],
        isCutting: true,
        feedRate: 12000,
        zDepthMm: zDepthVal,
        kerfMm,
        description: `Perimeter contour leg ${i + 1} (${part.id})`,
      });
      curr = corners[i];
    }

    // 4. Retract rapid
    const pRetract = { x: curr.x, y: curr.y, z: zSafe };
    operations.push({
      type: "G00",
      from: curr,
      to: pRetract,
      isCutting: false,
      feedRate: 30000,
      zDepthMm: clearanceZMm,
      kerfMm,
      description: `Retract to clearance (${part.id})`,
    });
  } else if (axis === "x") {
    // Vertical side/divider panel on YZ plane
    const xRef = maxX;
    const xSafe = xRef + clearanceZThree;
    const xCut = minX - (0.5 * MM_TO_THREE);
    const zDepthVal = -((maxX - minX) / MM_TO_THREE + 0.5);

    const p0 = { x: xSafe, y: minY - kerfThree, z: minZ - kerfThree };
    const p1 = { x: xSafe, y: minY, z: minZ };
    const p2 = { x: xCut, y: minY, z: minZ };

    operations.push({
      type: "G00",
      from: p0,
      to: p1,
      isCutting: false,
      feedRate: 30000,
      zDepthMm: clearanceZMm,
      kerfMm,
      description: `Rapid to approach (${part.id})`,
    });
    operations.push({
      type: "G01",
      from: p1,
      to: p2,
      isCutting: true,
      feedRate: 3000,
      zDepthMm: zDepthVal,
      kerfMm,
      description: `Plunge to full depth (${part.id})`,
    });

    const corners = [
      { x: xCut, y: minY, z: maxZ },
      { x: xCut, y: maxY, z: maxZ },
      { x: xCut, y: maxY, z: minZ },
      { x: xCut, y: minY, z: minZ },
    ];

    let curr = p2;
    for (let i = 0; i < corners.length; i++) {
      operations.push({
        type: "G01",
        from: curr,
        to: corners[i],
        isCutting: true,
        feedRate: 12000,
        zDepthMm: zDepthVal,
        kerfMm,
        description: `Perimeter contour leg ${i + 1} (${part.id})`,
      });
      curr = corners[i];
    }

    operations.push({
      type: "G00",
      from: curr,
      to: { x: xSafe, y: curr.y, z: curr.z },
      isCutting: false,
      feedRate: 30000,
      zDepthMm: clearanceZMm,
      kerfMm,
      description: `Retract to clearance (${part.id})`,
    });
  } else {
    // Horizontal shelf / top / bottom on XZ plane
    const yRef = maxY;
    const ySafe = yRef + clearanceZThree;
    const yCut = minY - (0.5 * MM_TO_THREE);
    const zDepthVal = -((maxY - minY) / MM_TO_THREE + 0.5);

    const p0 = { x: minX - kerfThree, y: ySafe, z: minZ - kerfThree };
    const p1 = { x: minX, y: ySafe, z: minZ };
    const p2 = { x: minX, y: yCut, z: minZ };

    operations.push({
      type: "G00",
      from: p0,
      to: p1,
      isCutting: false,
      feedRate: 30000,
      zDepthMm: clearanceZMm,
      kerfMm,
      description: `Rapid to approach (${part.id})`,
    });
    operations.push({
      type: "G01",
      from: p1,
      to: p2,
      isCutting: true,
      feedRate: 3000,
      zDepthMm: zDepthVal,
      kerfMm,
      description: `Plunge to full depth (${part.id})`,
    });

    const corners = [
      { x: maxX, y: yCut, z: minZ },
      { x: maxX, y: yCut, z: maxZ },
      { x: minX, y: yCut, z: maxZ },
      { x: minX, y: yCut, z: minZ },
    ];

    let curr = p2;
    for (let i = 0; i < corners.length; i++) {
      operations.push({
        type: "G01",
        from: curr,
        to: corners[i],
        isCutting: true,
        feedRate: 12000,
        zDepthMm: zDepthVal,
        kerfMm,
        description: `Perimeter contour leg ${i + 1} (${part.id})`,
      });
      curr = corners[i];
    }

    operations.push({
      type: "G00",
      from: curr,
      to: { x: curr.x, y: ySafe, z: curr.z },
      isCutting: false,
      feedRate: 30000,
      zDepthMm: clearanceZMm,
      kerfMm,
      description: `Retract to clearance (${part.id})`,
    });
  }

  return operations;
}

/**
 * Builds the visual trajectory meshes for all toolpath operations:
 * - G00: dashed amber LineSegments
 * - G01: solid cyan LineSegments
 * - Kerf Ribbon: Double-sided flat ribbon mesh showing true cutter diameter
 *
 * @param {Array<object>} operations
 * @param {object} [options]
 * @param {typeof THREE_MODULE} [THREE]
 * @returns {THREE.Group}
 */
export function buildToolpathTrajectoryMesh(operations, options = {}, THREE = THREE_MODULE) {
  const group = new THREE.Group();
  group.name = "camTrajectories";

  const materials = options.materials || createCamMaterials(THREE);

  const rapidPoints = [];
  const feedPoints = [];
  const groovePoints = [];
  const ribbonVertices = [];
  const ribbonIndices = [];

  let vertexIndex = 0;

  for (const op of operations) {
    const v1 = new THREE.Vector3(op.from.x, op.from.y, op.from.z);
    const v2 = new THREE.Vector3(op.to.x, op.to.y, op.to.z);

    if (op.type === "G00" || !op.isCutting || op.category === "RAPID") {
      rapidPoints.push(v1, v2);
    } else {
      if (op.category === "GROOVE") {
        groovePoints.push(v1, v2);
      } else {
        feedPoints.push(v1, v2);
      }

      // Construct kerf ribbon quad for cutting feed
      const dir = new THREE.Vector3().subVectors(v2, v1);
      const len = dir.length();
      if (len > 1e-6) {
        dir.normalize();

        // Determine face normal (approximate based on dominant axis)
        let normal = new THREE.Vector3(0, 0, 1);
        if (Math.abs(dir.z) > 0.9) normal = new THREE.Vector3(1, 0, 0);
        else if (Math.abs(dir.y) > 0.9) normal = new THREE.Vector3(0, 0, 1);

        const side = new THREE.Vector3().crossVectors(dir, normal).normalize();
        if (side.length() < 0.5) {
          side.set(1, 0, 0).crossVectors(dir, side).normalize();
        }

        const halfKerf = ((op.cutterDiameterMm || op.kerfMm || DEFAULT_KERF_MM) * MM_TO_THREE) / 2;
        const offset = side.multiplyScalar(halfKerf);

        // Quad corners
        const pA = new THREE.Vector3().subVectors(v1, offset);
        const pB = new THREE.Vector3().addVectors(v1, offset);
        const pC = new THREE.Vector3().addVectors(v2, offset);
        const pD = new THREE.Vector3().subVectors(v2, offset);

        ribbonVertices.push(
          pA.x, pA.y, pA.z,
          pB.x, pB.y, pB.z,
          pC.x, pC.y, pC.z,
          pD.x, pD.y, pD.z
        );

        // Two triangles for the quad (0, 1, 2) and (0, 2, 3)
        ribbonIndices.push(
          vertexIndex, vertexIndex + 1, vertexIndex + 2,
          vertexIndex, vertexIndex + 2, vertexIndex + 3
        );
        vertexIndex += 4;
      }
    }
  }

  // 1. Rapid moves line segments (dashed amber)
  if (rapidPoints.length > 0) {
    const rapidGeom = new THREE.BufferGeometry().setFromPoints(rapidPoints);
    const rapidLines = new THREE.LineSegments(rapidGeom, materials.rapidMove);
    rapidLines.name = "camRapidTrajectories";
    if (typeof rapidLines.computeLineDistances === "function") {
      rapidLines.computeLineDistances();
    }
    group.add(rapidLines);
  }

  // 2. Cutting feed line segments: contour (cyan)
  if (feedPoints.length > 0) {
    const feedGeom = new THREE.BufferGeometry().setFromPoints(feedPoints);
    const feedLines = new THREE.LineSegments(feedGeom, materials.cutFeed);
    feedLines.name = "camCutFeedTrajectories";
    group.add(feedLines);
  }

  // 3. Groove slot line segments: groove (neon lime)
  if (groovePoints.length > 0) {
    const grooveGeom = new THREE.BufferGeometry().setFromPoints(groovePoints);
    const grooveLines = new THREE.LineSegments(grooveGeom, materials.cutFeedLime);
    grooveLines.name = "camGrooveTrajectories";
    group.add(grooveLines);
  }

  // 4. True Kerf Ribbon mesh
  if (ribbonVertices.length > 0) {
    const ribbonGeom = new THREE.BufferGeometry();
    ribbonGeom.setAttribute("position", new THREE.Float32BufferAttribute(ribbonVertices, 3));
    ribbonGeom.setIndex(ribbonIndices);
    ribbonGeom.computeVertexNormals();

    const ribbonMesh = new THREE.Mesh(ribbonGeom, materials.kerfRibbon);
    ribbonMesh.name = "camKerfRibbons";
    group.add(ribbonMesh);
  }

  return group;
}

/**
 * Generates default or fixture-based vacuum pods / clamps positioned
 * under a PartGraph panel or bed table.
 *
 * @param {object} partGraph
 * @param {object} [options]
 * @returns {Array<{ id: string, center: {x,y,z}, size: {x,y,z}, haloMm: number }>}
 */
export function generateDefaultVacuumClamps(partGraph, options = {}) {
  const haloMm = options.haloMm || EXCLUSION_HALO_MM;
  const clamps = [];

  const env = partGraph?.summary?.envelope || {
    widthDmm: 18000,
    heightDmm: 22000,
    depthDmm: 6000,
  };

  const w = env.widthDmm * DMM_TO_THREE;
  const d = env.depthDmm * DMM_TO_THREE;
  const floorY = -(env.heightDmm * DMM_TO_THREE) / 2;

  // Standard pod size: 140 mm x 115 mm x 50 mm
  const podW = 0.14;
  const podH = 0.05;
  const podD = 0.115;

  // Grid of 6 vacuum pods distributed along bottom floor
  const cols = 3;
  const rows = 2;

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const px = -w / 2 + (w / (cols + 1)) * (c + 1);
      const pz = -d / 2 + (d / (rows + 1)) * (r + 1);
      const py = floorY + podH / 2;

      clamps.push({
        id: `VAC_POD_${c + 1}_${r + 1}`,
        center: { x: px, y: py, z: pz },
        size: { x: podW, y: podH, z: podD },
        haloMm,
      });
    }
  }

  return clamps;
}

/**
 * Checks if a 3D line segment with kerf radius intersects a 3D AABB with exclusion halo.
 *
 * @param {{x,y,z}} p1
 * @param {{x,y,z}} p2
 * @param {number} kerfMm
 * @param {object} clamp
 * @returns {boolean}
 */
export function isToolpathCollidingWithClamp(p1, p2, kerfMm, clamp) {
  const kerfThree = (kerfMm / 2) * MM_TO_THREE;
  const haloThree = (clamp.haloMm || EXCLUSION_HALO_MM) * MM_TO_THREE;

  // Clamp bounding box expanded by (halo + kerf)
  const minX = clamp.center.x - clamp.size.x / 2 - haloThree - kerfThree;
  const maxX = clamp.center.x + clamp.size.x / 2 + haloThree + kerfThree;
  const minY = clamp.center.y - clamp.size.y / 2 - haloThree - kerfThree;
  const maxY = clamp.center.y + clamp.size.y / 2 + haloThree + kerfThree;
  const minZ = clamp.center.z - clamp.size.z / 2 - haloThree - kerfThree;
  const maxZ = clamp.center.z + clamp.size.z / 2 + haloThree + kerfThree;

  // Segment bounding box
  const segMinX = Math.min(p1.x, p2.x);
  const segMaxX = Math.max(p1.x, p2.x);
  const segMinY = Math.min(p1.y, p2.y);
  const segMaxY = Math.max(p1.y, p2.y);
  const segMinZ = Math.min(p1.z, p2.z);
  const segMaxZ = Math.max(p1.z, p2.z);

  // Broadphase AABB overlap
  if (segMaxX < minX || segMinX > maxX) return false;
  if (segMaxY < minY || segMinY > maxY) return false;
  if (segMaxZ < minZ || segMinZ > maxZ) return false;

  return true;
}

/**
 * Detects collisions between toolpath operations and vacuum clamp exclusion zones.
 *
 * @param {Array<object>} operations
 * @param {Array<object>} clamps
 * @returns {{ hasCollision: boolean, collisions: Array<{ clampId: string, opDescription: string }> }}
 */
export function detectClampCollisions(operations, clamps) {
  const collisions = [];

  for (const clamp of clamps) {
    for (const op of operations) {
      if (op.isCutting && isToolpathCollidingWithClamp(op.from, op.to, op.kerfMm || DEFAULT_KERF_MM, clamp)) {
        collisions.push({
          clampId: clamp.id,
          opDescription: op.description,
        });
      }
    }
  }

  return {
    hasCollision: collisions.length > 0,
    collisions,
  };
}

/**
 * Builds Three.js mesh group for vacuum pods and clamp exclusion halos.
 * Automatically switches to hazard warning red when toolpaths collide.
 *
 * @param {Array<object>} clamps
 * @param {object} [options]
 * @param {typeof THREE_MODULE} [THREE]
 * @returns {THREE.Group}
 */
export function buildVacuumClampExclusionMesh(clamps, options = {}, THREE = THREE_MODULE) {
  const group = new THREE.Group();
  group.name = "camVacuumClamps";

  const materials = options.materials || createCamMaterials(THREE);
  const collidingClampIds = new Set((options.collisions || []).map((c) => c.clampId));

  for (const clamp of clamps) {
    const isColliding = collidingClampIds.has(clamp.id);

    // 1. Inner solid pod
    const podGeom = new THREE.BoxGeometry(clamp.size.x, clamp.size.y, clamp.size.z);
    const podMesh = new THREE.Mesh(
      podGeom,
      isColliding ? materials.vacuumPodWarning : materials.vacuumPodSolid
    );
    podMesh.position.set(clamp.center.x, clamp.center.y, clamp.center.z);
    podMesh.name = `pod_${clamp.id}`;

    // 2. 15 mm exclusion halo wireframe box
    const haloThree = (clamp.haloMm || EXCLUSION_HALO_MM) * MM_TO_THREE * 2;
    const haloGeom = new THREE.BoxGeometry(
      clamp.size.x + haloThree,
      clamp.size.y + haloThree,
      clamp.size.z + haloThree
    );
    const haloMesh = new THREE.Mesh(
      haloGeom,
      isColliding ? materials.vacuumHaloWarning : materials.vacuumHaloSafe
    );
    haloMesh.position.set(clamp.center.x, clamp.center.y, clamp.center.z);
    haloMesh.name = `halo_${clamp.id}`;

    group.add(podMesh);
    group.add(haloMesh);
  }

  return group;
}

/**
 * Builds the dynamic toolhead / spindle mesh (inverted cone + collar).
 *
 * @param {number} [kerfMm]
 * @param {typeof THREE_MODULE} [THREE]
 * @returns {THREE.Group}
 */
export function buildToolheadMesh(kerfMm = DEFAULT_KERF_MM, THREE = THREE_MODULE) {
  const group = new THREE.Group();
  group.name = "camToolheadMesh";

  const materials = createCamMaterials(THREE);
  const radius = Math.max(0.003, (kerfMm * MM_TO_THREE) / 2);
  const coneHeight = 0.035; // 35 mm cutter length
  const spindleRadius = radius * 2.5;
  const spindleHeight = 0.045; // 45 mm spindle collar

  // Inverted cutter cone (tip at origin, pointing downwards)
  const coneGeom = new THREE.ConeGeometry(radius, coneHeight, 16);
  coneGeom.rotateX(Math.PI); // inverted tip downwards
  coneGeom.translate(0, coneHeight / 2, 0);

  const coneMesh = new THREE.Mesh(coneGeom, materials.toolheadCutter);
  coneMesh.name = "toolheadCone";
  group.add(coneMesh);

  // Spindle body above cutter
  const spindleGeom = new THREE.CylinderGeometry(spindleRadius, spindleRadius, spindleHeight, 16);
  spindleGeom.translate(0, coneHeight + spindleHeight / 2, 0);

  const spindleMesh = new THREE.Mesh(spindleGeom, materials.toolheadSpindle);
  spindleMesh.name = "toolheadSpindle";
  group.add(spindleMesh);

  return group;
}

/**
 * Creates and mounts the complete CAM overlay presentation group onto a Three.js scene.
 *
 * @param {object} params
 * @param {THREE.Scene} params.scene
 * @param {object} params.partGraph
 * @param {object} [params.options]
 * @param {typeof THREE_MODULE} [params.threeInstance]
 * @returns {object} Controller API for scrubbing and layer toggles
 */
export function createCamOverlay({ scene, partGraph, options = {}, threeInstance = THREE_MODULE }) {
  if (!scene) {
    throw new Error("createCamOverlay requires a Three.js scene.");
  }

  const THREE = threeInstance;

  // Remove existing overlay group if present
  const existing = scene.getObjectByName("camToolpathsGroup");
  if (existing) {
    scene.remove(existing);
  }

  const camGroup = new THREE.Group();
  camGroup.name = "camToolpathsGroup";

  // Center alignment: if partGraph has envelope, align with centered furniture group
  const env = partGraph?.summary?.envelope;
  if (env) {
    const envW = env.widthDmm * DMM_TO_THREE;
    const envH = env.heightDmm * DMM_TO_THREE;
    const envD = env.depthDmm * DMM_TO_THREE;
    camGroup.position.set(-envW / 2, -envH / 2, -envD / 2);
  }

  // 1. Gather all panel toolpaths (from neutral operations IR or direct part calculation)
  let allOperations = [];
  if (Array.isArray(options.operations)) {
    allOperations = options.operations;
  } else if (options.neutralIr) {
    allOperations = adaptNeutralOperationsToOverlay(options.neutralIr, partGraph, options);
  } else {
    const parts = partGraph?.parts || [];
    for (const part of parts) {
      const ops = generatePanelToolpaths(part, options);
      allOperations.push(...ops);
    }
  }

  // 2. Build default clamps
  const clamps = options.clamps || generateDefaultVacuumClamps(partGraph, options);

  // 3. Collision Detection
  const collisionResult = detectClampCollisions(allOperations, clamps);

  // 4. Build sub-meshes
  const trajectories = buildToolpathTrajectoryMesh(allOperations, options, THREE);
  const clampMesh = buildVacuumClampExclusionMesh(clamps, { collisions: collisionResult.collisions }, THREE);
  const toolhead = buildToolheadMesh(options.kerfMm, THREE);

  camGroup.add(trajectories);
  camGroup.add(clampMesh);
  camGroup.add(toolhead);

  scene.add(camGroup);

  // Scrubbing logic
  const updateSimulationStep = (t) => {
    const clampedT = Math.max(0, Math.min(1, Number(t) || 0));
    if (allOperations.length === 0) return { op: null, zDepthMm: 0 };

    const totalOps = allOperations.length;
    const activeOpIndex = Math.min(totalOps - 1, Math.floor(clampedT * totalOps));
    const activeOp = allOperations[activeOpIndex];

    const opProgress = (clampedT * totalOps) - activeOpIndex;
    const posX = activeOp.from.x + (activeOp.to.x - activeOp.from.x) * opProgress;
    const posY = activeOp.from.y + (activeOp.to.y - activeOp.from.y) * opProgress;
    const posZ = activeOp.from.z + (activeOp.to.z - activeOp.from.z) * opProgress;

    toolhead.position.set(posX, posY, posZ);

    // Dynamic pulsing of colliding vacuum clamp halos
    if (collisionResult && collisionResult.collisions && collisionResult.collisions.length > 0) {
      const pulseOpacity = 0.55 + Math.sin(Date.now() * 0.008) * 0.35; // pulses between 0.2 and 0.9
      for (const coll of collisionResult.collisions) {
        const halo = clampMesh.getObjectByName(`halo_${coll.clampId}`);
        if (halo && halo.material) {
          halo.material.opacity = pulseOpacity;
          halo.material.transparent = true;
          halo.material.needsUpdate = true;
        }
      }
    }

    return {
      activeOp,
      opIndex: activeOpIndex + 1,
      totalOps,
      coords: { xMm: posX / MM_TO_THREE, yMm: posY / MM_TO_THREE, zMm: posZ / MM_TO_THREE },
      zDepthMm: activeOp.zDepthMm,
    };
  };

  // Initial step at t = 0
  updateSimulationStep(0);

  // Visibility toggle handler
  const setLayersVisibility = ({ cutVectors = true, rapidTrajectories = true, vacuumPods = true, kerfRibbon = true, grooves = true }) => {
    const cutMesh = camGroup.getObjectByName("camCutFeedTrajectories");
    const rapidMesh = camGroup.getObjectByName("camRapidTrajectories");
    const grooveMesh = camGroup.getObjectByName("camGrooveTrajectories");
    const ribbonMesh = camGroup.getObjectByName("camKerfRibbons");
    const podMesh = camGroup.getObjectByName("camVacuumClamps");

    if (cutMesh) cutMesh.visible = !!cutVectors;
    if (rapidMesh) rapidMesh.visible = !!rapidTrajectories;
    if (grooveMesh) grooveMesh.visible = !!grooves;
    if (ribbonMesh) ribbonMesh.visible = !!kerfRibbon;
    if (podMesh) podMesh.visible = !!vacuumPods;
  };

  const dispose = () => {
    scene.remove(camGroup);
    camGroup.traverse((obj) => {
      if (obj.geometry && typeof obj.geometry.dispose === "function") {
        obj.geometry.dispose();
      }
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m && m.dispose && m.dispose());
        } else if (typeof obj.material.dispose === "function") {
          obj.material.dispose();
        }
      }
    });
  };

  return {
    camGroup,
    operations: allOperations,
    clamps,
    collisions: collisionResult,
    updateSimulationStep,
    setLayersVisibility,
    dispose,
  };
}

/**
 * React Component Wrapper for CAM Overlay Presentation Layer.
 */
export default function CamOverlayLayer({
  scene,
  partGraph,
  currentT = 0,
  kerfMm = DEFAULT_KERF_MM,
  visibleLayers = { cutVectors: true, rapidTrajectories: true, vacuumPods: true, kerfRibbon: true },
  onCollisionChange,
  onStepChange,
  threeInstance = THREE_MODULE,
}) {
  const controllerRef = useRef(null);

  useEffect(() => {
    if (!scene || !partGraph) return;

    const ctrl = createCamOverlay({
      scene,
      partGraph,
      options: { kerfMm },
      threeInstance,
    });
    controllerRef.current = ctrl;

    if (onCollisionChange) {
      onCollisionChange(ctrl.collisions);
    }

    return () => {
      ctrl.dispose();
      controllerRef.current = null;
    };
  }, [scene, partGraph, kerfMm, threeInstance]);

  // Handle Scrubbing
  useEffect(() => {
    if (controllerRef.current) {
      const stepInfo = controllerRef.current.updateSimulationStep(currentT);
      if (onStepChange) {
        onStepChange(stepInfo);
      }
    }
  }, [currentT]);

  // Handle Visibility Layer Toggles
  useEffect(() => {
    if (controllerRef.current) {
      controllerRef.current.setLayersVisibility(visibleLayers);
    }
  }, [visibleLayers]);

  return null;
}
