/**
 * Design tokens for the viewer's own UI. Components (overlay.js,
 * mountAssetViewer.js) never contain a raw colour or pixel value: every
 * value in the stylesheet is `var(--furni-<name>, <fallback below>)`. So Antigravity
 * can restyle the viewer by defining `--furni-*` custom properties (none is
 * defined by this module), with these values as the fallback.
 * Scene colours are numbers for three.js, not CSS.
 */
export const TOKENS = /* @__PURE__ */ Object.freeze({
  "font-sans": "system-ui, sans-serif",
  "text-sm": "0.8125rem",
  "text-xs": "0.75rem",
  "space-1": "0.25rem",
  "space-2": "0.5rem",
  "space-3": "0.75rem",
  "radius-md": "0.5rem",
  "border-width": "0.0625rem",
  "focus-ring-width": "0.1875rem",
  "hit-target": "2.75rem", // 44 CSS px minimum touch target
  "viewer-min-height": "10rem",
  surface: "#fffffff0",
  text: "#1f1f1f",
  accent: "#1f4fd1",
  "on-accent": "#ffffff",
  focus: "#0b57d0",
  "note-bg": "#fff4d6",
  "note-text": "#4a3800",
  "note-border": "#c9a227",
  "demo-bg": "#3a1f5d",
  "demo-text": "#ffffff",
  "alert-bg": "#fde8e6",
  "alert-text": "#7a1a10",
  "chip-bg": "#141414c7",
  "chip-text": "#ffffff",
  shadow: "0 0.0625rem 0.25rem #00000026",
});

/** `var(--furni-<name>, <fallback>)` for one token. */
export const token = (name) => `var(--furni-${name}, ${TOKENS[name]})`;


/** three.js scene colours (numbers). */
export const SCENE = /* @__PURE__ */ Object.freeze({
  background: 0xf3f1ed,
  sky: 0xffffff,
  ground: 0x8a8278,
  key: 0xffffff,
});
