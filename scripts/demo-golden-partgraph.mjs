#!/usr/bin/env node

/**
 * scripts/demo-golden-partgraph.mjs
 * ---------------------------------------------------------------------
 * Generates the canonical structural PartGraph from the Golden FurniSpec
 * v0.1 fixture, validates all 19 structural parts, and prints the report.
 */

import fixture from "../src/lib/furnispec/goldenWardrobe.fixture.json" with { type: "json" };
import { buildStructuralPartGraph } from "../src/lib/partgraph/buildStructuralPartGraph.js";
import { formatPartGraphReport } from "../src/lib/partgraph/serializePartGraph.js";

const partGraph = buildStructuralPartGraph(fixture);
const report = formatPartGraphReport(partGraph);

console.log(report.text);

if (report.verdict !== "PASS") {
  process.exit(1);
}
