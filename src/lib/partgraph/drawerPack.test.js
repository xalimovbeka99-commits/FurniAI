/**
 * Drawer pack — five parts per row, and the refusals that remain.
 *
 * The 2026-09-15 ruling fixed the runner family and the width deduction, which
 * determine the box's WIDTH. It did not fix the box's height, depth, runner
 * clearance, bottom thickness or back arrangement. So these tests come in two
 * halves: a fully-stated bank compiles into real parts, and an under-stated one
 * is still refused with the missing field named.
 *
 * Evidence class: A (unit only). No workshop evidence. Nothing here says a box
 * built to these numbers fits a real runner — only that each number traces to a
 * ruled value or to a dimension the spec itself stated.
 */
import { describe, it, expect } from "vitest";
import golden from "../furnispec/goldenWardrobe.fixture.json";
import {
  compileDrawerPack,
  missingDrawerInputs,
  DRAWER_PACK_REQUIRED_INPUTS,
} from "./drawerPack.js";
import { buildStructuralPartGraph } from "./buildStructuralPartGraph.js";
import { validatePartGraph } from "./validatePartGraph.js";
import { validateFurniSpec } from "../furnispec/validate.js";
import { COMPONENT_OUTCOME, COMPONENT_DIAGNOSTIC_CODE } from "./componentOutcomes.js";
import { PART_ROLES } from "./schema.js";
import { resolve } from "../rules/wardrobeRuleCatalog.js";

/** A bank that states every input the ruling does not supply. */
const STATED_BANK = Object.freeze({
  id: "drawer-bank-l1",
  type: "DRAWER_BANK",
  offsetFromBottomMm: 0,
  rows: 3,
  heightMm: 540,
  boxHeightMm: 140,
  boxDepthMm: 500,
  boxBottomClearanceMm: 13,
  bottomThicknessMm: 6,
  backBetweenSides: true,
});

function specWithBank(bank) {
  const spec = structuredClone(golden);
  spec.bays[0].components = [bank];
  return spec;
}

const BAY = Object.freeze({ index: 0, minXDmm: 180, maxXDmm: 8910, clearWidthDmm: 8730 });

function pack(bank = STATED_BANK) {
  return compileDrawerPack({
    bank,
    bay: BAY,
    bankBottomYDmm: 1180,
    panelTDmm: 180,
    zCarcassFrontDmm: 200,
    matCarcass: "MEL_WHITE_18",
    matFront: "MEL_WHITE_18",
    edgeFrontDmm: 10,
    edgeRearDmm: 0,
  });
}

describe("a fully stated bank compiles into five parts per row", () => {
  it("emits exactly the five declared roles, once per row", () => {
    const { parts } = pack();
    expect(parts).toHaveLength(5 * STATED_BANK.rows);
    for (let row = 1; row <= STATED_BANK.rows; row += 1) {
      const n = String(row).padStart(2, "0");
      const roles = parts.filter((p) => p.id.includes(`_R${n}_`)).map((p) => p.role).sort();
      expect(roles).toEqual(
        [
          PART_ROLES.DRAWER_BACK,
          PART_ROLES.DRAWER_BOTTOM,
          PART_ROLES.DRAWER_FRONT,
          PART_ROLES.DRAWER_SIDE_L,
          PART_ROLES.DRAWER_SIDE_R,
        ].sort()
      );
    }
  });

  it("gives every part a unique id", () => {
    const ids = pack().parts.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps every dimension an integer deci-millimetre", () => {
    for (const p of pack().parts) {
      for (const v of [p.lengthDmm, p.widthDmm, p.thicknessDmm, p.minXDmm, p.maxXDmm, p.minYDmm, p.maxYDmm, p.minZDmm, p.maxZDmm]) {
        expect(Number.isInteger(v), `${p.id} carries ${v}`).toBe(true);
      }
    }
  });
});

