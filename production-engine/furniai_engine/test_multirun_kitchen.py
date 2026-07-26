from __future__ import annotations

import copy
import tempfile
import unittest
from pathlib import Path

import buildid
import engine
import exporters
import furniai
import inspector
import pack_check
import planner


HERE = Path(__file__).resolve().parent


def l_kitchen():
    return copy.deepcopy(furniai.DEMOS["kitchen_l"])


class MultiRunKitchenTests(unittest.TestCase):
    def test_l_shape_has_exact_world_envelope_and_perpendicular_run(self):
        spec = l_kitchen()
        unit_specs = planner.plan(spec)
        units = [engine.build(unit_spec) for unit_spec in unit_specs]
        scene = exporters.scene_json(units)

        self.assertEqual(planner.expected_envelope(spec), [3560, 2220, 1800])
        self.assertEqual(scene["bbox"], [3560.0, 2220.0, 1800.0])
        self.assertEqual(
            {unit.spec["_stack_rot_deg"] for unit in units
             if unit.spec.get("_run_id") == "b"},
            {90},
        )

    def test_only_corner_modules_are_blind_and_need_factory_selection(self):
        units = [engine.build(unit_spec) for unit_spec in planner.plan(l_kitchen())]
        corner_units = [unit for unit in units if unit.spec.get("_corner_role")]
        corner_warnings = [
            issue
            for unit in units
            for issue in unit.issues
            if issue["code"] == "BLIND_CORNER"
        ]

        self.assertEqual(len(corner_units), 4)
        self.assertEqual(len(corner_warnings), 4)
        for unit in corner_units:
            bay = unit.spec["bays"][unit.spec["_blind_corner_bay_index"]]
            self.assertEqual(bay["front"]["kind"], "none")
            self.assertTrue(
                all(module["front"]["kind"] == "none"
                    for module in bay.get("modules", []))
            )

    def test_inspector_passes_geometry_but_keeps_blind_corner_warning(self):
        report = inspector.inspect(l_kitchen())

        self.assertEqual(report.verdict, "ENGINEERING CHECKS PASSED")
        self.assertFalse(report.failures)
        self.assertTrue(
            any(check.name == "BLIND_CORNER" for check in report.warnings)
        )

    def test_pack_uses_run_dimensions_and_is_internally_consistent(self):
        with tempfile.TemporaryDirectory(dir=HERE) as directory:
            report = furniai.run(l_kitchen(), directory)
            build, ok, _lines = pack_check.check(directory)

        self.assertTrue(ok)
        self.assertEqual(build, report["build_id"])
        self.assertEqual(report["overall_envelope"], [3560.0, 2220.0, 1800.0])
        self.assertIn("RUNS 3000+1800mm", report["stamp"])
        self.assertFalse(report["manufacturing_release"]["allowed"])

    def test_straight_composite_kitchen_uses_planned_carcass_envelope(self):
        spec = {
            "name": "Straight Kitchen",
            "unit_id": "KS",
            "type": "kitchen",
            "width": 3000,
            "height": 2400,
            "depth": 600,
            "material": "sage",
            "handle": "black_strip",
            "zone": "dubai",
        }

        self.assertEqual(planner.expected_envelope(spec), [3000, 2220, 560])
        self.assertEqual(inspector.inspect(spec).verdict,
                         "ENGINEERING CHECKS PASSED")

    def test_unsupported_or_ambiguous_corner_geometry_is_rejected(self):
        spec = l_kitchen()
        spec["runs"].append({"length": 1200, "corner": "start"})
        with self.assertRaisesRegex(ValueError, "U-shape"):
            planner.plan(spec)

        spec = l_kitchen()
        spec["runs"][1]["corner"] = "end"
        with self.assertRaisesRegex(ValueError, "corner must be 'start'"):
            planner.plan(spec)

    def test_build_stamp_never_invents_zero_dimensions(self):
        label = buildid.stamp(l_kitchen())
        self.assertIn("RUNS 3000+1800mm", label)
        self.assertNotIn("0x0x0", label)


if __name__ == "__main__":
    unittest.main()
