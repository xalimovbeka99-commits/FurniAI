"""
FurniAI - Manufacturing Standards Constants
============================================
Single source of truth for every number the geometry engine uses.
All dimensions in MILLIMETRES unless stated. Currency AED.

Sources cited in FURNIAI_ENGINEERING_KNOWLEDGE_BASE.md.
Nothing in the engine may hard-code a dimension; it must come from here.
"""

# ---------------------------------------------------------------------------
# SYSTEM 32 - the backbone of frameless / European cabinetmaking
# ---------------------------------------------------------------------------
SYS32 = {
    "pitch": 32.0,            # centre-to-centre of the line-boring row
    "hole_dia": 5.0,          # shelf-pin / system hole diameter
    "hole_depth": 12.0,       # 12-14mm into an 18mm panel
    "front_setback": 37.0,    # front row: centre 37mm from FRONT edge
    "rear_setback": 37.0,     # rear row: centre 37mm from REAR edge
    "min_end_margin": 64.0,   # first/last hole >= 2 pitches from panel end
    "shelf_pin_len": 16.0,
}

# ---------------------------------------------------------------------------
# PANEL MATERIALS
# ---------------------------------------------------------------------------
PANEL = {
    "carcass": 18.0,
    "shelf": 18.0,
    "door": 18.0,
    "back": 6.0,
    "drawer_side": 16.0,
    "drawer_bottom": 6.0,
    "mirror_overlay": 5.0,
    "glass_door": 5.0,
}

SHEET = {
    "mdf_2800": (2800.0, 2070.0),
    "mdf_2440": (2440.0, 1220.0),
    "default": (2800.0, 2070.0),
    "kerf": 4.0,
    "trim": 10.0,
    "waste_allowance": 0.10,
}

EDGEBAND = {"thickness": 2.0, "thin": 0.8}

# ---------------------------------------------------------------------------
# JOINERY / CARCASS CONSTRUCTION
# ---------------------------------------------------------------------------
CARCASS = {
    # sides_full  = sides run full height, top+bottom captured between them
    # topbot_full = top/bottom run full width, sides captured
    "default_style": "sides_full",
    "back_groove_width": 6.0,
    "back_groove_depth": 10.0,
    "back_groove_setback": 12.0,
    "shelf_side_clearance": 2.0,
    "shelf_front_setback": 8.0,
    "confirmat_dia": 7.0,
    "confirmat_pilot": 4.5,
    "confirmat_pitch_max": 250.0,
    "confirmat_end_offset": 50.0,
    "dowel_dia": 8.0,
    "dowel_depth": 24.0,
    "stretcher_width": 100.0,
}

# ---------------------------------------------------------------------------
# FRONTS - hinged doors & drawer faces (full overlay, frameless)
# ---------------------------------------------------------------------------
FRONTS = {
    "gap": 3.0,
    "edge_reveal": 1.5,
    "bottom_reveal": 1.5,
    "top_reveal": 1.5,
    "max_hinged_door_width": 600.0,
    "max_hinged_door_height": 2400.0,
    "max_door_area_m2": 1.4,
}

# ---------------------------------------------------------------------------
# HINGES - Blum CLIP top BLUMOTION geometry
# ---------------------------------------------------------------------------
HINGE = {
    "cup_dia": 35.0,
    "cup_depth": 12.5,
    "boring_distance_K": 5.0,
    "cup_centre_from_edge": 22.5,      # 35/2 + K
    "cup_screw_dia": 8.0,
    "cup_screw_pitch": 45.0,
    "first_from_end": 96.0,            # 3 x 32 -> lands on the System-32 grid
    "plate_setback": 37.0,
    "plate_screw_dia": 5.0,
    "opening_angle": 110.0,
    "count_by_height": [(900, 2), (1600, 3), (2000, 4), (2400, 5), (2800, 6)],
    "min_door_thickness": 15.0,
    "max_door_thickness": 24.0,
}

