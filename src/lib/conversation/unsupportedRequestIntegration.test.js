/**
 * Does the unsupported-component diagnostic actually reach the customer?
 *
 * The component ledger makes an unbuildable component VISIBLE inside the
 * PartGraph. That is a diagnostic, and a diagnostic is not a fulfilment.
 * Asserting that a PartGraph carrying UNSUPPORTED outcomes is "valid" proves
 * nothing about what the customer sees — a wardrobe silently missing the part
 * they asked for would also pass that test, with the explanation sitting in a
 * field the browser never reads.
 *
 * So every test here drives a REAL entry point and asserts on what comes back
 * to the caller:
 *
 *   - `proposeDesignChange`  — the published browser transport.
 *   - `applyConversationalEdit` — the pipeline's edit entry.
 *   - `previewDraftWardrobe` / `approveAndPreview` — the draft and approval
 *     entries, the latter being the strictest boundary in the system.
 *
 * Four properties are asserted at each one:
 *   1. the request is detected,
 *   2. a clear explanation comes back,
 *   3. the active design is neither replaced nor its revision advanced,
 *   4. the suggested alternative is NOT applied.
 *
 * Provider evidence class: PARSER-ONLY. No provider is contacted by any test
 * in this file (`fetchImpl: null` proves it — the transport cannot reach a
 * model without one). That is the point: a capability limit must be answerable
 * with no model, no network and no credential.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  previewDraftWardrobe,
  applyConversationalEdit,
  approveAndPreview,
  PIPELINE_STAGE,
} from "./pipeline.js";
import { createProposal } from "./approval.js";
import { proposeDesignChange, RESULT_KIND, RESULT_SOURCE } from "../adapters/aiDesignerTransport.js";
import { COMPONENT_TYPES } from "../furnispec/schema.js";
import { COMPONENT_REPRESENTATION_POLICY } from "../partgraph/componentOutcomes.js";

const SPEC_ID = "spec-unsupported-integration";
const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../furnispec/goldenWardrobe.fixture.json", import.meta.url)), "utf8")
);
const clone = (o) => JSON.parse(JSON.stringify(o));

/** The design the customer is looking at when they ask for something unsupported. */
function activeDesign() {
  const draft = previewDraftWardrobe({
    description: "A wardrobe 1800 mm wide and 2400 mm high",
    specId: SPEC_ID,
    revision: 1,
  });
  expect(draft.stage).toBe(PIPELINE_STAGE.DRAFT_PREVIEW);
  return draft;
}

const snapshotOf = (design) =>
  JSON.stringify({
    spec: design.spec,
    partGraph: design.partGraph,
    observations: design.observations,
  });

describe("through the published transport — proposeDesignChange", () => {
  // fetchImpl: null means there is no way to reach a model. Anything that
  // answers here answered deterministically.
  const ask = (message, design) =>
    proposeDesignChange({
      message,
      currentObservations: design.observations,
      specId: SPEC_ID,
      revision: design.spec.revision,
      fetchImpl: null,
    });

  it("answers 'Add handles' as UNSUPPORTED, not as a rejection or an outage", async () => {
    // Before this existed, "Add handles" matched no branch, fell through to
    // the model, and with no provider reachable came back as
    // DESIGNER_UNAVAILABLE — telling the customer to try again at something
    // that will never work.
    const design = activeDesign();
    const res = await ask("Add handles", design);

    expect(res.kind).toBe(RESULT_KIND.UNSUPPORTED);
    expect(res.source).toBe(RESULT_SOURCE.DETERMINISTIC);
    expect(res.ok).toBe(false);
  });

  it("returns an explanation a customer can act on", async () => {
    const res = await ask("Add black handles", activeDesign());

    expect(res.error).toMatch(/handles?/i);
    expect(res.error).toMatch(/unchanged/i);
    // Ordinary language only — no enum names, no engineering units.
    expect(res.error).not.toMatch(/[A-Z]{3,}_[A-Z]/);
    expect(res.error).not.toMatch(/dmm|PartGraph|FurniSpec/);
  });

  it("carries the structured unsupported[] the browser renders", async () => {
    // index.html branches on `kind === 'UNSUPPORTED'` and reads
    // `u.reason` / `u.alternative`. Losing this shape loses the explanation.
    const res = await ask("Add handles", activeDesign());

    expect(Array.isArray(res.unsupported)).toBe(true);
    expect(res.unsupported).toHaveLength(1);
    const [item] = res.unsupported;
    expect(item.componentType).toBeNull();
    expect(item.reason).toBeTruthy();
    expect(item.alternativeApplied).toBe(false);
  });

  it("does not replace the active design or advance its revision", async () => {
    const design = activeDesign();
    const before = snapshotOf(design);

    const res = await ask("Add handles", design);

    // No replacement geometry comes back at all...
    expect(res.spec ?? null).toBeNull();
    expect(res.partGraph ?? null).toBeNull();
    expect(res.revision ?? design.spec.revision).toBe(design.spec.revision);
    // ...and the caller's design object is untouched.
    expect(snapshotOf(design)).toBe(before);
  });

  it("does not apply the suggested alternative", async () => {
    // The offer is an offer. A shelf must not appear because drawers could not.
    const design = activeDesign();
    const shelvesBefore = design.partGraph.parts.filter((p) => p.role.includes("SHELF")).length;

    const res = await ask("Add handles", design);

    expect(res.partGraph ?? null).toBeNull();
    expect(res.unsupported[0].alternativeApplied).toBe(false);
    expect(design.partGraph.parts.filter((p) => p.role.includes("SHELF")).length).toBe(shelvesBefore);
    expect(res.error).toMatch(/handle/i);
  });

  it("keeps a following supported edit working normally", async () => {
    // A refusal must not wedge the session. The very next edit still applies.
    const design = activeDesign();
    await ask("Add handles", design);
    const next = await ask("Make it 2000 mm wide", design);

    expect(next.kind).toBe(RESULT_KIND.DESIGN_UPDATED);
    expect(next.spec.envelope.widthMm).toBe(2000);
    expect(next.spec.revision).toBe(design.spec.revision + 1);
  });

  const otherRequests = [
    ["Add black handles", /handles/i],
    ["I want a mirror on the doors", /mirror/i],
    ["Can we have LED lighting inside?", /lighting/i],
    ["Add a lock to the doors", /lock/i],
  ];

  for (const [message, expected] of otherRequests) {
    it(`answers "${message}" without touching the design`, async () => {
      const design = activeDesign();
      const before = snapshotOf(design);

      const res = await ask(message, design);

      expect(res.kind).toBe(RESULT_KIND.UNSUPPORTED);
      expect(res.error).toMatch(expected);
      expect(res.error).toMatch(/unchanged/i);
      expect(res.partGraph ?? null).toBeNull();
      expect(snapshotOf(design)).toBe(before);
    });
  }
});

