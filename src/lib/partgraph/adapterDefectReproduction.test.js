/**
 * Reproduction of the M3 lineage-audit findings, ON THE COMBINED CANDIDATE.
 *
 * The audit reported these by reading the file. This reproduces them by running
 * it, on `60ba875` — the tip that carries the v0.2.0-m2 tag and the final
 * sign-off dossier. Each case below is written to FAIL while the defect exists
 * and PASS once it is fixed, so the commit that fixes them is reviewable
 * against evidence rather than against a claim.
 *
 * Two of the four are provenance failures rather than arithmetic ones, and
 * those are the dangerous kind: the geometry is self-consistent, the tests were
 * green, and the numbers still contradict the approved rulebook.
 *
 * Evidence class: A (unit only). No provider, no network, no browser.
 */
import { describe, it, expect } from "vitest";
import { adaptWardrobeModelToFurniSpec } from "./wardrobeModelAdapter.js";
import { WARDROBE_RULES, RULE_PROVENANCE, resolve } from "../rules/wardrobeRuleCatalog.js";

/** 1800 = 2*18 sides + 1*18 divider + 2*873 bays. Closes exactly. */
const baseModel = (overrides = {}) => ({
  id: "wardrobe-repro",
  revision: 1,
  widthMm: 1800,
  heightMm: 2400,
  depthMm: 600,
  panelThicknessMm: 18,
  sections: [
    { id: "sec-01", widthMm: 873, components: [{ id: "sh-01", type: "SHELF", positionMm: 400 }] },
    { id: "sec-02", widthMm: 873, components: [{ id: "sh-02", type: "SHELF", positionMm: 800 }] },
  ],
  ...overrides,
});

describe("finding 1 — the adapter applies a door rule the catalog refuses to supply", () => {
  it("does not read doorCount from a hard-coded width ladder", () => {
    // `doorsPerBay` is registered REQUIRES_BEKZOD_RULING precisely so that
    // resolve() throws rather than let an unapproved rule reach a customer's
    // design. The adapter answers the same question anyway, from a ladder on
    // the wardrobe's OVERALL width with two thresholds no rule states.
    //
    // The tell: door count must depend on BAY width, not overall width. One
    // 1764mm bay and two 873mm bays have the same overall width and are
    // different cabinets.
    const twoBays = adaptWardrobeModelToFurniSpec(baseModel()).doors.count;
    const oneBay = adaptWardrobeModelToFurniSpec(
      baseModel({ sections: [{ id: "sec-01", widthMm: 1764, components: [] }] })
    ).doors.count;

    expect(
      twoBays === oneBay,
      "door count is identical for a 2-bay and a 1-bay wardrobe of the same overall width, " +
        "which means it is derived from overall width rather than from each bay"
    ).toBe(false);
  });

  it("keeps doorsPerBay resolvable, or stops depending on it", () => {
    // Either the rule is ruled and resolve() returns, or the adapter must not
    // answer the question. Both-at-once is the defect.
    const unruledDoorRule = Object.entries(WARDROBE_RULES).find(
      ([key, r]) => key.startsWith("doorsPerBay") && r.provenance === RULE_PROVENANCE.REQUIRES_BEKZOD_RULING
    );
    expect(
      unruledDoorRule,
      `${unruledDoorRule?.[0]} is REQUIRES_BEKZOD_RULING, yet the adapter still produces a door count`
    ).toBeUndefined();
  });
});

describe("finding 2 — a non-closing model is silently adjusted, not refused", () => {
  it("refuses bay widths that do not close instead of padding the last bay", () => {
    // 873 + 800 = 1673 against 1746 available. The adapter absorbs the 73mm
    // into the last bay and returns a spec, so a customer who asked for an
    // 800mm section receives an 873mm one without being told.
    const model = baseModel({
      sections: [
        { id: "sec-01", widthMm: 873, components: [] },
        { id: "sec-02", widthMm: 800, components: [] },
      ],
    });

    let spec = null;
    let threw = null;
    try {
      spec = adaptWardrobeModelToFurniSpec(model);
    } catch (error) {
      threw = error;
    }

    expect(
      threw,
      spec
        ? `no refusal: the 800mm section came back as ${spec.bays[1].clearWidthMm}mm`
        : "refused as expected"
    ).not.toBeNull();
  });
});

describe("finding 3 — two emitted clearances contradict the approved catalog", () => {
  it("emits WR-005's groove root allowance, not a second figure", () => {
    const spec = adaptWardrobeModelToFurniSpec(baseModel());
    expect(
      spec.clearancePolicy.backPanel.grooveRootAllowanceMm,
      "the adapter emits its own groove root allowance instead of the approved rule's"
    ).toBe(resolve("grooveRootAllowanceMm"));
  });

  it("emits GF-ADJ-FRONT's adjustable-shelf front setback, not a second figure", () => {
    const spec = adaptWardrobeModelToFurniSpec(baseModel());
    expect(
      spec.clearancePolicy.adjustableShelf.frontSetbackMm,
      "the adapter emits its own adjustable-shelf front setback instead of the approved rule's"
    ).toBe(resolve("adjustableShelfFrontSetbackMm"));
  });
});

describe("finding 4 — the adapter does not validate what its header promises", () => {
  it("reports an invalid spec as an adapter failure, not as a kernel failure later", () => {
    // The header says the output is "consumable by buildStructuralPartGraph()".
    // A depth that cannot produce a workable carcass must be caught here, so
    // the error names the adapter rather than sending the next reader into the
    // kernel.
    const model = baseModel({ depthMm: 25 });
    let message = "";
    try {
      adaptWardrobeModelToFurniSpec(model);
    } catch (error) {
      message = String(error.message);
    }
    expect(
      message,
      "the adapter returned a spec it never validated, or failed without naming itself"
    ).toMatch(/adaptWardrobeModelToFurniSpec/i);
  });
});
