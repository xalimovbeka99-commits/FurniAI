/**
 * Built-in viewer UI (textContent only, never innerHTML): status / alert,
 * concept notice, demonstration label, "Visual concept" + relative-scale
 * labels, view controls (rotate, zoom, reset, fit), Retry and Download.
 * Disable with `ui: false` and render your own from getState()/events.
 *
 * Contract UI rule (§1): `concept.notice` is visible whenever a concept is on
 * screen or offered for download. No dimensions are ever shown.
 * `renderConceptNotice: false` (mount option) hides ONLY this overlay's copy
 * of the notice, for a host that renders it itself and so must always show it.
 *
 * Styling: one <style> element inside the viewer root, attribute selectors
 * only, values only from tokens.js (host-overridable CSS custom properties).
 */
import { RELATIVE_SCALE_LABEL } from "./scale.js";
import { token } from "./tokens.js";

export const VISUAL_CONCEPT_LABEL = "Visual concept";
export const DEMO_ASSET_LABEL = "Demonstration asset, synthetic fixture, not a generated result";
export const KEYBOARD_HELP = "Arrow keys rotate, + and - zoom, 0 resets, F fits the model.";
/** Shown (role=note) when the file declares textures that could not be loaded or decoded. */
export const TEXTURE_NOTE = "Some textures in this file couldn't be loaded, so the model is shown without them.";

/** Job/creative phases have no percentage: provider progress has an unverified scale. */
const PHASE_TEXT = {
  "job-checking": "Checking the 3D concept…",
  "job-submitting": "Sending your image to the 3D generation service…",
  "job-processing": "Generating 3D concept… This can take a few minutes.",
  resolving: "Opening 3D concept…",
  retrying: "Retrying with a fresh link…",
  parsing: "Preparing model…",
};

/** [action, visible text, accessible name] */
export const VIEW_CONTROLS = /* @__PURE__ */ Object.freeze([
  ["left", "◀", "Rotate left"],
  ["right", "▶", "Rotate right"],
  ["in", "+", "Zoom in"],
  ["out", "−", "Zoom out"],
  ["reset", "Reset", "Reset view"],
  ["fit", "Fit", "Fit to view"],
]);

const S = "[data-asset-viewer]";
// `$name` is a design token: replaced by var(--furni-name, fallback) from tokens.js.
const CSS = `$ {position:relative;width:100%;height:100%;min-height:$viewer-min-height;overflow:hidden;font:$text-sm/1.35 $font-sans;color:$text}
$ canvas{display:block;width:100%;height:100%;touch-action:none}
$ [data-av-top],$ [data-av-bottom]{position:absolute;left:$space-3;right:$space-3;display:flex;gap:$space-2;pointer-events:none}
$ [data-av-top]{top:$space-3;flex-direction:column;align-items:flex-start}
$ [data-av-bottom]{bottom:$space-3;flex-wrap:wrap;align-items:flex-end;justify-content:space-between}
$ [data-av-top]>[role],$ [data-av-kind],$ [data-av-scale]{max-width:100%;box-sizing:border-box;border-radius:$radius-md;padding:$space-1 $space-2;overflow-wrap:anywhere}
$ [data-av-demo]{background:$demo-bg;color:$demo-text;font-weight:600}
$ [data-av-concept],$ [data-av-note]{background:$note-bg;color:$note-text;border:$border-width solid $note-border}
$ [data-av-concept],$ [data-av-note],$ [data-av-kind],$ [data-av-scale]{font-size:$text-xs}
$ [data-av-status]{background:$surface;box-shadow:$shadow}
$ [data-av-status][role=alert]{background:$alert-bg;color:$alert-text}
$ [data-av-actions],$ [data-av-labels],$ [data-av-controls]{display:flex;flex-wrap:wrap;gap:$space-1}
$ [data-av-kind],$ [data-av-scale]{background:$chip-bg;color:$chip-text}
$ button{pointer-events:auto;min-height:$hit-target;min-width:$hit-target;padding:0 $space-3;font:inherit;border-radius:$radius-md;border:$border-width solid $accent;background:$surface;color:$accent;cursor:pointer}
$ [data-av-download]{background:$accent!important;color:$on-accent!important}
$ button:disabled{opacity:.6;cursor:default}
$ :focus-visible{outline:$focus-ring-width solid $focus;outline-offset:$border-width}`;

export function downloadOnlyText(format) {
  const f = typeof format === "string" && format ? format.toUpperCase() : null;
  return `Preview isn't available for ${f ? `${f} files` : "this file type"}. You can still download the file.`;
}

let uid = 0;

