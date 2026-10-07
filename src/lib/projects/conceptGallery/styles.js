/**
 * Scoped styles for the concept gallery. Static text only (no user data).
 *
 * Every value comes from Antigravity's design tokens
 * (src/styles/design-tokens.css, blob 17fc5a7 at the base 6d3f204, from AG's
 * 8744d07 redesign), read as CSS custom properties. Each var() carries that
 * file's own value as its fallback, so the gallery looks the same on a page
 * that hasn't loaded the tokens (root styles.css defines only --paper*,
 * --ink, --ink-soft, --brass*, --walnut, --line*, --r).
 *
 * Status badge colours map onto AG's save-status tokens:
 *   succeeded -> --status-saved-*      processing/submitting -> --status-saving-*
 *   submission_unknown -> --status-unsaved-*   failed -> --status-error-*
 * Colour is never the only signal: every badge carries its label text.
 */
export const CONCEPT_GALLERY_STYLE_ID = "fcg-styles";

export const CONCEPT_GALLERY_TOKENS = Object.freeze([
  "--paper", "--paper-2", "--paper-3", "--ink", "--ink-soft", "--ink-faint", "--brass", "--brass-bright",
  "--line", "--line-soft", "--r", "--r-sm", "--r-pill", "--font-sans", "--font-mono",
  "--space-xs", "--space-sm", "--space-md", "--space-lg", "--space-xl",
  "--status-saved-bg", "--status-saved-text", "--status-saved-border",
  "--status-saving-bg", "--status-saving-text", "--status-saving-border",
  "--status-unsaved-bg", "--status-unsaved-text", "--status-unsaved-border",
  "--status-error-bg", "--status-error-text", "--status-error-border",
]);

