/**
 * FurniAI — Conversation to Parametric Wardrobe Pipeline (Gate G4 / AI-Alpha)
 * ---------------------------------------------------------------------
 *   customer description
 *     -> deterministic interpretation      (proposals only)
 *     -> deterministic gap analysis        (no model call)
 *     -> clarification questions           (phrasing only)
 *     -> human answers                     (CUSTOMER_CONFIRMED)
 *     -> [TRUST BOUNDARY] FurniSpec assembly
 *     -> FurniSpec validation
 *     -> deterministic PartGraph kernel
 *     -> safety report
 *
 * The pipeline is pure: same inputs, same outputs, on every runtime.
 * It never crosses the trust boundary while a BLOCKING gap stands.
 */

import { buildStructuralPartGraph } from "../partgraph/buildStructuralPartGraph.js";
import { validatePartGraph } from "../partgraph/validatePartGraph.js";
import { QUALIFICATION_STATUS, SPEC_STATUS } from "../furnispec/schema.js";
import { validateFurniSpec } from "../furnispec/validate.js";
import { AssemblyBlockedError, assembleFurniSpec } from "./assembleFurniSpec.js";
import { analyseGaps, blockingGaps } from "./gapAnalysis.js";
import { interpretDescription } from "./interpretDescription.js";
import { OBSERVATION_ORIGIN, observation } from "./intakeModel.js";
import { questionsFor } from "./questions.js";

export const PIPELINE_STAGE = Object.freeze({
  CLARIFICATION_REQUIRED: "CLARIFICATION_REQUIRED",
  SPEC_INVALID: "SPEC_INVALID",
  PART_GRAPH_READY: "PART_GRAPH_READY",
});

const MAX_RESOLUTION_ROUNDS = 8;

/**
 * @param {object} args
 * @param {string} args.description raw customer text
 * @param {Record<string, any>} [args.answers] answers keyed by gap key; each becomes CUSTOMER_CONFIRMED
 * @param {string} args.specId
 * @param {number} [args.revision]
 * @param {{approvedBy:string}|null} [args.approval] present => spec status APPROVED
 */
export function runConversationToWardrobe({ description, answers = {}, specId, revision = 1, approval = null }) {
  const interpretation = interpretDescription(description);

  // Answers are confirmations of questions a person was actually asked.
  let observations = [...interpretation.observations];
  let ambiguities = [...interpretation.ambiguities];
  const answeredKeys = [];

  for (let round = 0; round < MAX_RESOLUTION_ROUNDS; round += 1) {
    const currentGaps = analyseGaps({ observations, ambiguities });
    const open = blockingGaps(currentGaps);
    const answerable = open.filter((g) => Object.prototype.hasOwnProperty.call(answers, g.key));
    if (answerable.length === 0) break;

    for (const g of answerable) {
      observations = observations.filter((o) => o.key !== g.key);
      ambiguities = ambiguities.filter((a) => a.key !== g.key);
      observations.push(
        observation(g.key, answers[g.key], OBSERVATION_ORIGIN.CUSTOMER_CONFIRMED, {
          sourceText: `answer to: ${g.key}`,
        })
      );
      answeredKeys.push(g.key);
    }
  }

  const gaps = analyseGaps({ observations, ambiguities });
  const questions = questionsFor(gaps);
  const open = blockingGaps(gaps);

  const base = {
    interpretation,
    observations,
    gaps,
    questions,
    answeredKeys,
  };

  if (open.length > 0) {
    return { ...base, stage: PIPELINE_STAGE.CLARIFICATION_REQUIRED, spec: null, partGraph: null, safety: null };
  }

  const facts = Object.fromEntries(observations.map((o) => [o.key, o.value]));

  let assembled;
  try {
    assembled = assembleFurniSpec({
      facts,
      gaps,
      specId,
      revision,
      status: approval ? SPEC_STATUS.APPROVED : SPEC_STATUS.PROPOSED,
    });
  } catch (err) {
    if (err instanceof AssemblyBlockedError) {
      return { ...base, stage: PIPELINE_STAGE.CLARIFICATION_REQUIRED, spec: null, partGraph: null, safety: null };
    }
    throw err;
  }

  const validation = validateFurniSpec(assembled.spec);
  if (!validation.valid) {
    return {
      ...base,
      stage: PIPELINE_STAGE.SPEC_INVALID,
      spec: assembled.spec,
      derivations: assembled.derivations,
      validation,
      partGraph: null,
      safety: null,
    };
  }

  const partGraph = buildStructuralPartGraph(assembled.spec);
  const partGraphValidation = validatePartGraph(partGraph);

  return {
    ...base,
    stage: PIPELINE_STAGE.PART_GRAPH_READY,
    approval: approval ?? null,
    spec: assembled.spec,
    derivations: assembled.derivations,
    validation,
    partGraph,
    partGraphValidation,
    safety: safetyReport(assembled.spec, partGraph),
  };
}

/**
 * Independent safety read-out. Reports what IS, it does not decide anything.
 * @param {object} spec
 * @param {object} partGraph
 */
export function safetyReport(spec, partGraph) {
  const drillingOperations = (partGraph?.operations ?? []).filter((op) => /DRILL|BORE|HINGE_CUP|PIN_HOLE/i.test(op.type));
  const hardwareStatuses = Object.fromEntries(
    Object.entries(spec.hardware ?? {}).map(([k, v]) => [k, v?.status ?? "UNKNOWN"])
  );

  return {
    cncQualified: false,
    specQualificationStatus: spec.qualificationStatus,
    partGraphQualificationStatus: partGraph?.qualificationStatus ?? null,
    cncQualificationAsserted:
      spec.qualificationStatus === QUALIFICATION_STATUS.WORKSHOP_REVIEW_NOT_CNC_QUALIFIED &&
      partGraph?.qualificationStatus === QUALIFICATION_STATUS.WORKSHOP_REVIEW_NOT_CNC_QUALIFIED,
    drillingPolicy: spec.machiningPolicy?.drilling ?? null,
    drillingOperationCount: drillingOperations.length,
    drillingBlocked:
      spec.machiningPolicy?.drilling === "BLOCKED_PENDING_HARDWARE_APPROVAL" && drillingOperations.length === 0,
    hardwareStatuses,
    approvedOperationTypes: [...new Set((partGraph?.operations ?? []).map((op) => op.type))].sort(),
  };
}