/** downloadButton: "auto" (only where the model can't be shown but the file is valid) | "always" (also while shown) | false */
export function createOverlay(doc, root, { onDownload, onRetry, onControl, renderConceptNotice = true, downloadButton = "auto" } = {}) {
  const el = (tag, attr, parent, text) => {
    const n = doc.createElement(tag);
    n.setAttribute(attr, "");
    if (text) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  };
  const cleanups = [];
  const listen = (n, fn) => {
    n.addEventListener("click", fn);
    cleanups.push(() => n.removeEventListener("click", fn));
  };
  const button = (attr, parent, text, label, fn) => {
    const b = el("button", attr, parent, text);
    b.setAttribute("type", "button");
    if (label) b.setAttribute("aria-label", label);
    b.style.display = "none";
    listen(b, fn);
    return b;
  };

  const style = el("style", "data-av-style", root);
  style.textContent = CSS.replace(/\$([\w-]*)/g, (_, name) => (name ? token(name) : S));
  // Hidden, but still read as the canvas's aria-describedby description.
  const help = el("div", "data-av-help", root, KEYBOARD_HELP);
  help.hidden = true;
  help.id = `av-help-${++uid}`;

  const stack = el("div", "data-av-top", root);
  const demo = el("div", "data-av-demo", stack);
  demo.setAttribute("role", "note");
  const concept = el("div", "data-av-concept", stack);
  if (!renderConceptNotice) concept.setAttribute("data-av-concept-host-rendered", "");
  concept.setAttribute("role", "note");
  const note = el("div", "data-av-note", stack);
  note.setAttribute("role", "note");
  const status = el("div", "data-av-status", stack);
  const actions = el("div", "data-av-actions", stack);
  let busy = false;
  const retry = button("data-av-retry", actions, "Try again", null, () => typeof onRetry === "function" && onRetry());
  const download = button("data-av-download", actions, "Download file", null, () => {
    if (busy || typeof onDownload !== "function") return; // a double click starts ONE download
    const p = onDownload();
    if (p && typeof p.then === "function") {
      busy = true;
      download.disabled = true;
      download.setAttribute("aria-busy", "true");
      p.catch(() => {}).then(() => {
        busy = false;
        download.disabled = false;
        download.setAttribute("aria-busy", "false");
      });
    }
  });

  const bottom = el("div", "data-av-bottom", root);
  const labels = el("div", "data-av-labels", bottom);
  const kind = el("div", "data-av-kind", labels, VISUAL_CONCEPT_LABEL);
  const badge = el("div", "data-av-scale", labels);
  const controls = el("div", "data-av-controls", bottom);
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", "3D view controls");
  const controlButtons = VIEW_CONTROLS.map(([action, text, label]) => {
    const b = button("data-av-control", controls, text, label, () => typeof onControl === "function" && onControl(action));
    b.setAttribute("data-av-control", action);
    b.style.display = "";
    return b;
  });

  function show(node, text) {
    node.textContent = text;
    node.style.display = text ? "" : "none";
  }
  const toggle = (node, on) => (node.style.display = on ? "" : "none");

  return {
    helpId: help.id,
    update(state) {
      const st = state.status;
      const live = st !== "disposed" && st !== "idle";
      status.setAttribute("data-av-state", st);
      const isError = st === "error" && state.error;
      status.setAttribute("role", isError ? "alert" : "status");
      status.setAttribute("aria-live", isError ? "assertive" : "polite");
      show(demo, live && state.demo ? state.demo.label : "");
      // The concept notice is shown in EVERY state that carries a concept (loading, ready, download-only, error).
      // With renderConceptNotice:false the host shows it (from getState().concept.notice) instead.
      show(concept, renderConceptNotice && live && state.concept ? state.concept.notice : "");
      const acts = state.actions;
      const ready = st === "ready" && state.model;
      // As in v2: the in-viewer button only where the file cannot be viewed but is still valid to
      // download (download-only, or an error that kept the file). A shown model is downloaded by the host.
      // "always": also while a valid model is shown (local item, or a concept whose actions allow it).
      const valid = (acts ? acts.download : ready) && (isError ? acts && acts.download : true);
      const offer = Boolean(downloadButton) && typeof onDownload === "function" && Boolean(valid) && (isError || st === "download-only" || (ready && downloadButton === "always"));
      let text = "";
      if (st === "loading") {
        const pct = state.progress && state.progress.ratio != null ? ` ${Math.round(state.progress.ratio * 100)}%` : "";
        text = PHASE_TEXT[state.phase] || `Loading model…${pct}`;
      } else if (isError) text = state.error.message;
      else if (st === "download-only") text = downloadOnlyText(state.asset && state.asset.format);
      else if (st === "idle") text = "No model loaded";
      show(status, text);
      toggle(retry, Boolean(isError && state.canRetry && typeof onRetry === "function"));
      toggle(download, offer);
      toggle(kind, Boolean(ready || st === "download-only" || (isError && offer)));
      const p = ready && state.model.proportions;
      show(badge, ready ? (p ? `${RELATIVE_SCALE_LABEL} · ${p.ratioLabel}` : RELATIVE_SCALE_LABEL) : "");
      show(note, ready && state.model.warnings && state.model.warnings.includes("TEXTURES_NOT_LOADED") ? TEXTURE_NOTE : "");
      toggle(controls, Boolean(ready && typeof onControl === "function"));
      for (const b of controlButtons) b.disabled = !ready;
    },
    dispose() {
      cleanups.splice(0).forEach((f) => f());
      for (const n of [style, help, stack, bottom]) if (n.parentNode) n.parentNode.removeChild(n);
    },
  };
}