export const CONCEPT_GALLERY_CSS = `
.fcg{font-family:var(--font-sans,'Inter',system-ui,-apple-system,sans-serif);color:var(--ink,#1C1E21);max-width:960px;margin:0 auto;padding:var(--space-md,14px) 0}
.fcg *{box-sizing:border-box}
.fcg-head{display:flex;align-items:center;justify-content:space-between;gap:var(--space-md,14px);margin-bottom:var(--space-sm,8px)}
.fcg-title{font-size:18px;font-weight:700;margin:0}
.fcg-live{min-height:1.4em;margin:0 0 var(--space-sm,8px);font-size:13px;color:var(--ink-soft,#5C626E)}
.fcg-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.fcg-btn{font-family:var(--font-mono,'Space Mono',monospace);font-size:12px;letter-spacing:.04em;cursor:pointer;border-radius:var(--r-sm,8px);border:1px solid var(--ink,#1C1E21);background:transparent;color:var(--ink,#1C1E21);padding:7px 13px;min-height:36px}
.fcg-btn:hover:not(:disabled){background:var(--ink,#1C1E21);color:var(--paper,#FAF9F5)}
.fcg-btn-primary{background:var(--ink,#1C1E21);color:var(--paper,#FAF9F5)}
.fcg-btn-primary:hover:not(:disabled){background:var(--brass,#1B4D3E);border-color:var(--brass,#1B4D3E)}
.fcg-btn:disabled{cursor:progress;opacity:.65}
.fcg-btn:focus-visible{outline:2px solid var(--brass,#1B4D3E);outline-offset:2px}
.fcg-panel{border:1px dashed var(--line,#DFD9CC);border-radius:var(--r,14px);padding:var(--space-xl,28px) var(--space-lg,20px);text-align:center;font-size:14px;background:var(--paper,#FAF9F5)}
.fcg-panel p{margin:0 0 var(--space-md,14px)}
.fcg-panel[data-panel="empty"] p{margin:0}
.fcg-panel[role="alert"]{border-style:solid;border-color:var(--status-error-border,#fecaca);background:var(--status-error-bg,#fef2f2);color:var(--status-error-text,#b91c1c)}
.fcg-panel[data-panel="signed_out"],.fcg-panel[data-panel="not_configured"]{border-color:var(--line,#DFD9CC);background:var(--paper-2,#F4F2EB);color:var(--ink,#1C1E21)}
.fcg-viewer{margin:0 0 var(--space-md,14px);padding:var(--space-md,14px);border:1px solid var(--line,#DFD9CC);border-radius:var(--r,14px);background:#fff;display:flex;flex-direction:column;gap:var(--space-sm,8px)}
.fcg-viewer-head{display:flex;align-items:center;justify-content:space-between;gap:var(--space-md,14px)}
.fcg-viewer-title{margin:0;font-size:14px;font-weight:600;overflow-wrap:anywhere}
.fcg-viewer-host{position:relative;height:min(60vh,420px);border-radius:var(--r-sm,8px);background:var(--paper-2,#F4F2EB);overflow:hidden}
.fcg-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-md,14px)}
.fcg-card{display:flex;flex-direction:column;height:100%;background:#fff;border:1px solid var(--line,#DFD9CC);border-radius:var(--r,14px);overflow:hidden}
.fcg-card[data-status="failed"]{border-color:var(--status-error-border,#fecaca)}
.fcg-card[data-status="submission_unknown"]{border-color:var(--status-unsaved-border,#fde68a)}
.fcg-tile{aspect-ratio:16/9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-sm,8px);background:var(--paper-2,#F4F2EB);border-bottom:1px solid var(--line-soft,#EDE8DC);color:var(--ink-soft,#5C626E)}
.fcg-tile-cube{width:34px;height:34px;border:2px solid currentColor;border-radius:4px;transform:rotate(45deg) skew(-8deg,-8deg)}
.fcg-tile-label{font-family:var(--font-mono,'Space Mono',monospace);font-size:11px;letter-spacing:.06em;text-transform:uppercase}
.fcg-tile-sub{font-size:11px;color:var(--ink-soft,#5C626E)}
.fcg-card[data-status="succeeded"] .fcg-tile{color:var(--brass,#1B4D3E)}
.fcg-card[data-status="failed"] .fcg-tile,.fcg-card[data-status="submission_unknown"] .fcg-tile{color:var(--ink-soft,#5C626E)}
[data-billing]{overflow-wrap:anywhere}
.fcg-body{padding:var(--space-md,14px);display:flex;flex-direction:column;gap:var(--space-sm,8px);flex:1}
.fcg-card-title{margin:0;font-size:14px;font-weight:600;overflow-wrap:anywhere}
.fcg-id{font-family:var(--font-mono,'Space Mono',monospace);font-size:12px;overflow-wrap:anywhere;word-break:break-all}
.fcg-badge{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;margin:0;font-size:11px;font-weight:600;padding:3px 8px;border-radius:4px;border:1px solid var(--line,#DFD9CC);background:var(--paper-2,#F4F2EB);color:var(--ink,#1C1E21)}
.fcg-badge[data-status="succeeded"]{background:var(--status-saved-bg,#f0fdf4);color:var(--status-saved-text,#15803d);border-color:var(--status-saved-border,#bbf7d0)}
.fcg-badge[data-status="submitting"],.fcg-badge[data-status="processing"]{background:var(--status-saving-bg,#eff6ff);color:var(--status-saving-text,#1d4ed8);border-color:var(--status-saving-border,#bfdbfe)}
.fcg-badge[data-status="submission_unknown"]{background:var(--status-unsaved-bg,#fffbeb);color:var(--status-unsaved-text,#b45309);border-color:var(--status-unsaved-border,#fde68a)}
.fcg-badge[data-status="failed"]{background:var(--status-error-bg,#fef2f2);color:var(--status-error-text,#b91c1c);border-color:var(--status-error-border,#fecaca)}
.fcg-badge[data-error]{background:var(--status-error-bg,#fef2f2);color:var(--status-error-text,#b91c1c);border-color:var(--status-error-border,#fecaca)}
.fcg-spinner{width:10px;height:10px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:fcg-spin .9s linear infinite}
@keyframes fcg-spin{to{transform:rotate(360deg)}}
.fcg-meta{margin:0;display:grid;grid-template-columns:auto 1fr;gap:2px var(--space-sm,8px);font-size:12px}
.fcg-meta-row{display:contents}
.fcg-meta dt{color:var(--ink-soft,#5C626E)}
.fcg-meta dd{margin:0;overflow-wrap:anywhere}
.fcg-dim{color:var(--ink-faint,#9EA3AE)}
.fcg-notice{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;padding:var(--space-sm,8px) 10px;border-radius:var(--r-sm,8px);background:var(--paper-2,#F4F2EB);border:1px solid var(--line-soft,#EDE8DC);font-size:12px;color:var(--ink-soft,#5C626E)}
.fcg-hint{margin:0;font-size:12px;color:var(--ink-soft,#5C626E)}
.fcg-msg{margin:0;padding:var(--space-sm,8px) 10px;border-radius:var(--r-sm,8px);font-size:12.5px;border:1px solid}
.fcg-msg-error{background:var(--status-error-bg,#fef2f2);color:var(--status-error-text,#b91c1c);border-color:var(--status-error-border,#fecaca)}
.fcg-msg-warn{background:var(--status-unsaved-bg,#fffbeb);color:var(--status-unsaved-text,#b45309);border-color:var(--status-unsaved-border,#fde68a)}
.fcg-output{display:flex;flex-direction:column;gap:6px;margin-top:auto}
.fcg-output+.fcg-output{margin-top:0}
.fcg-actions{display:flex;flex-wrap:wrap;gap:var(--space-sm,8px)}
.fcg-skeletons{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-md,14px)}
.fcg-skeleton{height:280px;border-radius:var(--r,14px);background:linear-gradient(90deg,var(--paper-3,#EAE5D9),var(--paper-2,#F4F2EB),var(--paper-3,#EAE5D9));background-size:200% 100%;animation:fcg-shimmer 1.2s linear infinite}
@keyframes fcg-shimmer{to{background-position:-200% 0}}
@media (max-width:480px){.fcg-list,.fcg-skeletons{grid-template-columns:1fr}.fcg-head{flex-wrap:wrap}}
@media (prefers-reduced-motion:reduce){.fcg-skeleton,.fcg-spinner{animation:none}}
`;
