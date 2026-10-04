/**
 * DOM rendering. Text goes in through textContent / createTextNode only and
 * attributes through setAttribute; nothing here touches innerHTML, so job
 * data (ids, server messages, model names) can never become markup.
 *
 * providerProgress and providerStatus are deliberately never read here.
 */
import { FALLBACK_CONCEPT_NOTICE, JOB_STATUS, SUBMISSION_UNKNOWN_WARNING, isKnownStatus, isNonTerminal, isViewableFormat } from "./contract.js";
import { ASSET_MESSAGES, ERROR_KIND, JOB_MESSAGES, LIST_MESSAGES } from "./errors.js";
import { LIST_STATUS, assetKey } from "./state.js";

export const STATUS_LABEL = Object.freeze({
  [JOB_STATUS.SUBMITTING]: "Submitting",
  [JOB_STATUS.PROCESSING]: "Generating",
  [JOB_STATUS.SUCCEEDED]: "Ready",
  [JOB_STATUS.FAILED]: "Failed",
  [JOB_STATUS.SUBMISSION_UNKNOWN]: "Outcome unknown",
});

const STATUS_HINT = Object.freeze({
  [JOB_STATUS.SUBMITTING]: "Sending to the generation service…",
  [JOB_STATUS.PROCESSING]: "Generating the 3D concept. This page checks for updates automatically.",
});

const JOB_ERROR_LABEL = Object.freeze({ [ERROR_KIND.INTEGRITY]: "Integrity check failed", [ERROR_KIND.NOT_FOUND]: "Not found", [ERROR_KIND.FORBIDDEN]: "Not allowed" });

export function el(doc, tag, attrs, ...children) {
  const node = doc.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "text") node.textContent = String(v);
      else node.setAttribute(k, v === true ? "" : String(v));
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === "string" ? doc.createTextNode(c) : c);
  }
  return node;
}

/**
 * A failed job's server message as one safe line: control characters and
 * runs of whitespace collapsed, capped at 300 chars, and dropped entirely if
 * it contains an address. Same rule as safeJobMessage() in Asset Engineer's
 * creativeAsset.js (not imported: the gallery does not depend on that module).
 */
export function jobErrorText(message) {
  if (typeof message !== "string") return null;
  const m = message.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (!m || /https?:\/\//i.test(m)) return null;
  return m.length > 300 ? `${m.slice(0, 299)}…` : m;
}

export function defaultFormatDate(iso) {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(t));
  } catch {
    return new Date(t).toISOString();
  }
}

export function statusLabel(status) {
  return isKnownStatus(status) ? STATUS_LABEL[status] : "Unknown status";
}

function timeEl(doc, iso, formatDate) {
  if (!iso) return el(doc, "span", { class: "fcg-dim", text: "—" });
  return el(doc, "time", { datetime: iso, text: formatDate(iso) });
}

function metaRow(doc, label, value) {
  return el(doc, "div", { class: "fcg-meta-row" }, el(doc, "dt", { text: label }), el(doc, "dd", null, value));
}

function formatsText(outputs) {
  if (!outputs.length) return "None yet";
  const names = outputs.map((o) => (o.format ? o.format.toUpperCase() : "Unknown format"));
  return outputs.length === 1 ? names[0] : `${outputs.length} files: ${names.join(", ")}`;
}

/** Neutral placeholder: the contract provides no thumbnail or preview image. */
function placeholderTile(doc) {
  return el(
    doc,
    "div",
    { class: "fcg-tile", "aria-hidden": "true" },
    el(doc, "span", { class: "fcg-tile-cube" }),
    el(doc, "span", { class: "fcg-tile-label", text: "3D concept" }),
  );
}

