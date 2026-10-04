/**
 * Minimal built-in status overlay (textContent only, never innerHTML).
 * Shows loading/progress, the customer-safe error message, the
 * scale-honesty badge and, for AI visual concepts, the concept notice and a
 * Download button where the concept can only be downloaded. Disable with
 * `ui: false` and render your own from getState()/events.
 *
 * Contract UI rule (§1): `concept.notice` is visible whenever a concept is on
 * screen or offered for download. No dimensions are ever shown.
 */
import { RELATIVE_SCALE_LABEL } from "./scale.js";

const FONT = "font:13px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;";
const BOX = "border-radius:8px;padding:6px 10px;box-sizing:border-box;";
const BASE = "position:absolute;left:12px;" + FONT + "pointer-events:none;" + BOX + "max-width:calc(100% - 24px);";

/** Job/creative phases have no percentage: provider progress has an unverified scale. */
const PHASE_TEXT = {
  "job-checking": "Checking the 3D concept…",
  "job-submitting": "Sending your image to the 3D generation service…",
  "job-processing": "Generating 3D concept… This can take a few minutes.",
  resolving: "Opening 3D concept…",
  retrying: "Retrying with a fresh link…",
  parsing: "Preparing model…",
};

function formatLabel(format) {
  return typeof format === "string" && format ? format.toUpperCase() : null;
}

export function downloadOnlyText(format) {
  const f = formatLabel(format);
  return f
    ? `Preview isn't available for ${f} files. You can still download the file.`
    : "Preview isn't available for this file type. You can still download the file.";
}

export function createOverlay(doc, root, { onDownload } = {}) {
  const stack = doc.createElement("div");
  stack.setAttribute("data-av-top", "");
  stack.style.cssText =
    "position:absolute;left:12px;top:12px;right:12px;display:flex;flex-direction:column;align-items:flex-start;gap:6px;pointer-events:none;";

  const concept = doc.createElement("div");
  concept.setAttribute("data-av-concept", "");
  concept.setAttribute("role", "note");
  concept.style.cssText = FONT + BOX + "background:#fff4d6;color:#4a3800;border:1px solid #e0c060;max-width:100%;font-size:12px;";

  const status = doc.createElement("div");
  status.setAttribute("data-av-status", "");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.style.cssText = FONT + BOX + "background:rgba(255,255,255,0.92);color:#222;box-shadow:0 1px 4px rgba(0,0,0,.15);max-width:100%;";

  const button = doc.createElement("button");
  button.setAttribute("data-av-download", "");
  button.setAttribute("type", "button");
  button.textContent = "Download file";
  button.style.cssText = FONT + BOX + "pointer-events:auto;cursor:pointer;background:#1f4fd1;color:#fff;border:0;display:none;";
  const onClick = () => {
    if (typeof onDownload === "function") onDownload();
  };
  if (typeof button.addEventListener === "function") button.addEventListener("click", onClick);

  stack.appendChild(concept);
  stack.appendChild(status);
  stack.appendChild(button);

  const badge = doc.createElement("div");
  badge.setAttribute("data-av-scale", "");
  badge.style.cssText = BASE + "bottom:12px;background:rgba(20,20,20,0.72);color:#fff;font-size:12px;";

  root.appendChild(stack);
  root.appendChild(badge);

  function show(node, text) {
    node.textContent = text;
    node.style.display = text ? "block" : "none";
  }

  return {
    update(state) {
      status.setAttribute("data-av-state", state.status);
      // The concept notice is shown in EVERY state that carries a concept (loading, ready, download-only, error).
      show(concept, state.concept && state.status !== "disposed" && state.status !== "idle" ? state.concept.notice : "");
      const canDownload = Boolean(state.actions && state.actions.download);
      let offerButton = false;

      if (state.status === "loading") {
        const fixed = PHASE_TEXT[state.phase];
        if (fixed) show(status, fixed);
        else {
          const pct = state.progress && state.progress.ratio != null ? ` ${Math.round(state.progress.ratio * 100)}%` : "";
          show(status, `Loading model…${pct}`);
        }
        show(badge, "");
      } else if (state.status === "error" && state.error) {
        show(status, state.error.message);
        show(badge, "");
        offerButton = canDownload;
      } else if (state.status === "download-only") {
        show(status, downloadOnlyText(state.asset && state.asset.format));
        show(badge, "");
        offerButton = canDownload;
      } else if (state.status === "ready" && state.model) {
        show(status, "");
        const p = state.model.proportions;
        show(badge, p ? `${RELATIVE_SCALE_LABEL} · ${p.ratioLabel}` : RELATIVE_SCALE_LABEL);
      } else if (state.status === "idle") {
        show(status, "No model loaded");
        show(badge, "");
      } else {
        show(status, "");
        show(badge, "");
      }
      button.style.display = offerButton && typeof onDownload === "function" ? "inline-block" : "none";
    },
    dispose() {
      if (typeof button.removeEventListener === "function") button.removeEventListener("click", onClick);
      if (stack.parentNode) stack.parentNode.removeChild(stack);
      if (badge.parentNode) badge.parentNode.removeChild(badge);
    },
  };
}
