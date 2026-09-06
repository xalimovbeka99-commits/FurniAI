/**
 * FurniAI — Approved Material Catalog v0.1 (Gate G4 / AI-Alpha)
 * ---------------------------------------------------------------------
 * Material records approved by Bekzod through the Golden Wardrobe fixture.
 * A finish with no record here is a BLOCKING clarification gap, never a
 * substituted "nearest" material.
 */

import { RULE_PROVENANCE } from "./wardrobeRuleCatalog.js";

export const MATERIAL_CATALOG = Object.freeze({
  melamine: Object.freeze({
    provenance: RULE_PROVENANCE.GOLDEN_FIXTURE_BEKZOD_APPROVED,
    sourceId: "GF-MATERIALS",
    carcass: Object.freeze({ code: "MEL_WHITE_18", name: "18mm White Melamine Particleboard", thicknessMm: 18.0 }),
    backPanel: Object.freeze({ code: "HDF_WHITE_6", name: "6mm White HDF Backer", thicknessMm: 6.0 }),
    fronts: Object.freeze({ code: "MEL_WHITE_18", name: "18mm White Melamine Particleboard", thicknessMm: 18.0 }),
  }),
});

export function hasApprovedMaterials(finishType) {
  return Object.prototype.hasOwnProperty.call(MATERIAL_CATALOG, finishType);
}

export function materialsFor(finishType) {
  if (!hasApprovedMaterials(finishType)) {
    const err = new Error(`No Bekzod-approved material record for finish "${finishType}".`);
    err.code = "UNAPPROVED_MATERIAL";
    throw err;
  }
  const entry = MATERIAL_CATALOG[finishType];
  return {
    carcass: { ...entry.carcass },
    backPanel: { ...entry.backPanel },
    fronts: { ...entry.fronts },
  };
}
