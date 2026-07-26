import json
import os
import tempfile
import unittest

import ezdxf

import audit_dxf
import factory_test
import furniai
import inspector
import pack_check


class ProductionSafetyContractTests(unittest.TestCase):
    def test_software_pass_does_not_claim_manufacturing_release(self):
        result = inspector.inspect(factory_test.TEST_UNIT)
        self.assertEqual(result.verdict, "ENGINEERING CHECKS PASSED")
        self.assertFalse(result.failures)

    def test_generated_report_blocks_manufacturing_release(self):
        with tempfile.TemporaryDirectory() as out:
            report = furniai.run(factory_test.TEST_UNIT, out)
            self.assertEqual(report["verdict"], "ENGINEERING CHECKS PASSED")
            self.assertEqual(
                report["manufacturing_release"]["status"],
                "FACTORY_QUALIFICATION_REQUIRED",
            )
            self.assertFalse(report["manufacturing_release"]["allowed"])

    def test_calibration_coupon_uses_shallow_hinge_dowel_layer(self):
        with tempfile.TemporaryDirectory() as out:
            path = factory_test.build_coupon(os.path.join(out, "coupon.dxf"))
            layers = [
                entity.dxf.layer
                for entity in ezdxf.readfile(path).modelspace()
                if entity.dxftype() == "CIRCLE"
            ]
            self.assertIn("DRILL_8_13", layers)
            self.assertNotIn("DRILL_8_24", layers)

    def test_auditor_reconstructs_the_pack_input(self):
        spec = dict(furniai.DEMOS["vanity"])
        with tempfile.TemporaryDirectory() as out:
            furniai.run(spec, out)
            with open(os.path.join(out, "report.json"), encoding="utf-8") as fh:
                saved_spec = json.load(fh)["input"]
            import planner
            import engine

            units = [engine.build(item) for item in planner.plan(saved_spec)]
            _, _, part_problems = audit_dxf.audit(out, units)
            _, nest_problems = audit_dxf.audit_nest(out)
            self.assertEqual(part_problems + nest_problems, [])

    def test_pack_checker_reads_pdf_without_external_pdftotext(self):
        with tempfile.TemporaryDirectory() as out:
            furniai.run(factory_test.TEST_UNIT, out)
            _, ok, _ = pack_check.check(out)
            self.assertTrue(ok)


if __name__ == "__main__":
    unittest.main()
