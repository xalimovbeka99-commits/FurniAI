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

  it("answers 'Add drawers' as UNSUPPORTED, not as a rejection or an outage", async () => {
    // Before this existed, "Add drawers" matched no branch, fell through to
    // the model, and with no provider reachable came back as
    // DESIGNER_UNAVAILABLE — telling the customer to try again at something
    // that will never work.
    const design = activeDesign();
    const res = await ask("Add drawers", design);

    expect(res.kind).toBe(RESULT_KIND.UNSUPPORTED);
    expect(res.source).toBe(RESULT_SOURCE.DETERMINISTIC);
    expect(res.ok).toBe(false);
  });

  it("returns an explanation a customer can act on", async () => {
    const res = await ask("Add four drawers on the left", activeDesign());

    expect(res.error).toMatch(/drawers/i);
    expect(res.error).toMatch(/unchanged/i);
    // Ordinary language only — no enum names, no engineering units.
    expect(res.error).not.toMatch(/[A-Z]{3,}_[A-Z]/);
    expect(res.error).not.toMatch(/dmm|PartGraph|FurniSpec|DRAWER_BANK/);
  });

  it("carries the structured unsupported[] the browser renders", async () => {
    // index.html branches on `kind === 'UNSUPPORTED'` and reads
    // `u.reason` / `u.alternative`. Losing this shape loses the explanation.
    const res = await ask("Add drawers", activeDesign());

    expect(Array.isArray(res.unsupported)).toBe(true);
    expect(res.unsupported).toHaveLength(1);
    const [item] = res.unsupported;
    expect(item.componentType).toBe(COMPONENT_TYPES.DRAWER_BANK);
    expect(item.reason).toBeTruthy();
    expect(item.alternative).toBeTruthy();
    expect(item.alternativeApplied).toBe(false);
  });

  it("does not replace the active design or advance its revision", async () => {
    const design = activeDesign();
    const before = snapshotOf(design);

    const res = await ask("Add drawers", design);

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

    const res = await ask("Add drawers", design);

    expect(res.partGraph ?? null).toBeNull();
    expect(res.unsupported[0].alternativeApplied).toBe(false);
    expect(design.partGraph.parts.filter((p) => p.role.includes("SHELF")).length).toBe(shelvesBefore);
    // The alternative is offered in words, and only in words.
    expect(res.error).toMatch(/if you'd like/i);
  });

  it("keeps a following supported edit working normally", async () => {
    // A refusal must not wedge the session. The very next edit still applies.
    const design = activeDesign();
    await ask("Add drawers", design);
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

describe("through the pipeline edit entry — applyConversationalEdit", () => {
  it("refuses with structured unsupported[] and returns no geometry", () => {
    const design = activeDesign();
    const before = snapshotOf(design);

    const result = applyConversationalEdit({
      currentObservations: design.observations,
      commandText: "Add drawers to the left bay",
      specId: SPEC_ID,
      revision: design.spec.revision,
    });

    expect(result.ok).toBe(false);
    expect(result.unsupported?.[0]?.componentType).toBe(COMPONENT_TYPES.DRAWER_BANK);
    expect(result.spec ?? null).toBeNull();
    expect(result.partGraph ?? null).toBeNull();
    expect(snapshotOf(design)).toBe(before);
  });
});

describe("the kernel boundary — a spec the kernel cannot fully build is never previewed", () => {
  /**
   * No customer path can put a DRAWER_BANK into a spec today:
   * `assembleFurniSpec` emits only shelves and rails, and throws on an unknown
   * bay layout. The exposure is therefore latent, not live — it opens the
   * moment a new bay layout, a model edit, or F2's component editing can
   * introduce a component the kernel cannot build.
   *
   * `approveAndPreview` takes an externally supplied spec, so it is a real
   * entry point that can carry one today, and it is the strictest boundary in
   * the system. If the guard holds here it holds everywhere the same check
   * runs.
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

  it("refuses to preview it even when a human explicitly approved it", () => {
    // An approval cannot make an unbuildable component buildable. Previewing
    // it would show a wardrobe that is missing a part the approver signed off.
    const { proposal, approval } = approvedProposalWithDrawerBank();
    const result = approveAndPreview({ proposal, approval });

    expect(result.stage).toBe(PIPELINE_STAGE.UNSUPPORTED_REQUEST);
    expect(result.partGraph ?? null).toBeNull();
    expect(result.spec ?? null).toBeNull();
    expect(result.unsupported?.[0]?.componentType).toBe(COMPONENT_TYPES.DRAWER_BANK);
    expect(result.error).toMatch(/drawers/i);
  });

  it("keeps machining blocked on the refusal path", () => {
    const { proposal, approval } = approvedProposalWithDrawerBank();
    const result = approveAndPreview({ proposal, approval });
    expect(result.safety?.cncQualified ?? false).toBe(false);
  });

  it("still previews the same spec normally once the component is removed", () => {
    // Proves the refusal is caused by the component and nothing else — the
    // control case for the test above.
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
  it("uses the component policy's customer message, not a hand-written copy", async () => {
    // If these ever diverge, a customer gets one explanation from the parser
    // and a different one from the kernel for the same limitation.
    const policyMessage = COMPONENT_REPRESENTATION_POLICY[COMPONENT_TYPES.DRAWER_BANK].customerMessage;

    const viaTransport = await proposeDesignChange({
      message: "Add drawers",
      currentObservations: activeDesign().observations,
      specId: SPEC_ID,
      revision: 1,
      fetchImpl: null,
    });
    expect(viaTransport.unsupported[0].reason).toBe(policyMessage);

    const { proposal } = (() => {
      const spec = clone(fixture);
      spec.bays[0].components.push({ id: "db", type: COMPONENT_TYPES.DRAWER_BANK, offsetFromBottomMm: 0, rows: 2 });
      return { proposal: createProposal(spec) };
    })();
    const viaKernel = approveAndPreview({
      proposal,
      approval: {
        approvedBy: "bekzod",
        proposalId: proposal.specId,
        proposalRevision: proposal.revision,
        proposalFingerprint: proposal.fingerprint,
      },
    });
    expect(viaKernel.unsupported[0].reason).toBe(policyMessage);
  });
});
