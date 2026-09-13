/**
 * FurniAI — turning a validated model proposal into a proposal-only adapter.
 * ---------------------------------------------------------------------
 * The existing conversation pipeline already accepts a proposal adapter
 * (`applyConversationalEdit({ ..., adapter })`) and falls back to
 * `adapter.interpret(commandText)` whenever its deterministic phrase parser
 * does not recognise a command. So connecting a live model needs no pipeline
 * change at all: resolve the model call first, then hand the pipeline a
 * synchronous adapter that replays what the model proposed.
 *
 * The adapter is created through `assertProposalOnly`, so it is structurally
 * incapable of approving a FurniSpec or generating geometry.
 */

import { OBSERVATION_ORIGIN, observation } from "../conversation/intakeModel.js";
import { assertProposalOnly, ADAPTER_KIND } from "../conversation/proposalAdapter.js";

/**
 * @param {Array<{key:string,value:any,sourceText?:string|null}>} edits validated edits
 * @param {{providerId?:string, unsupported?:Array}} [meta]
 */
export function createModelProposalAdapter(edits, { providerId = "unknown", unsupported = [] } = {}) {
  const observations = edits
    .filter((e) => e.key !== "materialKey")
    .map((e) =>
      observation(e.key, e.value, OBSERVATION_ORIGIN.CUSTOMER_STATED, {
        sourceText: e.sourceText ?? `model proposal (${providerId})`,
      })
    );

  return assertProposalOnly({
    id: `llm-proposal-adapter/${providerId}`,
    kind: ADAPTER_KIND.LLM,
    liveModel: providerId,
    interpret() {
      // Pre-resolved: the model call already happened, on the server.
      return { observations, ambiguities: [], unmatchedIntent: unsupported.map((u) => u.request) };
    },
  });
}

/** The material swatch, if the model proposed one. Not part of FurniSpec geometry. */
export function materialKeyFrom(edits) {
  const hit = edits.find((e) => e.key === "materialKey");
  return hit ? hit.value : null;
}