function outputActions(doc, job, output, state, ctx, multiple) {
  const key = assetKey(job.jobId, output.index);
  const a = state.assets[key];
  const busy = a && a.phase === "resolving";
  const suffix = multiple ? ` (file ${output.index + 1})` : "";
  const fmt = output.format ? output.format.toUpperCase() : "file";
  const wrap = el(doc, "div", { class: "fcg-output", "data-output-index": output.index });
  const buttons = el(doc, "div", { class: "fcg-actions" });
  if (ctx.canOpen && isViewableFormat(output.format)) {
    const open = el(doc, "button", {
      type: "button",
      class: "fcg-btn fcg-btn-primary",
      "data-action": "open",
      "data-focus-key": `open:${key}`,
      "aria-busy": busy && a.action === "open" ? "true" : null,
      text: busy && a.action === "open" ? "Getting file…" : `Open 3D view${suffix}`,
    });
    open.disabled = Boolean(busy);
    open.addEventListener("click", () => ctx.onOpen(job.jobId, output.index));
    buttons.appendChild(open);
  }
  if (!ctx.canDownload) {
    wrap.appendChild(buttons);
    wrap.appendChild(el(doc, "p", { class: "fcg-hint", "data-no-source": "", text: "Files can't be opened or downloaded on this page yet." }));
    return wrap;
  }
  const dl = el(doc, "button", {
    type: "button",
    class: "fcg-btn",
    "data-action": "download",
    "data-focus-key": `download:${key}`,
    "aria-busy": busy && a.action === "download" ? "true" : null,
    text: busy && a.action === "download" ? "Getting file…" : `Download ${fmt}${suffix}`,
  });
  dl.disabled = Boolean(busy);
  dl.addEventListener("click", () => ctx.onDownload(job.jobId, output.index));
  buttons.appendChild(dl);
  wrap.appendChild(buttons);
  if (!isViewableFormat(output.format)) {
    wrap.appendChild(el(doc, "p", { class: "fcg-hint", text: "Download only: this format can't be shown in the 3D view." }));
  }
  if (a && a.phase === "error") {
    wrap.appendChild(
      el(doc, "p", {
        class: "fcg-msg fcg-msg-error",
        "data-asset-error": a.code,
        text: ASSET_MESSAGES[a.kind] || ASSET_MESSAGES[ERROR_KIND.REQUEST],
      }),
    );
  }
  return wrap;
}

export function renderCard(doc, job, state, ctx, n) {
  const titleId = `${ctx.idPrefix}-job-${n}`;
  const known = isKnownStatus(job.status);
  const jobErr = state.jobErrors[job.jobId];
  const card = el(doc, "article", {
    class: "fcg-card",
    "data-job-id": job.jobId,
    "data-status": known ? job.status : "unknown",
    "aria-labelledby": titleId,
  });
  card.appendChild(placeholderTile(doc));
  const body = el(doc, "div", { class: "fcg-body" });
  body.appendChild(
    el(doc, "h3", { class: "fcg-card-title", id: titleId }, "Concept ", el(doc, "code", { class: "fcg-id", text: job.jobId })),
  );
  const badge = el(
    doc,
    "p",
    { class: "fcg-badge", "data-status": known ? job.status : "unknown", "data-error": jobErr ? jobErr.kind : null },
    isNonTerminal(job.status) && !jobErr ? el(doc, "span", { class: "fcg-spinner", "aria-hidden": "true" }) : null,
    el(doc, "span", { class: "fcg-badge-text", text: jobErr ? JOB_ERROR_LABEL[jobErr.kind] || "Unavailable" : statusLabel(job.status) }),
  );
  body.appendChild(badge);

  const meta = el(doc, "dl", { class: "fcg-meta" });
  meta.appendChild(metaRow(doc, "Created", timeEl(doc, job.createdAt, ctx.formatDate)));
  meta.appendChild(metaRow(doc, "Updated", timeEl(doc, job.updatedAt, ctx.formatDate)));
  if (job.sourceReferenceId) {
    meta.appendChild(metaRow(doc, "Reference", el(doc, "code", { class: "fcg-id", text: job.sourceReferenceId })));
  }
  if (job.model || job.provider) {
    meta.appendChild(metaRow(doc, "Model", doc.createTextNode([job.model, job.provider && `(${job.provider})`].filter(Boolean).join(" "))));
  }
  meta.appendChild(metaRow(doc, "Files", doc.createTextNode(formatsText(job.outputs))));
  body.appendChild(meta);

  body.appendChild(el(doc, "p", { class: "fcg-notice", "data-concept-notice": "", text: job.notice || FALLBACK_CONCEPT_NOTICE }));

  if (jobErr) {
    body.appendChild(
      el(doc, "p", {
        class: "fcg-msg fcg-msg-error",
        "data-job-error": jobErr.code,
        text: JOB_MESSAGES[jobErr.kind] || "This concept couldn't be updated.",
      }),
    );
  } else if (job.status === JOB_STATUS.SUBMITTING || job.status === JOB_STATUS.PROCESSING) {
    body.appendChild(el(doc, "p", { class: "fcg-hint", text: STATUS_HINT[job.status] }));
    if (state.checkDelayed[job.jobId]) {
      body.appendChild(el(doc, "p", { class: "fcg-hint", "data-check-delayed": "", text: "The last status check didn't go through. Still checking." }));
    }
  } else if (job.status === JOB_STATUS.FAILED) {
    body.appendChild(
      el(
        doc,
        "p",
        { class: "fcg-msg fcg-msg-error", "data-failed": job.error?.code || "" },
        el(doc, "strong", { text: "Generation failed. " }),
        jobErrorText(job.error?.message) || "The generation service reported a failure.",
      ),
    );
  } else if (job.status === JOB_STATUS.SUBMISSION_UNKNOWN) {
    body.appendChild(
      el(doc, "p", { class: "fcg-msg fcg-msg-warn", "data-submission-unknown": "" }, el(doc, "strong", { text: "May have been charged. " }), SUBMISSION_UNKNOWN_WARNING),
    );
  } else if (!known) {
    body.appendChild(el(doc, "p", { class: "fcg-hint", text: "This concept has a status this page doesn't recognise. It isn't checked automatically." }));
  }

  if (job.status === JOB_STATUS.SUCCEEDED && !jobErr) {
    const multiple = job.outputs.length > 1;
    for (const o of job.outputs) body.appendChild(outputActions(doc, job, o, state, ctx, multiple));
  }
  card.appendChild(body);
  return card;
}