describe("the ruled numbers, and only the ruled numbers", () => {
  it("takes 21.0mm total off the bay's clear width — not 21.0mm per side", () => {
    const { parts } = pack();
    const deductionDmm = Math.round(resolve("drawerSlideWidthDeductionMm") * 10);
    expect(deductionDmm).toBe(210);

    const left = parts.find((p) => p.role === PART_ROLES.DRAWER_SIDE_L);
    const right = parts.find((p) => p.role === PART_ROLES.DRAWER_SIDE_R);
    const boxWidth = right.maxXDmm - left.minXDmm;
    expect(boxWidth).toBe(BAY.clearWidthDmm - deductionDmm);
    // Half each side, which is what "total" means and what per-side would not.
    expect(left.minXDmm - BAY.minXDmm).toBe(deductionDmm / 2);
    expect(BAY.maxXDmm - right.maxXDmm).toBe(deductionDmm / 2);
  });

  it("insets the front by the ruled 2.0mm reveal on every edge", () => {
    const revealDmm = Math.round(resolve("drawerFrontRevealMm") * 10);
    expect(revealDmm).toBe(20);
    const front = pack().parts.find((p) => p.role === PART_ROLES.DRAWER_FRONT);
    // Inset in the bay opening - the drawers sit behind the hinged doors.
    expect(front.lengthDmm).toBe(BAY.clearWidthDmm - 2 * revealDmm);
    expect(front.widthDmm).toBe(540 * 10 / 3 - 2 * revealDmm);
  });

  it("records the formula and rule ids for each derived dimension", () => {
    const { derivations } = pack();
    const byPath = Object.fromEntries(derivations.map((d) => [d.path, d]));
    expect(byPath["drawer.boxWidthMm"].ruleIds).toContain("BR-2026-09-15-RUNNER-DEDUCTION");
    expect(byPath["drawer.frontWidthMm"].ruleIds).toContain("BR-2026-09-15-DRAWER-REVEAL");
    expect(byPath["drawer.rowHeightMm"].value).toBe(180);
  });
});

describe("the box the ruling did not size", () => {
  it("uses the stated box height, depth and runner clearance verbatim", () => {
    const side = pack().parts.find((p) => p.role === PART_ROLES.DRAWER_SIDE_L);
    // VERTICAL_YZ: length is the Y span (box height), width is the Z span
    // (box depth) — the same convention the carcass side panels use.
    expect(side.lengthDmm).toBe(1400); // boxHeightMm
    expect(side.widthDmm).toBe(5000); // boxDepthMm
    expect(side.minYDmm).toBe(1180 + 130); // bank datum + boxBottomClearanceMm
  });

  it("puts the back between the sides when the spec says so", () => {
    const { parts } = pack();
    const back = parts.find((p) => p.role === PART_ROLES.DRAWER_BACK);
    const left = parts.find((p) => p.role === PART_ROLES.DRAWER_SIDE_L);
    const right = parts.find((p) => p.role === PART_ROLES.DRAWER_SIDE_R);
    expect(back.minXDmm).toBe(left.maxXDmm);
    expect(back.maxXDmm).toBe(right.minXDmm);
  });

  it("spans the full box width when the spec says the back sits behind", () => {
    const { parts } = pack({ ...STATED_BANK, backBetweenSides: false });
    const back = parts.find((p) => p.role === PART_ROLES.DRAWER_BACK);
    const left = parts.find((p) => p.role === PART_ROLES.DRAWER_SIDE_L);
    const right = parts.find((p) => p.role === PART_ROLES.DRAWER_SIDE_R);
    expect(back.minXDmm).toBe(left.minXDmm);
    expect(back.maxXDmm).toBe(right.maxXDmm);
  });
});

