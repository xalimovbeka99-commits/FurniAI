#!/usr/bin/env node

/**
 * scripts/demo-golden-wardrobe.mjs
 * ---------------------------------------------------------------------
 * Demonstrates the canonical FurniSpec v0.1 Golden Wardrobe specification,
 * performs validation and exact arithmetic checks, and prints the report.
 */

import fixture from "../src/lib/furnispec/goldenWardrobe.fixture.json" with { type: "json" };
import { formatGoldenReport } from "../src/lib/furnispec/formatGoldenReport.js";

const report = formatGoldenReport(fixture);
console.log(report.text);

if (report.verdict !== "PASS") {
  process.exit(1);
}
