import { describe, expect, it } from "vitest";
import fixture from "./goldenWardrobe.fixture.json";
import { validateFurniSpec } from "./validate.js";
import { serializeCanonicalJson } from "./normalize.js";
import { formatGoldenReport } from "./formatGoldenReport.js";

describe("Golden Wardrobe FurniSpec v0.1 Oracle & Invariant Suite", () => {
  it("1. proves the fixture normalizes byte-for-byte identically across 100 runs", () => {
    const baseline = serializeCanonicalJson(fixture);
    for (let i = 0; i < 100; i++) {
      expect(serializeCanonicalJson(fixture)).toBe(baseline);
    }
  });

  it("2. proves exact width arithmetic closure: 18 + 873 + 18 + 873 + 18 = 1800", () => {
    const t = fixture.carcass.panelThicknessMm;
    const b1 = fixture.bays[0].clearWidthMm;
    const b2 = fixture.bays[1].clearWidthMm;
    const calculatedWidth = t + b1 + t + b2 + t;
    expect(calculatedWidth).toBe(1800.0);
    expect(calculatedWidth).toBe(fixture.envelope.widthMm);
  });

  it("3. proves exact height arithmetic closure: 100 + 18 + 2264 + 18 = 2400", () => {
    const plinthH = fixture.plinth.heightMm;
    const botT = fixture.carcass.panelThicknessMm;
    const topT = fixture.carcass.panelThicknessMm;
    const innerH = fixture.carcass.heightMm - botT - topT;
    const calculatedHeight = plinthH + botT + innerH + topT;
    expect(innerH).toBe(2264.0);
    expect(calculatedHeight).toBe(2400.0);
    expect(calculatedHeight).toBe(fixture.envelope.heightMm);
  });

  it("4. proves exact front width closure: 5 * 2 + 4 * 447.5 = 1800", () => {
    const gapCount = fixture.doors.count + 1;
    const totalGaps = gapCount * fixture.doors.reveals.interDoorMm;
    const totalDoors = fixture.doors.count * fixture.doors.finishedWidthMm;
    const calculatedFrontWidth = totalGaps + totalDoors;
    expect(calculatedFrontWidth).toBe(1800.0);
    expect(calculatedFrontWidth).toBe(fixture.envelope.widthMm);
  });

  it("5. proves exact depth closure: 18 + 2 + 580 = 600", () => {
    const doorT = fixture.doors.thicknessMm;
    const bumperGap = 2.0;
    const carcassD = fixture.carcass.depthMm;
    const calculatedDepth = doorT + bumperGap + carcassD;
    expect(calculatedDepth).toBe(600.0);
    expect(calculatedDepth).toBe(fixture.envelope.depthMm);
  });

  it("6. guarantees no rounding policy modifies or corrupts 447.5 mm", () => {
    expect(fixture.doors.finishedWidthMm).toBe(447.5);
    expect(Number.isInteger(fixture.doors.finishedWidthMm * 10)).toBe(true);
    expect(fixture.doors.finishedWidthMm).not.toBe(447);
    expect(fixture.doors.finishedWidthMm).not.toBe(448);
  });

  it("7. proves every structural and component ID is globally unique", () => {
    const ids = [fixture.specId];
    fixture.bays.forEach((bay) => {
      ids.push(bay.id);
      (bay.components || []).forEach((comp) => ids.push(comp.id));
    });
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("8. proves hardware drilling machining remains strictly blocked", () => {
    expect(fixture.hardware.hinges.status).toBe("BLOCKED_PENDING_HARDWARE_APPROVAL");
    expect(fixture.hardware.shelfPins.status).toBe("BLOCKED_PENDING_HARDWARE_APPROVAL");
    expect(fixture.hardware.joinery.status).toBe("BLOCKED_PENDING_HARDWARE_APPROVAL");
    expect(fixture.machiningPolicy.drilling).toBe("BLOCKED_PENDING_HARDWARE_APPROVAL");
    expect(fixture.machiningPolicy.backGroove).toBe("APPROVED");
  });

  it("9. proves CNC qualification remains false (WORKSHOP_REVIEW_NOT_CNC_QUALIFIED)", () => {
    expect(fixture.qualificationStatus).toBe("WORKSHOP_REVIEW_NOT_CNC_QUALIFIED");
    expect(fixture.qualificationStatus).not.toBe("CNC_QUALIFIED");
  });

  it("10. proves invalid fixtures fail validation with stable deterministic error codes", () => {
    // A: CNC qualified claim rejected
    const badCnc = { ...fixture, qualificationStatus: "CNC_QUALIFIED" };
    const resCnc = validateFurniSpec(badCnc);
    expect(resCnc.valid).toBe(false);
    expect(resCnc.errors.some((e) => e.code === "CNC_QUALIFIED_FORBIDDEN")).toBe(true);

    // B: Width mismatch rejected
    const badWidth = { ...fixture, envelope: { ...fixture.envelope, widthMm: 1900.0 } };
    const resWidth = validateFurniSpec(badWidth);
    expect(resWidth.valid).toBe(false);
    expect(resWidth.errors.some((e) => e.code === "WIDTH_MISMATCH")).toBe(true);

    // C: Duplicate ID rejected
    const badId = {
      ...fixture,
      bays: [
        { ...fixture.bays[0], id: "dup-id" },
        { ...fixture.bays[1], id: "dup-id" },
      ],
    };
    const resId = validateFurniSpec(badId);
    expect(resId.valid).toBe(false);
    expect(resId.errors.some((e) => e.code === "DUPLICATE_ID")).toBe(true);

    // D: Active drilling approval while hardware is blocked rejected
    const badDrilling = {
      ...fixture,
      machiningPolicy: { ...fixture.machiningPolicy, drilling: "APPROVED" },
    };
    const resDrill = validateFurniSpec(badDrilling);
    expect(resDrill.valid).toBe(false);
    expect(resDrill.errors.some((e) => e.code === "ILLEGAL_DRILLING_APPROVAL")).toBe(true);
  });

  it("validates the authoritative fixture with zero errors and reports PASS", () => {
    const valResult = validateFurniSpec(fixture);
    expect(valResult.valid).toBe(true);
    expect(valResult.errors).toEqual([]);

    const report = formatGoldenReport(fixture);
    expect(report.verdict).toBe("PASS");
    expect(report.checks.schemaValid).toBe(true);
    expect(report.checks.widthPass).toBe(true);
    expect(report.checks.heightPass).toBe(true);
    expect(report.checks.doorWidthPass).toBe(true);
    expect(report.checks.doorHeightPass).toBe(true);
    expect(report.checks.depthPass).toBe(true);
    expect(report.checks.hardwareBlocked).toBe(true);
    expect(report.checks.cncBlocked).toBe(true);
  });
});