describe("arithmetic that does not close is refused, never rounded", () => {
  it("refuses a bank height that does not divide into exact rows", () => {
    expect(() => pack({ ...STATED_BANK, rows: 7, heightMm: 540 })).toThrow(/does not divide/);
  });

  it("refuses a bay too narrow to leave a box after the deduction", () => {
    expect(() =>
      compileDrawerPack({
        bank: STATED_BANK,
        bay: { index: 0, minXDmm: 0, maxXDmm: 300, clearWidthDmm: 300 },
        bankBottomYDmm: 1180,
        panelTDmm: 180,
        zCarcassFrontDmm: 200,
        matCarcass: "M",
        matFront: "M",
        edgeFrontDmm: 10,
        edgeRearDmm: 0,
      })
    ).toThrow(/leaves no box/);
  });

  it("refuses a box plus runner clearance taller than its row", () => {
    expect(() => pack({ ...STATED_BANK, boxHeightMm: 175 })).toThrow(/exceeds the 180mm row/);
  });

  it("refuses a dimension finer than 0.1mm", () => {
    expect(() => pack({ ...STATED_BANK, boxDepthMm: 500.04 })).toThrow(/finer than 0.1mm/);
  });
});

describe("a bank that does not state the unruled inputs is still refused", () => {
  it("names each missing field", () => {
    const missing = missingDrawerInputs({ id: "d1", type: "DRAWER_BANK", rows: 2, heightMm: 360 });
    expect(missing).toEqual(DRAWER_PACK_REQUIRED_INPUTS.map((i) => i.field));
  });

  it("records it UNSUPPORTED/COMPONENT_NOT_PLACED rather than emitting a guessed box", () => {
    const spec = specWithBank({ id: "drawer-bank-l1", type: "DRAWER_BANK", offsetFromBottomMm: 0, rows: 2, heightMm: 360 });
    expect(validateFurniSpec(spec).valid).toBe(true);

    const graph = buildStructuralPartGraph(spec);
    const entry = graph.componentOutcomes.find((e) => e.componentId === "drawer-bank-l1");
    expect(entry.outcome).toBe(COMPONENT_OUTCOME.UNSUPPORTED);
    expect(entry.diagnosticCode).toBe(COMPONENT_DIAGNOSTIC_CODE.COMPONENT_NOT_PLACED);
    expect(entry.reason).toMatch(/boxHeightMm/);
    expect(entry.partIds).toEqual([]);
    expect(graph.parts.some((p) => p.role.startsWith("DRAWER_"))).toBe(false);
  });

  it("asks a specific question for every unruled input", () => {
    for (const input of DRAWER_PACK_REQUIRED_INPUTS) {
      expect(input.question).toMatch(/\?$/);
      expect(input.question.length).toBeGreaterThan(20);
    }
  });
});

describe("through the real kernel", () => {
  it("produces a PartGraph that validates, with the drawer parts in it", () => {
    const graph = buildStructuralPartGraph(specWithBank(STATED_BANK));
    expect(validatePartGraph(graph).valid).toBe(true);

    const drawerParts = graph.parts.filter((p) => p.role.startsWith("DRAWER_"));
    expect(drawerParts).toHaveLength(15);

    const entry = graph.componentOutcomes.find((e) => e.componentId === "drawer-bank-l1");
    expect(entry.outcome).toBe(COMPONENT_OUTCOME.STRUCTURAL);
    expect(entry.partIds).toHaveLength(15);
  });

  it("counts the drawer parts as structural, not as preview", () => {
    const graph = buildStructuralPartGraph(specWithBank(STATED_BANK));
    expect(graph.summary.unsupportedComponents).toBe(0);
    expect(graph.summary.totalStructuralParts).toBe(graph.parts.length);
  });

  it("leaves hardware drilling blocked — a drawer is parts, not an authorisation", () => {
    const graph = buildStructuralPartGraph(specWithBank(STATED_BANK));
    expect(graph.qualificationStatus).toBe("WORKSHOP_REVIEW_NOT_CNC_QUALIFIED");
    for (const op of graph.operations) {
      expect(op.type).toBe("BACK_GROOVE");
    }
  });
});
