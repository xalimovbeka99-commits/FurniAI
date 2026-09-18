/**
 * PartGraph v0.1 — Schema & Constants Definition
 * ---------------------------------------------------------------------
 * Authoritative constants and enumerations for the canonical structural
 * PartGraph format (Gate G2.2).
 */

export const PARTGRAPH_VERSION = "partgraph/0.1";

export const PART_ROLES = Object.freeze({
  TOP_PANEL: "TOP_PANEL",
  BOTTOM_PANEL: "BOTTOM_PANEL",
  SIDE_PANEL_LEFT: "SIDE_PANEL_LEFT",
  SIDE_PANEL_RIGHT: "SIDE_PANEL_RIGHT",
  DIVIDER_PANEL: "DIVIDER_PANEL",
  FIXED_SHELF: "FIXED_SHELF",
  ADJUSTABLE_SHELF: "ADJUSTABLE_SHELF",
  BACK_PANEL: "BACK_PANEL",
  DOOR_PANEL: "DOOR_PANEL",
  PLINTH_FRONT_FASCIA: "PLINTH_FRONT_FASCIA",
  PLINTH_REAR_RAIL: "PLINTH_REAR_RAIL",
  PLINTH_SIDE_RETURN_LEFT: "PLINTH_SIDE_RETURN_LEFT",
  PLINTH_SIDE_RETURN_RIGHT: "PLINTH_SIDE_RETURN_RIGHT",
  PLINTH_CROSS_STRETCHER: "PLINTH_CROSS_STRETCHER",

  // Drawer pack. Added when the 2026-09-15 ruling named the runner family
  // (UNDERMOUNT_CONCEALED_21MM) and its 21.0mm total width deduction, which
  // is what previously held DRAWER_BANK unrepresentable.
  //
  // There is deliberately no DRAWER_BOX_FRONT: in this decomposition the
  // drawer front IS the front of the box, so a row is one front plus two
  // sides, a back and a bottom.
  DRAWER_FRONT: "DRAWER_FRONT",
  DRAWER_SIDE_L: "DRAWER_SIDE_L",
  DRAWER_SIDE_R: "DRAWER_SIDE_R",
  DRAWER_BACK: "DRAWER_BACK",
  DRAWER_BOTTOM: "DRAWER_BOTTOM",
});

export const GEOMETRY_TYPES = Object.freeze({
  RECTANGULAR_PANEL: "RECTANGULAR_PANEL",
});

export const GRAIN_DIRECTIONS = Object.freeze({
  LENGTH: "LENGTH",
  WIDTH: "WIDTH",
  NONE: "NONE",
});

export const ORIENTATIONS = Object.freeze({
  HORIZONTAL_XZ: "HORIZONTAL_XZ", // Panels flat on XZ plane (Top, Bottom, Shelves)
  VERTICAL_YZ: "VERTICAL_YZ",       // Panels vertical on YZ plane (Sides, Dividers, Plinth Side Returns)
  VERTICAL_XY: "VERTICAL_XY",       // Panels facing front on XY plane (Doors, Back, Plinth Front/Rear)
});