function panel(doc, kind, message, retry) {
  const p = el(doc, "div", { class: "fcg-panel", "data-panel": kind, role: kind === "empty" ? null : "alert" }, el(doc, "p", { text: message }));
  if (retry) {
    const b = el(doc, "button", { type: "button", class: "fcg-btn", "data-action": "retry", "data-focus-key": "retry", text: "Try again" });
    b.addEventListener("click", retry);
    p.appendChild(b);
  }
  return p;
}

/** Renders the variable part of the gallery into `body`. */
export function renderBody(doc, body, state, ctx) {
  body.textContent = "";
  if (state.list === LIST_STATUS.LOADING) {
    body.appendChild(el(doc, "p", { class: "fcg-sr", text: "Loading your 3D concepts…" }));
    const sk = el(doc, "div", { class: "fcg-skeletons", "aria-hidden": "true", "data-panel": "loading" });
    for (let i = 0; i < 3; i++) sk.appendChild(el(doc, "div", { class: "fcg-skeleton" }));
    body.appendChild(sk);
    return;
  }
  if (state.list === LIST_STATUS.ERROR) {
    const kind = state.error?.kind || ERROR_KIND.REQUEST;
    const p = panel(doc, kind, LIST_MESSAGES[kind] || LIST_MESSAGES[ERROR_KIND.REQUEST], kind === ERROR_KIND.SIGNED_OUT || kind === ERROR_KIND.FORBIDDEN ? null : ctx.onRefresh);
    if (state.error?.code) p.setAttribute("data-code", state.error.code);
    body.appendChild(p);
    return;
  }
  if (!state.jobs.length) {
    body.appendChild(panel(doc, "empty", "No 3D concepts yet. Concepts you generate will appear here."));
    return;
  }
  const list = el(doc, "ul", { class: "fcg-list" });
  state.jobs.forEach((job, n) => list.appendChild(el(doc, "li", { class: "fcg-item" }, renderCard(doc, job, state, ctx, n))));
  body.appendChild(list);
}

/** Text for the polite live region. */
export function pollingText(state, nextDelayMs) {
  if (state.list !== LIST_STATUS.READY) return "";
  const n = state.jobs.filter((j) => isNonTerminal(j.status) && !state.jobErrors[j.jobId]).length;
  if (!n || !state.polling) return "";
  if (state.pollFailures > 0) {
    const s = Math.round((nextDelayMs || 0) / 1000);
    return `Having trouble checking for updates. Trying again in ${s} s.`;
  }
  return n === 1 ? "Checking 1 concept for updates…" : `Checking ${n} concepts for updates…`;
}