# ---------------------------------------------------------------------------
# DRAWERS
# ---------------------------------------------------------------------------
DRAWER = {
    "undermount_side_clearance_total": 10.0,   # box outside = opening - 10
    "undermount_top_clearance": 7.0,
    "undermount_bottom_clearance": 14.0,
    "sidemount_side_clearance_total": 26.0,
    "sidemount_top_clearance": 8.0,
    "sidemount_bottom_clearance": 8.0,
    "bottom_groove_width": 6.0,
    "bottom_groove_depth": 8.0,
    "bottom_groove_from_edge": 12.0,
    "box_rear_clearance": 15.0,
    "slide_lengths": [270, 300, 350, 400, 450, 500, 550],
    "standard_box_heights": [86, 100, 125, 150, 180, 200, 224],
    "face_to_box_gap": 1.0,
    "min_face_height": 100.0,
    "runner_screw_row_setback": 37.0,
}

# ---------------------------------------------------------------------------
# SLIDING DOORS (wardrobes)
# ---------------------------------------------------------------------------
SLIDING = {
    "min_overlap": 25.0,
    "default_overlap": 40.0,
    "top_track_height": 40.0,
    "bottom_track_height": 20.0,
    "door_height_deduction": 45.0,
    "track_depth_2door": 80.0,
    "track_depth_3door": 120.0,
    "min_opening_2door": 1000.0,
    "max_door_width": 1200.0,
    "frame_profile": "6063-T5 anodised aluminium",
    "carcass_depth_penalty": 100.0,
}

# ---------------------------------------------------------------------------
# ERGONOMIC / DIMENSIONAL STANDARDS
# ---------------------------------------------------------------------------
ERGO = {
    "wardrobe": {
        "long_hang_min": 1600, "long_hang_max": 1700,
        "short_hang_min": 950, "short_hang_max": 1100,
        "double_hang_min_internal": 2000,
        "min_internal_depth_hanging": 530,
        "ideal_internal_depth_hanging": 560,
        "shelf_spacing_folded": (280, 350),
        "top_drawer_max_height": 1250,
        "daily_reach_max": 1850,
    },
    "kitchen": {
        "worktop_height": (850, 950), "worktop_height_uae": 900,
        "base_carcass_height": 720,
        "toe_kick_height": 150, "toe_kick_setback": 50,
        "worktop_thickness": (20, 40),
        "base_depth": 560, "base_depth_max": 600,
        "wall_depth": 320, "wall_depth_max": 350,
        "wall_underside_from_floor": (1400, 1500),
        "worktop_to_wall_unit": (500, 600),
        "tall_height": (1825, 2150),
        "hob_side_clearance": 300,
        "hob_to_extractor": 650,
        "landing_zone": 300,
        "walkway_single": 1000, "walkway_galley": 1200,
        "work_triangle_leg": (1200, 2700), "work_triangle_total_max": 6500,
    },
    "vanity": {
        "height_with_top": (800, 900),
        "carcass_height": 720,
        "depth": (450, 550),
        "mirror_centre_from_floor": (1500, 1650),
        "basin_clearance_below": 250,
    },
    "dressing_table": {
        "top_height": (720, 760),
        "knee_clearance": 580,
        "mirror_centre": (1100, 1200),
    },
    "universal": {
        "handle_zone": (900, 1100),
        "facing_drawers_min_gap": 1100,
        "hinged_door_swing_clearance": 900,
        "sliding_door_clearance": 600,
    },
}

# ---------------------------------------------------------------------------
# STRUCTURAL - shelf clear-span limits (deflection <= L/200 at 40 kg/m2)
# ---------------------------------------------------------------------------
SHELF_SPAN = {
    "mdf":       {16: 700, 18: 800, 25: 1000},
    "chipboard": {16: 650, 18: 750, 25: 950},
    "plywood":   {16: 800, 18: 900, 25: 1150},
    "solid":     {18: 950, 25: 1200},
    "glass":     {6: 600,  8: 800,  10: 1000},
    "heavy_duty_factor": 0.75,
}

