/**
 * src/lib/adapters/aiDesignerTransport.js
 * ---------------------------------------------------------------------
 * The narrow browser transport between the existing "Design with AI" panel
 * and the live model. Bundled separately as `ai-designer-transport.js`
 * (global `AiDesignerTransport`) so it can ship without touching
 * index.html, browserBridge.js or partGraphToThree.js.
 *
 * ONE public call. Order of resolution:
 *
 *   1. DETERMINISTIC — the existing `parseConversationalCommand` runs first,
 *      in the browser, with no network call. "Make it 2000 mm wide" and its
 *      rewordings already resolve here: instant, free, offline, and identical
 *      to what ships today. A deterministic rejection (negative, imprecise,
 *      out-of-range) is returned as-is and the model is never consulted.
 *   2. MODEL — only phrasings the deterministic parser does not recognise are
 *      sent to POST /api/design/propose, which returns PROPOSED EDITS ONLY.
 *   3. KERNEL — those proposed edits are replayed through the existing
 *      `applyConversationalEdit` via a proposal-only adapter. The deterministic
 *      validator and kernel own every dimension and all geometry; a model
 *      proposal that fails validation changes nothing.
 *
 * The active design is never mutated in place. A failed or rejected edit
 * returns `ok:false` and the caller keeps the design it already had.
 */

import { applyConversationalEdit, parseConversationalCommand } from "../conversation/pipeline.js";
import { createModelProposalAdapter, materialKeyFrom } from "../ai-designer/proposalFromModel.js";
import { validateModelProposal } from "../ai-designer/designEditSchema.js";

export const AI_DESIGNER_ENDPOINT = "/api/design/propose";

export const RESULT_SOURCE = Object.freeze({
  DETERMINISTIC: "DETERMINISTIC",
  MODEL: "MODEL",
});

export const RESULT_KIND = Object.freeze({
  DESIGN_UPDATED: "DESIGN_UPDATED",
  MATERIAL_UPDATED: "MATERIAL_UPDATED",
  NEEDS_MORE_DETAIL: "NEEDS_MORE_DETAIL",
  UNSUPPORTED: "UNSUPPORTED",
  REJECTED: "REJECTED",
  DESIGNER_UNAVAILABLE: "DESIGNER_UNAVAILABLE",
});

function factsFrom(observations) {
  return Object.fromEntries((observations ?? []).map((o) => [o.key, o.value]));
}

/**
 * @param {object} args
 * @param {string} args.message the customer's words
 * @param {Array} args.currentObservations the active design's observations
 * @param {string} args.specId
 * @param {number} [args.revision]
 * @param {string} [args.endpoint]
 * @param {typeof fetch} [args.fetchImpl] injectable for tests
 * @param {AbortSignal} [args.signal]
 * @returns {Promise<object>} never throws for an expected failure
 */
