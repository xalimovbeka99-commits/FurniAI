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
  /**
   * The answer that came back is for a design the customer has already moved
   * past — they edited again, pressed Undo, or switched designs while it was
   * in flight. Covers changeToken mismatch and design-id mismatch (not only
   * revision inequality). Kept as STALE_REVISION for Antigravity additive
   * compatibility; see docs/m2/integ/ANTIGRAVITY_STALE_GUARD_HANDOFF.md.
   */
  STALE_REVISION: "STALE_REVISION",
});

function factsFrom(observations) {
  return Object.fromEntries((observations ?? []).map((o) => [o.key, o.value]));
}

function readGetter(maybeGetter) {
  if (typeof maybeGetter !== "function") return undefined;
  return maybeGetter();
}

/**
 * Reject an answer that targets a design the customer has already moved past.
 *
 * BEK contract (revision alone is NOT sufficient):
 *   1. Identify the design (specId / design id).
 *   2. Use a change token that does NOT rewind on Undo — monotonic; bumps on
 *      every committed edit AND every Undo.
 *   3. Reject outdated and out-of-order responses.
 *
 * Why revision is insufficient:
 *   - Undo typically restores the previous revision number. edit(rev1→2) then
 *     Undo(rev2→1) leaves currentRevision === revisionAtRequest, so a delayed
 *     answer for the pre-Undo request would incorrectly apply.
 *   - Two designs can share the same revision number after a switch.
 *
 * `currentDesignId` / `currentChangeToken` are read when the answer lands —
 * pass getters, not snapshots, or the check compares two copies of the same
 * stale value.
 *
 * Legacy: `currentRevision` alone still works as inequality (Claude's original
 * guard) for callers that have not yet adopted changeToken. Prefer changeToken.
 *
 * @param {object} args
 * @param {string} [args.designIdAtRequest]
 * @param {number} [args.changeTokenAtRequest]
 * @param {() => string} [args.currentDesignId]
 * @param {() => number} [args.currentChangeToken]
 * @param {number} [args.revisionAtRequest] legacy
 * @param {() => number} [args.currentRevision] legacy
 * @returns {boolean} true when the answer is stale and must be discarded
 */
export function isStaleAnswer({
  designIdAtRequest,
  changeTokenAtRequest,
  currentDesignId,
  currentChangeToken,
  revisionAtRequest,
  currentRevision,
} = {}) {
  const hasDesignGuard = typeof currentDesignId === "function";
  const hasTokenGuard = typeof currentChangeToken === "function";
  const hasRevisionGuard = typeof currentRevision === "function";

  if (!hasDesignGuard && !hasTokenGuard && !hasRevisionGuard) return false;

  if (hasDesignGuard) {
    const nowId = readGetter(currentDesignId);
    if (designIdAtRequest == null || nowId == null || nowId === "") return false;
    if (String(nowId) !== String(designIdAtRequest)) return true;
  }

  if (hasTokenGuard) {
    const nowToken = readGetter(currentChangeToken);
    if (!Number.isFinite(nowToken) || !Number.isFinite(changeTokenAtRequest)) return false;
    // Strict inequality: any bump (edit, Undo, or out-of-order) is stale.
    if (nowToken !== changeTokenAtRequest) return true;
  }

  if (hasRevisionGuard && !hasTokenGuard) {
    // Legacy path only when changeToken is not supplied.
    const now = readGetter(currentRevision);
    if (!Number.isFinite(now) || !Number.isFinite(revisionAtRequest)) return false;
    if (now !== revisionAtRequest) return true;
  }

  return false;
}

/**
 * @deprecated Prefer isStaleAnswer with changeToken + design id.
 * Kept as a thin wrapper so Claude's original unit names still resolve.
 */
export function isStaleForRevision({ revisionAtRequest, currentRevision } = {}) {
  return isStaleAnswer({ revisionAtRequest, currentRevision });
}

/** The refusal a stale answer becomes. It carries no geometry, by construction. */
function staleResult({
  designIdAtRequest,
  changeTokenAtRequest,
  currentDesignId,
  currentChangeToken,
  revisionAtRequest,
  currentRevision,
}) {
  return {
    ok: false,
    source: RESULT_SOURCE.DETERMINISTIC,
    kind: RESULT_KIND.STALE_REVISION,
    designIdAtRequest: designIdAtRequest ?? null,
    currentDesignId: currentDesignId ?? null,
    changeTokenAtRequest: Number.isFinite(changeTokenAtRequest) ? changeTokenAtRequest : null,
    currentChangeToken: Number.isFinite(currentChangeToken) ? currentChangeToken : null,
    revisionAtRequest: Number.isFinite(revisionAtRequest) ? revisionAtRequest : null,
    currentRevision: Number.isFinite(currentRevision) ? currentRevision : null,
    error:
      "That answer arrived for an older version of your design, so it was not applied. Your current design is unchanged — please ask again.",
  };
}

/**
 * @param {object} args
 * @param {string} args.message the customer's words
 * @param {Array} args.currentObservations the active design's observations
 * @param {string} args.specId design id at request time
 * @param {number} [args.revision]
 * @param {number} [args.changeToken] monotonic token at request (bumps on edit AND Undo)
 * @param {string} [args.endpoint]
 * @param {typeof fetch} [args.fetchImpl] injectable for tests
 * @param {AbortSignal} [args.signal]
 * @param {() => string} [args.currentDesignId] live design id getter
 * @param {() => number} [args.currentChangeToken] live changeToken getter
 * @param {() => number} [args.currentRevision] legacy revision getter
 * @returns {Promise<object>} never throws for an expected failure
 */
export async function proposeDesignChange({
  message,
  currentObservations = [],
  specId,
  revision = 1,
  changeToken = undefined,
  endpoint = AI_DESIGNER_ENDPOINT,
  fetchImpl = typeof fetch === "function" ? fetch : null,
  signal = undefined,
  currentDesignId = undefined,
  currentChangeToken = undefined,
  /**
   * Legacy: reads the caller's CURRENT revision when the answer lands.
   * Prefer currentChangeToken — revision rewinds on Undo.
   */
  currentRevision = undefined,
}) {
  if (typeof message !== "string" || message.trim() === "") {
    return { ok: false, source: RESULT_SOURCE.DETERMINISTIC, kind: RESULT_KIND.REJECTED, error: "Please describe the change you want." };
  }

  // ---- 1. Deterministic first ------------------------------------------
  const parsed = parseConversationalCommand(message, factsFrom(currentObservations));
  if (parsed) {
    if (parsed.error) {
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

  // The deterministic path above completes synchronously, so nothing can have
  // moved underneath it. Everything below awaits the network, which is exactly
  // where a second edit, an Undo, or a design switch can land first.
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

    // One checkpoint for every branch below. Placed here rather than at each
    // return so a branch added later cannot quietly skip it.
    const liveDesignId = readGetter(currentDesignId);
    const liveChangeToken = readGetter(currentChangeToken);
    const liveRevision = readGetter(currentRevision);
    if (
      isStaleAnswer({
        designIdAtRequest: specId,
        changeTokenAtRequest: changeToken,
        currentDesignId,
        currentChangeToken,
        revisionAtRequest: revision,
        currentRevision,
      })
    ) {
      return staleResult({
        designIdAtRequest: specId,
        changeTokenAtRequest: changeToken,
        currentDesignId: liveDesignId,
        currentChangeToken: liveChangeToken,
        revisionAtRequest: revision,
        currentRevision: liveRevision,
      });
    }

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
