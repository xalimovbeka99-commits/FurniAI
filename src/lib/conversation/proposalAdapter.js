/**
 * FurniAI — Proposal Adapter Contract (Gate G4 / AI-Alpha R1)
 * ---------------------------------------------------------------------
 * AI-Alpha reads customer intent through ONE replaceable adapter. The
 * adapter's entire authority is to PROPOSE observations. It cannot approve
 * a FurniSpec and it cannot produce geometry — those live behind
 * `validateApproval()` and the deterministic kernel respectively.
 *
 * CURRENT ADAPTER: `deterministic-phrase-interpreter/0.1`.
 * It is a phrase parser. **AI-Alpha is not yet connected to Claude, Gemini,
 * OpenAI or any other live LLM.**
 *
 * WHEN AN LLM ARRIVES it becomes adapter #2 and reuses the AI plumbing this
 * repository already has — it does NOT get a second AI architecture:
 *   - transport, failover and model config  -> src/lib/ai-provider/
 *   - multi-turn tool-calling loop          -> src/lib/wardrobe-agent/
 *   - the tool surface the model may call   -> src/lib/wardrobe-tools/
 * The LLM adapter is a single proposal-only tool added to that existing tool
 * surface, returning this same `{observations, ambiguities, unmatchedIntent}`
 * shape. See docs/G4_AI_ALPHA_CONVERSATION_TO_WARDROBE.md section 7.
 */

import { interpretDescription } from "./interpretDescription.js";

export const ADAPTER_KIND = Object.freeze({
  DETERMINISTIC: "DETERMINISTIC",
  LLM: "LLM",
});

/**
 * The contract every adapter must satisfy. Enforced by `assertProposalOnly`.
 * Deliberately narrow: an adapter has exactly one method.
 */
export const PROPOSAL_ADAPTER_CONTRACT = Object.freeze({
  requiredMethods: Object.freeze(["interpret"]),
  /** Method names an adapter must NEVER expose — the trust boundary in code. */
  forbiddenMethods: Object.freeze([
    "approve",
    "approveProposal",
    "buildPartGraph",
    "buildStructuralPartGraph",
    "generateGeometry",
    "assembleFurniSpec",
  ]),
  returns: "{ observations: Observation[], ambiguities: Gap[], unmatchedIntent: string[] }",
});

/**
 * Throws if an adapter claims any authority beyond proposing.
 * @param {object} adapter
 */
export function assertProposalOnly(adapter) {
  if (!adapter || typeof adapter !== "object") throw new TypeError("A proposal adapter must be an object.");
  for (const method of PROPOSAL_ADAPTER_CONTRACT.requiredMethods) {
    if (typeof adapter[method] !== "function") {
      throw new Error(`Proposal adapter "${adapter.id ?? "anonymous"}" is missing required method ${method}().`);
    }
  }
  for (const method of PROPOSAL_ADAPTER_CONTRACT.forbiddenMethods) {
    if (typeof adapter[method] === "function") {
      throw new Error(
        `Proposal adapter "${adapter.id ?? "anonymous"}" exposes ${method}(). An adapter may only propose; ` +
          "approval and geometry are outside its authority."
      );
    }
  }
  return adapter;
}

/** The adapter in use today. No model call, no clock, no I/O. */
export function createDeterministicPhraseAdapter() {
  return assertProposalOnly({
    id: "deterministic-phrase-interpreter/0.1",
    kind: ADAPTER_KIND.DETERMINISTIC,
    liveModel: null,
    interpret(description) {
      return interpretDescription(description);
    },
  });
}
