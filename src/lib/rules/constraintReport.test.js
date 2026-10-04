import { describe, it, expect } from "vitest";
import golden from "../furnispec/goldenWardrobe.fixture.json";
import { previewDraftWardrobe } from "../conversation/pipeline.js";
import { buildConstraintReport } from "./constraintReport.js";
import { RULE_PROVENANCE } from "./wardrobeRuleCatalog.js";

const draft = (w, extra = "") =>
  previewDraftWardrobe({ description: `A wardrobe ${w} mm wide, 2400 mm high and 600 mm deep${extra}`, specId: "s-cr", revision: 1 });

describe("constraint report keeps four kinds of statement apart", () => {
  it("golden wardrobe: PASS, approved rules traced to parts, drilling/STEP/CNC stated as not available", () => {
    const r = buildConstraintReport({ spec: golden });
    expect(r.status).toBe("PASS");
    expect(r.blockingViolations).toEqual([]);
    const approvedProv = new Set([RULE_PROVENANCE.RULEBOOK_V0_1, RULE_PROVENANCE.GOLDEN_FIXTURE_BEKZOD_APPROVED, RULE_PROVENANCE.BEKZOD_RULING]);
    expect(r.approvedRules.length).toBeGreaterThan(0);
    for (const a of r.approvedRules) {
      expect(approvedProv.has(a.provenance), a.id).toBe(true);
      expect(a.appliedTo.length, a.id).toBeGreaterThan(0);
    }
    for (const p of r.provisionalRules) expect(approvedProv.has(p.provenance), p.id).toBe(false);
    const wr003 = r.approvedRules.find((a) => a.id === "WR-003" && a.key === "panelThicknessMm");
    expect(wr003.appliedTo).toContain("CARC_TOP");
    expect(r.notQualified).toMatchObject({
      hardwareDrilling: "BLOCKED_PENDING_HARDWARE_APPROVAL",
      stepExport: "NOT_SUPPORTED",
      cncQualification: golden.qualificationStatus,
    });
    expect(r.untracedReferences.map((u) => u.id)).toContain("WR-002"); // cited, not catalogued — reported, not guessed
  });

  it("a provisional limit exceeded is ADVISORY, labelled provisional, and does not block", () => {
    const d = draft(2800); // two 1364 mm bays
    expect(d.stage).toBe("DRAFT_PREVIEW");
    const r = buildConstraintReport({ spec: d.spec, partGraph: d.partGraph, derivations: d.derivations });
    expect(r.status).toBe("PASS_WITH_ADVISORIES");
    expect(r.blockingViolations).toEqual([]);
    const span = r.advisoryWarnings.filter((w) => w.code === "ADVISORY_LONG_SHELF_SPAN");
    expect(span.length).toBeGreaterThan(0);
    expect(span[0]).toMatchObject({ limitId: "PL-005", limitValueMm: 1200, provenance: "PROVISIONAL_PENDING_BEKZOD_REVIEW" });
  });

  it("a blocking violation stops the report there: nothing is listed as applied", () => {
    const bad = structuredClone(golden);
    bad.bays[0].components.find((c) => c.id === "rail-long-l1").targetClearDropMm = 1797;
    const r = buildConstraintReport({ spec: bad });
    expect(r.status).toBe("BLOCKED");
    expect(r.blockingViolations[0]).toMatchObject({ source: "KERNEL_GEOMETRY", code: "HANGING_DROP_NOT_ACHIEVABLE" });
    expect(r.approvedRules).toEqual([]);
    expect(r.advisoryWarnings).toEqual([]);
  });

  it("drawer construction constants are reported as provisional, against the drawer parts", () => {
    const s = structuredClone(golden);
    delete s.bays[0].components.find((c) => c.id === "rail-long-l1").targetClearDropMm;
    s.bays[0].components.push({ id: "drawer-bank-l1", type: "DRAWER_BANK", offsetFromBottomMm: 0, rows: 2 });
    const r = buildConstraintReport({ spec: s });
    expect(r.status).not.toBe("BLOCKED");
    const box = r.provisionalRules.find((p) => p.id === "DRAWER_BOX_SIDE_THICKNESS_MM");
    expect(box).toMatchObject({ value: 15, provenance: "PROVISIONAL_PENDING_BEKZOD_REVIEW" });
    expect(box.appliedTo.every((id) => id.startsWith("DRAWER_BANK_L1_"))).toBe(true);
  });
});
