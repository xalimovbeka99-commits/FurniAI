from __future__ import annotations

import importlib.util
import io
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE_SPEC = importlib.util.spec_from_file_location(
    "furniai_production_api",
    ROOT / "api" / "production.py",
)
production_api = importlib.util.module_from_spec(MODULE_SPEC)
assert MODULE_SPEC.loader is not None
MODULE_SPEC.loader.exec_module(production_api)


def wardrobe_payload():
    return {
        "project_id": "FA-TEST",
        "revision_id": "FA-TEST-R1",
        "zone": "Dubai",
        "config": {
            "name": "Glass Wardrobe",
            "type": "wardrobe",
            "sections": 4,
            "drawers": 3,
            "shelves": 4,
            "doorType": "glass",
            "mat": "oak",
            "handle": "gold",
            "led": "warm",
            "w": 240,
            "h": 240,
            "d": 60,
        },
    }


class ProductionBridgeTests(unittest.TestCase):
    def test_translates_frontend_centimetres_and_structure(self):
        spec = production_api.frontend_config_to_spec(wardrobe_payload())
        self.assertEqual((spec["width"], spec["height"], spec["depth"]), (2400, 2400, 600))
        self.assertEqual(spec["type"], "wardrobe")
        self.assertEqual(spec["material"], "oak")
        self.assertEqual(spec["handle"], "gold_bar")
        self.assertEqual(len(spec["bays"]), 4)
        self.assertEqual(spec["bays"][0]["modules"][0]["rows"], 3)
        self.assertEqual(
            spec["bays"][1]["modules"][0]["front"]["style"],
            "glass_panel",
        )

    def test_rejects_corner_geometry_instead_of_flattening_it(self):
        payload = wardrobe_payload()
        payload["config"]["type"] = "kitchen_l"
        with self.assertRaises(production_api.ProductionRequestError) as raised:
            production_api.frontend_config_to_spec(payload)
        self.assertEqual(
            raised.exception.code,
            "PRODUCTION_GEOMETRY_NOT_SUPPORTED",
        )

    def test_builds_review_pack_but_never_factory_releases_it(self):
        report, packed = production_api.build_factory_review_pack(wardrobe_payload())
        self.assertEqual(report["verdict"], "ENGINEERING CHECKS PASSED")
        self.assertFalse(report["manufacturing_release"]["allowed"])
        self.assertEqual(
            report["manufacturing_release"]["status"],
            "FACTORY_QUALIFICATION_REQUIRED",
        )
        with zipfile.ZipFile(io.BytesIO(packed)) as archive:
            names = archive.namelist()
        self.assertTrue(any(name.endswith("/shop_drawings.pdf") for name in names))
        self.assertTrue(any(name.endswith("/cutlist.csv") for name in names))
        self.assertTrue(any(name.endswith("/FACTORY_RELEASE_REQUIRED.txt") for name in names))


if __name__ == "__main__":
    unittest.main()