export async function proposeDesignChange({
  message,
  currentObservations = [],
  specId,
  revision = 1,
  endpoint = AI_DESIGNER_ENDPOINT,
  fetchImpl = typeof fetch === "function" ? fetch : null,
  signal = undefined,
}) {
  if (typeof message !== "string" || message.trim() === "") {
    return { ok: false, source: RESULT_SOURCE.DETERMINISTIC, kind: RESULT_KIND.REJECTED, error: "Please describe the change you want." };
  }

  // ---- 1. Deterministic first ------------------------------------------
  const parsed = parseConversationalCommand(message, factsFrom(currentObservations));
  if (parsed) {
    if (parsed.error) {
      // Same distinction as below: a capability limit is UNSUPPORTED (the
      // browser shows the reason and the offered alternative), a bad value is
      // REJECTED (a bare error). Collapsing them loses the explanation.
      const parsedUnsupported = Array.isArray(parsed.unsupported) ? parsed.unsupported : [];
      return {
        ok: false,
        error: parsed.error,
        ...(parsedUnsupported.length > 0 ? { unsupported: parsedUnsupported } : {}),
        source: RESULT_SOURCE.DETERMINISTIC,
        kind: parsedUnsupported.length > 0 ? RESULT_KIND.UNSUPPORTED : RESULT_KIND.REJECTED,
      };
    }
    if (parsed.changes?.materialKey && Object.keys(parsed.changes).length === 1) {
      return {
        ok: true,
        source: RESULT_SOURCE.DETERMINISTIC,
        kind: RESULT_KIND.MATERIAL_UPDATED,
        materialKey: parsed.changes.materialKey,
        assistantReply: parsed.assistantReply,
      };
    }
    const applied = applyConversationalEdit({ currentObservations, commandText: message, specId, revision });
    if (applied.ok) {
      return { ...applied, source: RESULT_SOURCE.DETERMINISTIC, kind: RESULT_KIND.DESIGN_UPDATED };
    }
    // A refusal carrying structured `unsupported` entries is a capability
    // limit, not a validation failure. The browser renders the two
    // differently: UNSUPPORTED shows the reason and the offered alternative,
    // REJECTED shows a bare error. Sending a capability limit down the
    // REJECTED path would hide the explanation the customer needs.
    const kind = Array.isArray(applied.unsupported) && applied.unsupported.length > 0
      ? RESULT_KIND.UNSUPPORTED
      : RESULT_KIND.REJECTED;
    return { ...applied, source: RESULT_SOURCE.DETERMINISTIC, kind };
  }

  // ---- 2. Model, for phrasings the parser does not recognise ------------
  if (typeof fetchImpl !== "function") {
    return {
      ok: false,
      source: RESULT_SOURCE.MODEL,
      kind: RESULT_KIND.DESIGNER_UNAVAILABLE,
      error: "The FurniAI designer is not reachable from this browser. Your design is unchanged.",
    };
  }

  let payload;
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message,
        currentFacts: factsFrom(currentObservations),
        currentBayCount: factsFrom(currentObservations).bayCount ?? 2,
      }),
      ...(signal ? { signal } : {}),
    });
    payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.ok) {
      return {
        ok: false,
        source: RESULT_SOURCE.MODEL,
        kind: RESULT_KIND.DESIGNER_UNAVAILABLE,
        code: payload?.code ?? `HTTP_${response.status}`,
        error: payload?.error ?? "The FurniAI designer is not available right now. Your design is unchanged.",
      };
    }
  } catch (err) {
    return {
      ok: false,
      source: RESULT_SOURCE.MODEL,
      kind: RESULT_KIND.DESIGNER_UNAVAILABLE,
      code: err?.name === "AbortError" ? "ABORTED" : "NETWORK_ERROR",
      error: "Could not reach the FurniAI designer. Your design is unchanged.",
    };
  }

  // Defence in depth: the server already validated the model, but the browser
  // re-validates the response with the identical rules. A stale deployment, a
  // proxy, or a server bug cannot put an unchecked value into the design.
  const revalidated = validateModelProposal(
    { edits: payload.edits, unsupported: payload.unsupported, reply: payload.reply },
    { currentBayCount: factsFrom(currentObservations).bayCount ?? 2 }
  );
  const edits = revalidated.edits;
  const unsupported = revalidated.unsupported;
  const clientRejected = revalidated.errors;

  if (edits.length === 0) {
    return {
      ok: false,
      source: RESULT_SOURCE.MODEL,
      kind: unsupported.length > 0
        ? RESULT_KIND.UNSUPPORTED
        : clientRejected.length > 0
          ? RESULT_KIND.REJECTED
          : RESULT_KIND.NEEDS_MORE_DETAIL,
      assistantReply: payload.reply || "",
      unsupported,
      rejected: [...(payload.rejected ?? []), ...clientRejected],
      error: unsupported.length > 0 ? unsupported[0].reason : payload.reply || "I need a little more detail before I can change the design.",
    };
  }

  const materialKey = materialKeyFrom(edits);
  const structural = edits.filter((e) => e.key !== "materialKey");

  if (structural.length === 0) {
    return {
      ok: true,
      source: RESULT_SOURCE.MODEL,
      kind: RESULT_KIND.MATERIAL_UPDATED,
      materialKey,
      assistantReply: payload.reply || `Changed finish to ${materialKey}.`,
      unsupported,
    };
  }

  // ---- 3. The deterministic kernel decides -------------------------------
  const adapter = createModelProposalAdapter(structural, { providerId: payload.provider ?? "server", unsupported });
  const applied = applyConversationalEdit({ currentObservations, commandText: message, specId, revision, adapter });

  if (!applied.ok) {
    return {
      ...applied,
      source: RESULT_SOURCE.MODEL,
      kind: RESULT_KIND.REJECTED,
      assistantReply: payload.reply || "",
      unsupported,
    };
  }

  return {
    ...applied,
    source: RESULT_SOURCE.MODEL,
    kind: RESULT_KIND.DESIGN_UPDATED,
    materialKey: materialKey ?? applied.materialKey ?? null,
    assistantReply: payload.reply || applied.assistantReply,
    unsupported,
    rejected: clientRejected,
  };
}