# ---------------------------------------------------------------------------
# TOLERANCES & QC
# ---------------------------------------------------------------------------
TOLERANCE = {
    "panel_cut": 0.5,
    "drilling_position": 0.3,
    "carcass_squareness": 1.0,
    "door_gap_variation": 0.5,
    "level_over_1m": 1.0,
    "scribe_allowance": 20.0,
}

# ---------------------------------------------------------------------------
# LOGISTICS (UAE)
# ---------------------------------------------------------------------------
LOGISTICS = {
    "max_panel_elevator": 2400.0,
    "max_panel_stairs": 2200.0,
    "max_single_person_kg": 25.0,
    "max_two_person_kg": 60.0,
    "van_bed_length": 3000.0,
    "density_kg_m3": {"mdf": 750, "chipboard": 660, "plywood": 600, "hdf": 850},
    "long_run_expansion_gap": 3.0,
    "long_run_threshold": 2400.0,
}

# ---------------------------------------------------------------------------
# CNC - BAZIS-Mebelshik compatible DXF layer conventions
# ---------------------------------------------------------------------------
CNC_LAYERS = {
    "outline":     {"name": "CONTOUR",     "color": 7,  "desc": "Part outline, cut through"},
    "inner":       {"name": "CONTOUR_IN",  "color": 1,  "desc": "Internal cut-outs"},
    "drill_5_12":  {"name": "DRILL_5_12",  "color": 3,  "desc": "5mm dia x 12mm deep (System 32)"},
    "drill_8_24":  {"name": "DRILL_8_24",  "color": 4,  "desc": "8mm dia x 24mm deep (dowel)"},
    "drill_8_13":  {"name": "DRILL_8_13",  "color": 14, "desc": "8mm dia x 13mm deep (hinge cup dowel)"},
    "drill_35_13": {"name": "DRILL_35_13", "color": 5,  "desc": "35mm dia x 12.5mm (hinge cup)"},
    "drill_thru":  {"name": "DRILL_THRU",  "color": 6,  "desc": "Through holes"},
    "groove":      {"name": "GROOVE_6_10", "color": 2,  "desc": "6mm wide x 10mm deep groove"},
    "rebate":      {"name": "REBATE",      "color": 30, "desc": "Rebate / rabbet"},
    "pocket":      {"name": "POCKET",      "color": 8,  "desc": "Pocket / recess"},
    "label":       {"name": "LABEL",       "color": 9,  "desc": "Part ID text"},
    "dim":         {"name": "DIM",         "color": 9,  "desc": "Dimensions, reference only"},
}

# ---------------------------------------------------------------------------
# COMMERCIAL - FurniAI UAE pricing model
# ---------------------------------------------------------------------------
MATERIALS = {
    "oak":       {"label": "Oak",       "aed_m2": 180, "tier": "premium",  "base": "mdf", "grained": True, "hex": "#B08D57"},
    "walnut":    {"label": "Walnut",    "aed_m2": 240, "tier": "premium",  "base": "mdf", "grained": True, "hex": "#5C4033"},
    "mahogany":  {"label": "Mahogany",  "aed_m2": 260, "tier": "premium",  "base": "mdf", "grained": True, "hex": "#7B3F31"},
    "dark_wood": {"label": "Dark Wood", "aed_m2": 200, "tier": "premium",  "base": "mdf", "grained": True, "hex": "#3E2B23"},
    "white":     {"label": "White MDF", "aed_m2": 95,  "tier": "standard", "base": "mdf", "grained": False, "hex": "#F2F1ED"},
    "black":     {"label": "Black MDF", "aed_m2": 100, "tier": "standard", "base": "mdf", "grained": False, "hex": "#1E1E1E"},
    "beige":     {"label": "Beige",     "aed_m2": 95,  "tier": "standard", "base": "mdf", "grained": False, "hex": "#D8CEBB"},
    "graphite":  {"label": "Graphite",  "aed_m2": 110, "tier": "standard", "base": "mdf", "grained": False, "hex": "#4A4E54"},
    "sage":      {"label": "Sage",      "aed_m2": 110, "tier": "standard", "base": "mdf", "grained": False, "hex": "#9CAE94"},
    "navy":      {"label": "Navy",      "aed_m2": 110, "tier": "standard", "base": "mdf", "grained": False, "hex": "#2A3B55"},
    "concrete":  {"label": "Concrete",  "aed_m2": 130, "tier": "standard", "base": "mdf", "grained": False, "hex": "#9A9A94"},
    "linen":     {"label": "Linen",     "aed_m2": 140, "tier": "standard", "base": "mdf", "grained": False, "hex": "#E3DCCB"},
}
DEFAULT_MATERIAL = "oak"
BACK_MATERIAL = "white"      # 6mm white HDF back - never the face material
DRAWER_BOX_MATERIAL = "white"

