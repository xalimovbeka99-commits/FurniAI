/**
 * FurniAI — Clarification Gap Analysis (Gate G4 / AI-Alpha)
 * ---------------------------------------------------------------------
 * SAFETY CONTRACT
 * - Pure and deterministic. NO model call, no randomness, no I/O.
 * - Never supplies a missing value. It only reports, in typed form, what a
 *   person still has to decide.
 * - A value it puts forward as a `proposal` is a question, not a default.
 *   Nothing is applied until it comes back as CUSTOMER_CONFIRMED.
 *
 * The language model's only job downstream is to phrase these gaps. It does
 * not decide what is missing and it cannot answer them.
 */

import { toDeciMm } from "../furnispec/units.js";
import { WARDROBE_RULES, resolve, ruleIdOf } from "../rules/wardrobeRuleCatalog.js";
import {
  GAP_KIND,
  GAP_SEVERITY,
  REQUIRED_INTAKE_FACTS,
  SUPPORTED_FINISHES,
  gap,
  sortGaps,
} from "./intakeModel.js";

/**
 * @param {{observations:Array, ambiguities?:Array}} interpretation
 * @returns {Array} deterministically ordered gaps
 */
export function analyseGaps(interpretation) {
  const observations = interpretation?.observations ?? [];
  const ambiguities = interpretation?.ambiguities ?? [];

  const values = new Map();
  for (const obs of observations) values.set(obs.key, obs.value);

  const gaps = [...ambiguities];
  const alreadyFlagged = new Set(ambiguities.map((a) => a.key));

  const has = (key) => values.has(key) && !alreadyFlagged.has(key);
  const get = (key) => values.get(key);

  // --- 1. Missing required facts ---------------------------------------------
  for (const fact of REQUIRED_INTAKE_FACTS) {
    if (has(fact.key) || alreadyFlagged.has(fact.key)) continue;

    let proposal = null;
    let proposalBasis = null;
    let detail = `No ${fact.label} was supplied and no approved rule can supply it.`;

    if (fact.key === "bayCount") {
      detail =
        `No ${fact.label} was supplied. ${WARDROBE_RULES.bayCountForWidth.note} ` +
        "It cannot be inferred from the overall width.";
      proposalBasis = WARDROBE_RULES.bayCountForWidth.id;
    } else if (fact.key === "doorCount" && has("bayCount")) {
      proposal = get("bayCount") * 2;
      proposalBasis = WARDROBE_RULES.doorsPerBay.id;
      detail =
        `No ${fact.label} was supplied. ${WARDROBE_RULES.doorsPerBay.note} ` +
        `Two doors per bay is offered for confirmation only.`;
    } else if (fact.key === "bayLayouts" && has("bayCount")) {
      detail = `The interior layout of each of the ${get("bayCount")} bays was not described.`;
    }

    gaps.push(gap(fact.key, GAP_KIND.MISSING_REQUIRED_FACT, GAP_SEVERITY.BLOCKING, { detail, proposal, proposalBasis }));
  }

  // --- 2. Finish must have an approved material ------------------------------
  if (has("finishType") && !SUPPORTED_FINISHES.includes(get("finishType"))) {
    gaps.push(
      gap("finishType", GAP_KIND.OUT_OF_SLICE, GAP_SEVERITY.BLOCKING, {
        detail:
          `Finish "${get("finishType")}" has no Bekzod-approved material record in the first slice. ` +
          `Approved finishes: ${SUPPORTED_FINISHES.join(", ")}.`,
      })
    );
  }

  // --- 3. Layout count must match bay count ----------------------------------
  if (has("bayCount") && has("bayLayouts")) {
    const layouts = get("bayLayouts");
    if (!Array.isArray(layouts) || layouts.length !== get("bayCount")) {
      gaps.push(
        gap("bayLayouts", GAP_KIND.CONFLICTING_FACT, GAP_SEVERITY.BLOCKING, {
          detail:
            `${get("bayCount")} bays were requested but ${Array.isArray(layouts) ? layouts.length : 0} ` +
            `interior layout(s) were described. Each bay needs its own layout.`,
        })
      );
    }
  }

  // --- 4. Width closure: bays must divide exactly at 0.1mm -------------------
  if (has("envelope.widthMm") && has("bayCount")) {
    const panelTDmm = toDeciMm(resolve("panelThicknessMm"), "panelThicknessMm");
    const widthDmm = toDeciMm(get("envelope.widthMm"), "envelope.widthMm");
    const bays = get("bayCount");
    const internalDmm = widthDmm - (bays + 1) * panelTDmm;

    if (internalDmm <= 0) {
      gaps.push(
        gap("bayCount", GAP_KIND.CONFLICTING_FACT, GAP_SEVERITY.BLOCKING, {
          detail:
            `${bays} bays need ${((bays + 1) * panelTDmm) / 10}mm of ${resolve("panelThicknessMm")}mm panel ` +
            `(rule ${ruleIdOf("panelThicknessMm")}), which does not fit inside an overall width of ` +
            `${get("envelope.widthMm")}mm.`,
        })
      );
    } else if (internalDmm % bays !== 0) {
      gaps.push(
        gap("bayCount", GAP_KIND.UNRULED_DERIVATION, GAP_SEVERITY.BLOCKING, {
          detail:
            `${internalDmm / 10}mm of clear width does not divide evenly into ${bays} bays. ` +
            `${WARDROBE_RULES.unevenBayWidthDistribution.note}`,
          proposalBasis: WARDROBE_RULES.unevenBayWidthDistribution.id,
        })
      );
    }
  }

  // --- 5. Height closure: carcass must survive the plinth ---------------------
  if (has("envelope.heightMm") && has("plinth.heightMm")) {
    const panelTDmm = toDeciMm(resolve("panelThicknessMm"), "panelThicknessMm");
    const carcassDmm = toDeciMm(get("envelope.heightMm"), "envelope.heightMm") - toDeciMm(get("plinth.heightMm"), "plinth.heightMm");
    if (carcassDmm <= 2 * panelTDmm) {
      gaps.push(
        gap("plinth.heightMm", GAP_KIND.CONFLICTING_FACT, GAP_SEVERITY.BLOCKING, {
          detail:
            `A ${get("plinth.heightMm")}mm plinth leaves ${carcassDmm / 10}mm of carcass inside a ` +
            `${get("envelope.heightMm")}mm envelope, which cannot contain the top and bottom panels.`,
        })
      );
    }
  }

  // --- 6. Depth closure: doors and bumper gap must fit ------------------------
  if (has("envelope.depthMm")) {
    const doorTDmm = toDeciMm(resolve("panelThicknessMm"), "doorThicknessMm");
    const bumperDmm = toDeciMm(resolve("doorBumperGapMm"), "doorBumperGapMm");
    const carcassDDmm = toDeciMm(get("envelope.depthMm"), "envelope.depthMm") - doorTDmm - bumperDmm;
    if (carcassDDmm <= 0) {
      gaps.push(
        gap("envelope.depthMm", GAP_KIND.CONFLICTING_FACT, GAP_SEVERITY.BLOCKING, {
          detail:
            `An overall depth of ${get("envelope.depthMm")}mm leaves no carcass once the ` +
            `${resolve("panelThicknessMm")}mm door (${ruleIdOf("panelThicknessMm")}) and ` +
            `${resolve("doorBumperGapMm")}mm bumper gap (${ruleIdOf("doorBumperGapMm")}) are removed.`,
        })
      );
    }
  }

  // --- 7. Door width closure --------------------------------------------------
  if (has("envelope.widthMm") && has("doorCount")) {
    const revealDmm = toDeciMm(resolve("doorRevealMm"), "doorRevealMm");
    const count = get("doorCount");
    const widthDmm = toDeciMm(get("envelope.widthMm"), "envelope.widthMm");
    const availableDmm = widthDmm - 2 * revealDmm - (count - 1) * revealDmm;
    if (availableDmm <= 0) {
      gaps.push(
        gap("doorCount", GAP_KIND.CONFLICTING_FACT, GAP_SEVERITY.BLOCKING, {
          detail: `${count} doors and their ${resolve("doorRevealMm")}mm reveals (${ruleIdOf("doorRevealMm")}) exceed the ${get("envelope.widthMm")}mm overall width.`,
        })
      );
    } else if (availableDmm % count !== 0) {
      gaps.push(
        gap("doorCount", GAP_KIND.UNRULED_DERIVATION, GAP_SEVERITY.BLOCKING, {
          detail:
            `${availableDmm / 10}mm of door width does not divide evenly into ${count} doors. ` +
            `No approved rule distributes the remainder.`,
          proposalBasis: WARDROBE_RULES.unevenBayWidthDistribution.id,
        })
      );
    }
  }

  return sortGaps(gaps);
}

/** True when nothing blocks FurniSpec assembly. */
export function isReadyForAssembly(gaps) {
  return gaps.every((g) => g.severity !== GAP_SEVERITY.BLOCKING);
}

export function blockingGaps(gaps) {
  return gaps.filter((g) => g.severity === GAP_SEVERITY.BLOCKING);
}
