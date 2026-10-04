/**
 * Minimal built-in status overlay (textContent only, never innerHTML).
 * Shows loading/progress, the customer-safe error message, and the
 * scale-honesty badge. Disable with `ui: false` and render your own from
 * getState()/events.
 */
import { RELATIVE_SCALE_LABEL } from "./scale.js";

const BASE =
  "position:absolute;left:12px;font:13px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;" +
  "pointer-events:none;border-radius:8px;padding:6px 10px;max-width:calc(100% - 24px);box-sizing:border-box;";

export function createOverlay(doc, root) {
  const status = doc.createElement("div");
  status.setAttribute("data-av-status", "");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.style.cssText = BASE + "top:12px;background:rgba(255,255,255,0.92);color:#222;box-shadow:0 1px 4px rgba(0,0,0,.15);";

  const badge = doc.createElement("div");
  badge.setAttribute("data-av-scale", "");
  badge.style.cssText = BASE + "bottom:12px;background:rgba(20,20,20,0.72);color:#fff;font-size:12px;";

  root.appendChild(status);
  root.appendChild(badge);

  function show(node, text) {
    node.textContent = text;
    node.style.display = text ? "block" : "none";
  }

  return {
    update(state) {
      status.setAttribute("data-av-state", state.status);
      if (state.status === "loading") {
        const pct = state.progress && state.progress.ratio != null ? ` ${Math.round(state.progress.ratio * 100)}%` : "";
        show(status, state.phase === "parsing" ? "Preparing model…" : `Loading model…${pct}`);
        show(badge, "");
      } else if (state.status === "error" && state.error) {
        show(status, state.error.message);
        show(badge, "");
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
    },
    dispose() {
      if (status.parentNode) status.parentNode.removeChild(status);
      if (badge.parentNode) badge.parentNode.removeChild(badge);
    },
  };
}
