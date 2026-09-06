import { describe, expect, it } from "vitest";
import {
  ADAPTER_KIND,
  PROPOSAL_ADAPTER_CONTRACT,
  assertProposalOnly,
  createDeterministicPhraseAdapter,
} from "./proposalAdapter.js";
import { COMPLETE_DESCRIPTION } from "./fixtures/demoScenarios.js";

describe("proposal adapter contract", () => {
  it("the adapter in use today is deterministic and connected to no live model", () => {
    const adapter = createDeterministicPhraseAdapter();
    expect(adapter.kind).toBe(ADAPTER_KIND.DETERMINISTIC);
    expect(adapter.liveModel).toBeNull();
    expect(adapter.id).toBe("deterministic-phrase-interpreter/0.1");
  });

  it("returns the observation shape the pipeline expects", () => {
    const result = createDeterministicPhraseAdapter().interpret(COMPLETE_DESCRIPTION);
    expect(Array.isArray(result.observations)).toBe(true);
    expect(Array.isArray(result.ambiguities)).toBe(true);
    expect(Array.isArray(result.unmatchedIntent)).toBe(true);
  });

  it("rejects any adapter that claims authority to approve or to build geometry", () => {
    for (const forbidden of PROPOSAL_ADAPTER_CONTRACT.forbiddenMethods) {
      expect(() =>
        assertProposalOnly({ id: "rogue", interpret() {}, [forbidden]() {} })
      ).toThrow(new RegExp(`${forbidden}\\(\\)`));
    }
  });

  it("rejects an adapter that cannot interpret", () => {
    expect(() => assertProposalOnly({ id: "empty" })).toThrow(/missing required method interpret/);
    expect(() => assertProposalOnly(null)).toThrow(/must be an object/);
  });
});
