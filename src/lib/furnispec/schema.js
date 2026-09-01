/**
 * FurniSpec v0.1 — Schema & Constants Definition
 * ---------------------------------------------------------------------
 * Authoritative schema constants and enumerations for the canonical
 * FurniSpec v0.1 specification format (Gate G2.1).
 */

export const FURNISPEC_SCHEMA_VERSION = "furnispec/0.1";

export const FURNITURE_TYPES = Object.freeze({
  WARDROBE: "wardrobe",
});

export const WARDROBE_TYPES = Object.freeze({
  STRAIGHT_HINGED: "straight_hinged",
});

export const CONSTRUCTION_STYLES = Object.freeze({
  CAP_STYLE: "CAP_STYLE", // Style B: Top/bottom cap outer sides
  FULL_HEIGHT_SIDES: "FULL_HEIGHT_SIDES", // Style A: Sides run full height
});

export const FINISH_TYPES = Object.freeze({
  MELAMINE: "melamine",
  PAINTED: "painted",
  VENEER: "veneer",
});

export const SPEC_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  PROPOSED: "PROPOSED",
  APPROVED: "APPROVED",
});

export const QUALIFICATION_STATUS = Object.freeze({
  WORKSHOP_REVIEW_NOT_CNC_QUALIFIED: "WORKSHOP_REVIEW_NOT_CNC_QUALIFIED",
  CNC_QUALIFIED: "CNC_QUALIFIED", // Blocked until Gate G8 physical coupon
});

export const HARDWARE_APPROVAL_STATUS = Object.freeze({
  APPROVED: "APPROVED",
  BLOCKED_PENDING_HARDWARE_APPROVAL: "BLOCKED_PENDING_HARDWARE_APPROVAL",
  PREVIEW_ONLY: "PREVIEW_ONLY",
});

export const MACHINING_POLICY = Object.freeze({
  APPROVED: "APPROVED",
  BLOCKED_PENDING_HARDWARE_APPROVAL: "BLOCKED_PENDING_HARDWARE_APPROVAL",
});

export const COMPONENT_TYPES = Object.freeze({
  SHELF_FIXED: "SHELF_FIXED",
  SHELF_ADJUSTABLE: "SHELF_ADJUSTABLE",
  HANGING_RAIL_LONG: "HANGING_RAIL_LONG",
  HANGING_RAIL_SHORT: "HANGING_RAIL_SHORT",
  DRAWER_BANK: "DRAWER_BANK",
});

export const SIDE_INSET_STATUS = Object.freeze({
  ASSUMPTION_PENDING_BEKZOD_APPROVAL: "ASSUMPTION_PENDING_BEKZOD_APPROVAL",
  BEKZOD_APPROVED: "BEKZOD_APPROVED",
});