describe("through the pipeline edit entry � applyConversationalEdit", () => {
  it("refuses with structured unsupported[] and returns no geometry", () => {
    const design = activeDesign();
    const before = snapshotOf(design);

    const result = applyConversationalEdit({
      currentObservations: design.observations,
      commandText: "Add handles",
      specId: SPEC_ID,
      revision: design.spec.revision,
    });

    expect(result.ok).toBe(false);
    expect(result.kind).toBe("UNSUPPORTED");
    expect(result.unsupported?.[0]?.componentType).toBeNull();
    expect(result.unsupported?.[0]?.reason).toMatch(/handle/i);
    expect(result.unsupported?.[0]?.alternativeApplied).toBe(false);
    expect(result.spec ?? null).toBeNull();
    expect(result.partGraph ?? null).toBeNull();
    expect(snapshotOf(design)).toBe(before);
  });
});

describe("the kernel boundary � DRAWER_BANK is structural and previews", () => {
  /**
   * After BEK drawer emission, DRAWER_BANK is COMPONENT_OUTCOME.STRUCTURAL.
   * approveAndPreview must emit DRAWER_* parts; CNC/drilling stay blocked.
   */
  function approvedProposalWithDrawerBank() {
    const spec = clone(fixture);
    spec.specId = SPEC_ID;
    spec.bays[0].components.push({
      id: "drawer-bank-l1",
      type: COMPONENT_TYPES.DRAWER_BANK,
      offsetFromBottomMm: 0,
      rows: 4,
    });
    const proposal = createProposal(spec);
    return {
      proposal,
      approval: {
        approvedBy: "bekzod",
        proposalId: proposal.specId,
        proposalRevision: proposal.revision,
        proposalFingerprint: proposal.fingerprint,
      },
    };
  }

  it("previews an approved DRAWER_BANK with structural DRAWER_* parts", () => {
    const { proposal, approval } = approvedProposalWithDrawerBank();
    const result = approveAndPreview({ proposal, approval });

    expect(result.stage).toBe(PIPELINE_STAGE.APPROVED_FOR_PREVIEW);
    expect(result.partGraph).toBeTruthy();
    const drawerParts = result.partGraph.parts.filter((p) => String(p.role).startsWith("DRAWER_"));
    expect(drawerParts.length).toBeGreaterThan(0);
    expect(result.partGraph.parts.some((p) => p.role === "DRAWER_FRONT")).toBe(true);
  });

  it("keeps machining blocked even when drawer geometry is emitted", () => {
    const { proposal, approval } = approvedProposalWithDrawerBank();
    const result = approveAndPreview({ proposal, approval });
    expect(result.stage).toBe(PIPELINE_STAGE.APPROVED_FOR_PREVIEW);
    expect(result.safety?.cncQualified ?? false).toBe(false);
    expect(result.partGraph.qualificationStatus).toBe("WORKSHOP_REVIEW_NOT_CNC_QUALIFIED");
  });

  it("still previews the baseline golden wardrobe without a drawer bank", () => {
    const { proposal } = approvedProposalWithDrawerBank();
    const cleaned = clone(proposal.spec);
    cleaned.bays[0].components = cleaned.bays[0].components.filter(
      (c) => c.type !== COMPONENT_TYPES.DRAWER_BANK
    );
    const cleanProposal = createProposal(cleaned);
    const result = approveAndPreview({
      proposal: cleanProposal,
      approval: {
        approvedBy: "bekzod",
        proposalId: cleanProposal.specId,
        proposalRevision: cleanProposal.revision,
        proposalFingerprint: cleanProposal.fingerprint,
      },
    });

    expect(result.stage).toBe(PIPELINE_STAGE.APPROVED_FOR_PREVIEW);
    expect(result.partGraph.parts).toHaveLength(19);
  });
});
describe("one wording, one source", () => {
  it("uses one deterministic wording for unmodelled hardware refusals", async () => {
    // DRAWER_BANK is STRUCTURAL (no customerMessage). Unmodelled hardware
    // (handles) still refuses with a single deterministic reason string.
    const viaTransport = await proposeDesignChange({
      message: "Add handles",
      currentObservations: activeDesign().observations,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl: null,
    });
    expect(viaTransport.kind).toBe(RESULT_KIND.UNSUPPORTED);
    expect(viaTransport.unsupported[0].reason).toMatch(/handle/i);
    expect(viaTransport.unsupported[0].alternativeApplied).toBe(false);
  });
});

