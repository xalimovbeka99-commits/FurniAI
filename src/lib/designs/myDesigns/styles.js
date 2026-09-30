/**
 * Scoped styles for the My Designs module. Static text only (no user data).
 * Every selector is under `.fmd`; colours fall back when the Studio tokens
 * (`--paper`, `--ink`, ...) are absent, e.g. in the demo page.
 */
export const MY_DESIGNS_STYLE_ID = "fmd-styles";

export const MY_DESIGNS_CSS = `
.fmd{font:inherit;color:var(--ink,#1C1E21);max-width:880px;margin:0 auto;padding:16px 0}
.fmd-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
.fmd-title{font-size:18px;font-weight:700;margin:0}
.fmd button{font:inherit;cursor:pointer;border-radius:8px}
.fmd button:disabled{cursor:not-allowed;opacity:.6}
.fmd button:focus-visible{outline:2px solid var(--accent,#2F6FEB);outline-offset:2px}
.fmd-refresh,.fmd-action{background:transparent;border:1px solid var(--line,#DFD9CC);padding:6px 12px;color:inherit}
.fmd-primary{background:var(--ink,#1C1E21);color:var(--paper,#FAF9F5);border:1px solid var(--ink,#1C1E21);padding:6px 14px}
.fmd-status{min-height:1.4em;margin:0 0 8px;font-size:13px;color:var(--muted,#5F6368)}
.fmd-alert:empty{display:none}
.fmd-alert{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #E5B9B0;background:#FBEFEC;color:#7A2E1F;border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:14px}
.fmd-panel{border:1px dashed var(--line,#DFD9CC);border-radius:12px;padding:28px 20px;text-align:center;font-size:14px}
.fmd-panel p{margin:0 0 12px}
.fmd-panel[data-kind]{border-style:solid;border-color:#E5B9B0;background:#FBEFEC;color:#7A2E1F}
.fmd-panel-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.fmd-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.fmd-open{width:100%;text-align:left;background:var(--card,#fff);border:1px solid var(--line,#DFD9CC);padding:14px 16px;display:flex;flex-direction:column;gap:4px;color:inherit}
.fmd-open:hover:not(:disabled){border-color:var(--ink,#1C1E21)}
.fmd-open[aria-busy="true"]{border-color:var(--accent,#2F6FEB)}
.fmd-name{font-weight:600;font-size:15px;overflow-wrap:anywhere}
.fmd-meta{font-size:12px;color:var(--muted,#5F6368)}
.fmd-skeleton{height:64px;border-radius:12px;background:linear-gradient(90deg,#EEE9DF,#F6F2EA,#EEE9DF);background-size:200% 100%;animation:fmd-shimmer 1.2s linear infinite}
@keyframes fmd-shimmer{to{background-position:-200% 0}}
@media (prefers-reduced-motion:reduce){.fmd-skeleton{animation:none}}
`;
