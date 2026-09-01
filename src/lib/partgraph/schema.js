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