describe("false positives — an intent word and a component word are not a request", () => {
  /**
   * Both cases below were live defects: a keyword match found a request verb
   * and a component noun anywhere in the sentence and refused confidently.
   *
   * A false refusal is worse than a missed one. A missed request still gets an
   * answer from the model; a false refusal tells the customer that something
   * they never asked for is impossible AND discards the edit they did ask for
   * in the same breath.
   */
  const ask = (message, design) =>
    proposeDesignChange({
      message,
      currentObservations: design.observations,
      specId: SPEC_ID,
      revision: design.spec.revision,
      fetchImpl: null,
    });

  it("applies the width edit in 'I do not want drawers; make it 2000 mm wide'", async () => {
    // The customer is DECLINING drawers and REQUESTING a width change. The
    // refusal used to win and the width edit was thrown away.
    const design = activeDesign();
    const res = await ask("I do not want drawers; make it 2000 mm wide", design);

    expect(res.kind).toBe(RESULT_KIND.DESIGN_UPDATED);
    expect(res.spec.envelope.widthMm).toBe(2000);
    expect(res.spec.revision).toBe(design.spec.revision + 1);
    expect(res.unsupported ?? []).toEqual([]);
  });

  it("never reads 'a light oak finish' as a request for lighting", async () => {
    // "light" is a far more common adjective than a request for illumination.
    const design = activeDesign();
    const res = await ask("I would like a light oak finish", design);

    expect(res.kind).not.toBe(RESULT_KIND.UNSUPPORTED);
    expect(JSON.stringify(res.unsupported ?? [])).not.toMatch(/lighting/i);
    expect(res.error ?? "").not.toMatch(/lighting/i);
  });

  const deferrals = [
    "no drawers please",
    "a wardrobe without drawers",
    "remove the drawers",
    "I'd rather not have drawers",
    "The drawers you showed me were nice",
    "make it light grey",
    "light oak please",
  ];

  for (const message of deferrals) {
    it(`does not issue a confident refusal for "${message}"`, async () => {
      const design = activeDesign();
      const res = await ask(message, design);
      // Whatever happens next — a finish change, a rejection, or a handover to
      // the model — it must not be a refusal about a component.
      expect(res.kind).not.toBe(RESULT_KIND.UNSUPPORTED);
      expect(res.unsupported ?? []).toEqual([]);
    });
  }

  it("still refuses when the same sentence really does request handles", async () => {
    // The control for the deferrals above: negation handling must not have
    // simply disabled detection.
    const design = activeDesign();
    const res = await ask("I want handles on the left", design);
    expect(res.kind).toBe(RESULT_KIND.UNSUPPORTED);
    expect(res.unsupported[0].componentType).toBeNull();
    expect(res.unsupported[0].reason).toMatch(/handle/i);
  });

  it("keeps a supported edit that merely mentions an existing feature", async () => {
    // Shelves and rails exist in the design already. Naming one is not a
    // request to add an unsupported component.
    const design = activeDesign();
    for (const message of ["Make it 2000 mm wide", "Change the finish to walnut"]) {
      const res = await ask(message, design);
      expect(res.kind, message).not.toBe(RESULT_KIND.UNSUPPORTED);
      expect(res.ok, message).toBe(true);
    }
  });

  it("answers a genuine lighting request as UNSUPPORTED, design unchanged", async () => {
    const design = activeDesign();
    const before = snapshotOf(design);
    const res = await ask("Add LED lighting inside", design);

    expect(res.kind).toBe(RESULT_KIND.UNSUPPORTED);
    expect(res.error).toMatch(/lighting/i);
    expect(res.partGraph ?? null).toBeNull();
    expect(snapshotOf(design)).toBe(before);
  });
});