HARDWARE_COST = {
    "hinge_softclose": 12.0,
    "drawer_slide_pair": 28.0,
    "hanger_rod_m": 35.0,
    "confirmat_set_m2": 6.0,
    "adjustable_leg": 9.0,
    "shelf_pin": 0.5,
    "sliding_gear_per_door": 145.0,
    "handle": {"gold_bar": 22, "silver_knob": 8, "black_strip": 14,
               "hidden_push": 0, "chrome": 16, "none": 0},
    "door_surcharge": {"solid_panel": 0, "glass_panel": 65,
                       "full_mirror": 90, "frosted_glass": 75},
    "led": {"off": 0, "warm": 120, "cool": 120, "rgb": 180},
    "edgeband_m": 2.5,
}

TYPE_DEFAULTS = {
    "wardrobe":       {"whd": (2400, 2800, 600), "labor": 200, "complexity": 1.3},
    "wardrobe_slide": {"whd": (2400, 2800, 650), "labor": 240, "complexity": 1.4},
    "kitchen_base":   {"whd": (900,   720, 560), "labor": 220, "complexity": 1.5},
    "kitchen_wall":   {"whd": (900,   720, 320), "labor": 180, "complexity": 1.3},
    "kitchen_tall":   {"whd": (600,  2100, 560), "labor": 300, "complexity": 1.7},
    "kitchen":        {"whd": (3000, 2200, 600), "labor": 450, "complexity": 1.8},
    "vanity":         {"whd": (900,   720, 480), "labor": 200, "complexity": 1.4},
    "cabinet":        {"whd": (1000, 1800, 450), "labor": 150, "complexity": 1.2},
    "console":        {"whd": (1400,  800, 400), "labor": 170, "complexity": 1.2},
    "shelving":       {"whd": (1200, 2000, 350), "labor": 120, "complexity": 1.0},
    "dressing_table": {"whd": (1200, 1400, 450), "labor": 170, "complexity": 1.2},
}

# Bounding-box panel factors for the fast estimate. MEASURED, not assumed -
# see verify.py section 9. Re-run it after any change to the layout logic.
PANEL_FACTOR = {
    "wardrobe": 1.83,
    "wardrobe_slide": 1.83,
    "kitchen_base": 1.82,
    "kitchen_wall": 1.24,
    "kitchen_tall": 1.46,
    "vanity": 1.02,
    "shelving": 0.93,
    "cabinet": 1.16,
    "console": 1.42,
    "dressing_table": 1.26,
    "kitchen": 1.39,
}

MARGIN = 0.35
DELIVERY = {"dubai": 50, "abu_dhabi": 70, "sharjah": 60,
            "ajman": 65, "other_uae": 90, "pickup": 0}
DEFAULT_ZONE = "dubai"

UAE_RULES = {
    "moisture_resistant_required": ["kitchen_base", "kitchen_wall", "kitchen_tall",
                                    "kitchen", "vanity"],
    "note_mr": "Use MR-MDF (green core) in all wet/humid zones - UAE coastal humidity.",
}
