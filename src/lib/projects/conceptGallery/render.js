/**
 * DOM rendering. Text goes in through textContent / createTextNode only and
 * attributes through setAttribute; nothing here touches innerHTML, so job
 * data (ids, server messages, model names) can never become markup.
 *
 * providerProgress and providerStatus are deliberately never read here.
 */
import { FALLBACK_CONCEPT_NOTICE, JOB_STATUS, LIST_LIMIT, POLL_FAILURES_BEFORE_PAUSE, SUBMISSION_UNKNOWN_WARNING, isKnownStatus, isNonTerminal, isViewableFormat } from "./contract.js";
import { ASSET_MESSAGES, BILLING_TEXT, ERROR_KIND, FAILED_MESSAGES, JOB_MESSAGES, LIST_MESSAGES, PRIOR_SUBMISSION_UNKNOWN_CARD_NOTE, USER_RETRY_KINDS, canUserRetryAsset } from "./errors.js";
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

/**
 * Thumbnail slot. Contract rev 2 has no thumbnail, preview or reference-image field.
 * A host may inject resolveReferenceThumbnail(); when it gives an address the tile shows the
 * REFERENCE image (labelled as such: it is the input, not the generated result). Otherwise a
 * neutral placeholder (aria-hidden: the title and status already say what it shows).
 */
function thumbnailTile(doc, job, state, ctx) {
  const src = state.thumbs[job.jobId] === "ready" && ctx.thumbFor ? ctx.thumbFor(job.jobId) : null;
  if (src) {
    const img = el(doc, "img", { class: "fcg-thumb-img", src, alt: "Reference image this concept was made from", loading: "lazy", decoding: "async" });
    img.addEventListener("error", () => ctx.onThumbError && ctx.onThumbError(job.jobId));
    return el(doc, "figure", { class: "fcg-tile fcg-tile-ref", "data-thumbnail": "reference" }, img, el(doc, "figcaption", { class: "fcg-tile-sub fcg-tile-cap", text: "Reference image" }));
  }
  const fmt = job.status === JOB_STATUS.SUCCEEDED && job.outputs[0]?.format ? job.outputs[0].format.toUpperCase() : null;
  return el(
    doc,
    "div",
    { class: "fcg-tile", "aria-hidden": "true", "data-thumbnail": "none" },
    el(doc, "span", { class: "fcg-tile-cube" }),
    el(doc, "span", { class: "fcg-tile-label", text: fmt ? `Concept · ${fmt}` : "Concept" }),
    el(doc, "span", { class: "fcg-tile-sub", text: "No reference preview" }),
  );
}

/** Whether a result file can be opened/downloaded, as one plain line. */
function resultText(job, jobErr) {
  if (jobErr) return "Not available";
  if (job.status === JOB_STATUS.SUCCEEDED) return job.outputs.length ? `Available (${formatsText(job.outputs)})` : "Not available";
  if (isNonTerminal(job.status)) return "Not yet";
  return "None";
}

/** Rev 2 usage.billingOutcome as one truthful line. Never "free" / "no charge". */
export function billingText(job) {
  const b = job.billing || {};
  if (b.outcome === "reported") return b.reportedCost === null ? BILLING_TEXT.reportedNoCost : BILLING_TEXT.reported(b.reportedCost, b.unit);
  if (b.outcome === "not_submitted") return BILLING_TEXT.not_submitted;
  if (b.outcome === "unconfirmed") return isNonTerminal(job.status) ? BILLING_TEXT.unconfirmedPending : BILLING_TEXT.unconfirmed;
  return BILLING_TEXT.missing;
}

/** Failed-job sentence: our own for known rev 2 codes, else the sanitised server message. */
export function failedText(error) {
  const own = error?.code ? FAILED_MESSAGES[error.code] : null;
  return own || jobErrorText(error?.message) || "The generation service reported a failure.";
}

/**
 * Card title: the contract has no name field, so "3D concept" plus the created date
 * (a <time> element; this is the card's only "created" line).
 */
function titleEl(doc, job, id, formatDate) {
  const d = job.createdAt ? formatDate(job.createdAt) : "—";
  if (d === "—") return el(doc, "h3", { class: "fcg-card-title", id, text: "3D concept" });
  return el(doc, "h3", { class: "fcg-card-title", id }, "3D concept · ", el(doc, "time", { datetime: job.createdAt, "data-created": "", text: d }));
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
    const msgId = `${ctx.idPrefix}-asset-${key.replace(/[^A-Za-z0-9_-]/g, "_")}`;
    wrap.appendChild(
      el(doc, "p", {
        class: "fcg-msg fcg-msg-error",
        id: msgId,
        "data-asset-error": a.code,
        text: ASSET_MESSAGES[a.kind] || ASSET_MESSAGES[ERROR_KIND.REQUEST],
      }),
    );
    // User-initiated only: the request runs again when this is clicked, never by itself.
    if (canUserRetryAsset(a)) {
      const again = el(doc, "button", {
        type: "button",
        class: "fcg-btn",
        "data-action": "retry-asset",
        "data-retry-for": a.action,
        "data-focus-key": `retry:${key}`,
        "aria-describedby": msgId,
        text: a.action === "open" ? "Try opening again" : "Try download again",
      });
      again.addEventListener("click", () => ctx.onRetryAsset(job.jobId, output.index, a.action));
      wrap.appendChild(el(doc, "div", { class: "fcg-actions" }, again));
    }
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
  card.setAttribute("data-kind", "concept");
  card.appendChild(thumbnailTile(doc, job, state, ctx));
  const body = el(doc, "div", { class: "fcg-body" });
  // Visible kind label: a concept, never a dimensioned design (no dimensions, no designId, no Studio link).
  body.appendChild(el(doc, "p", { class: "fcg-kind", "data-kind-label": "concept", text: "Concept" }));
  body.appendChild(titleEl(doc, job, titleId, ctx.formatDate));
  const badge = el(
    doc,
    "p",
    { class: "fcg-badge", "data-status": known ? job.status : "unknown", "data-error": jobErr ? jobErr.kind : null },
    isNonTerminal(job.status) && !jobErr ? el(doc, "span", { class: "fcg-spinner", "aria-hidden": "true" }) : null,
    el(doc, "span", { class: "fcg-badge-text", text: jobErr ? JOB_ERROR_LABEL[jobErr.kind] || "Unavailable" : statusLabel(job.status) }),
  );
  body.appendChild(badge);

  const meta = el(doc, "dl", { class: "fcg-meta" });
  meta.appendChild(metaRow(doc, "Result", el(doc, "span", { "data-result": job.status === JOB_STATUS.SUCCEEDED && !jobErr && job.outputs.length ? "available" : "none", text: resultText(job, jobErr) })));
  meta.appendChild(metaRow(doc, "Updated", timeEl(doc, job.updatedAt, ctx.formatDate)));
  meta.appendChild(metaRow(doc, "Job ID", el(doc, "code", { class: "fcg-id", text: job.jobId })));
  if (job.sourceReferenceId) {
    meta.appendChild(metaRow(doc, "Reference", el(doc, "code", { class: "fcg-id", text: job.sourceReferenceId })));
  }
  if (job.model || job.provider) {
    meta.appendChild(metaRow(doc, "Model", doc.createTextNode([job.model, job.provider && `(${job.provider})`].filter(Boolean).join(" "))));
  }
  if (job.status === JOB_STATUS.SUCCEEDED && job.durableCopy === false) {
    meta.appendChild(
      metaRow(doc, "File storage", el(doc, "span", { "data-durable-copy": "false", text: "Held by the generation service only. FurniAI keeps no copy, so it may stop being available." })),
    );
  }
  meta.appendChild(metaRow(doc, "Billing", el(doc, "span", { "data-billing": job.billing?.outcome || "unknown", text: billingText(job) })));
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
        failedText(job.error),
      ),
    );
  } else if (job.status === JOB_STATUS.SUBMISSION_UNKNOWN) {
    body.appendChild(
      el(doc, "p", { class: "fcg-msg fcg-msg-warn", "data-submission-unknown": "" }, el(doc, "strong", { text: "May have been charged. " }), SUBMISSION_UNKNOWN_WARNING),
    );
    body.appendChild(el(doc, "p", { class: "fcg-hint", "data-prior-submission-unknown": "", text: PRIOR_SUBMISSION_UNKNOWN_CARD_NOTE }));
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

/** Failed requests that must never be mistaken for an empty gallery get this lead line. */
const NOT_EMPTY_KINDS = new Set(["network", "server", "rate_limited", "provider_unavailable", "provider_refused", "malformed", "request", "integrity", "not_found"]);

function panel(doc, kind, message, retry) {
  const p = el(doc, "div", { class: "fcg-panel", "data-panel": kind, role: kind === "empty" ? null : "alert" });
  if (NOT_EMPTY_KINDS.has(kind)) {
    p.appendChild(el(doc, "p", { class: "fcg-panel-title", "data-not-empty": "", text: "Your concepts couldn't be loaded. This doesn't mean you have none." }));
  }
  p.appendChild(el(doc, "p", { class: "fcg-panel-text", text: message }));
  if (retry) {
    const b = el(doc, "button", { type: "button", class: "fcg-btn", "data-action": "retry", "data-focus-key": "retry", text: "Try again" });
    b.addEventListener("click", retry);
    p.appendChild(b);
  }
  return p;
}

/** Renders the variable part of the gallery into `body`. */
export function renderBody(doc, body, state, ctx) {
  if (state.list === LIST_STATUS.ERROR) {
    // The error panel is role=alert: re-inserting an identical one on an unrelated re-render (a
    // late Open/Download settling, a second 403 channel) would announce it again. Keep the node.
    const kind = state.error?.kind || ERROR_KIND.REQUEST;
    const sig = `${kind}|${state.error?.code || ""}|${kind === ERROR_KIND.SIGNED_OUT && typeof ctx.onSignIn === "function" ? 1 : 0}`;
    if (body.getAttribute("data-error-panel") === sig && body.firstChild) return;
    body.setAttribute("data-error-panel", sig);
  } else if (body.getAttribute("data-error-panel") !== null) {
    body.removeAttribute("data-error-panel");
  }
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
    // Try again only where trying again can help (QE PJ-1); the header Refresh always stays.
    const p = panel(doc, kind, LIST_MESSAGES[kind] || LIST_MESSAGES[ERROR_KIND.REQUEST], USER_RETRY_KINDS.has(kind) ? ctx.onRefresh : null);
    if (state.error?.code) p.setAttribute("data-code", state.error.code);
    // 401 only: a Sign in button, and only when the host injected onSignIn (no navigation is invented).
    // 403 never gets one: signing in again doesn't change a permission refusal.
    if (kind === ERROR_KIND.SIGNED_OUT && typeof ctx.onSignIn === "function") {
      const b = el(doc, "button", { type: "button", class: "fcg-btn fcg-btn-primary", "data-action": "sign-in", "data-focus-key": "sign-in", text: "Sign in" });
      b.addEventListener("click", ctx.onSignIn);
      p.appendChild(b);
    }
    body.appendChild(p);
    return;
  }
  if (state.availability) body.appendChild(availabilityNote(doc, state.availability));
  if (!state.jobs.length) {
    body.appendChild(panel(doc, "empty", "No 3D concepts yet. The server has none for this account; concepts you generate will appear here."));
    return;
  }
  if (state.pollPaused) body.appendChild(pausedNote(doc, state, ctx));
  if (state.truncated) {
    body.appendChild(el(doc, "p", { class: "fcg-hint", "data-truncated": "", text: `Showing your newest ${LIST_LIMIT} concepts. Older ones aren't listed here yet.` }));
  }
  const list = el(doc, "ul", { class: "fcg-list" });
  state.jobs.forEach((job, n) => list.appendChild(el(doc, "li", { class: "fcg-item" }, renderCard(doc, job, state, ctx, n))));
  body.appendChild(list);
}

const AVAILABILITY_REASON = Object.freeze({
  not_configured: "it isn't set up on this deployment",
  disabled: "it's switched off",
  no_budget: "no per-concept budget is set",
});

/** GET ?resource=config: whether NEW concepts can be generated. The list above is unaffected. */
function availabilityNote(doc, a) {
  if (a.state === "ready") {
    const cap = a.maxCostPerJob === null ? "" : ` Budget limit per concept: ${a.maxCostPerJob} provider units (unit unverified).`;
    return el(doc, "p", { class: "fcg-hint", "data-availability": "ready", text: `Generating new concepts is available.${cap}` });
  }
  if (a.state === "off") {
    const why = a.reasons.map((r) => AVAILABILITY_REASON[r]).filter(Boolean).join("; ");
    return el(doc, "p", { class: "fcg-msg fcg-msg-warn", "data-availability": "off", text: `Generating new concepts is unavailable: ${why}. Your existing concepts are still listed.` });
  }
  return el(doc, "p", { class: "fcg-hint", "data-availability": "unknown", text: "Couldn't check whether generating new concepts is available right now." });
}

function pausedNote(doc, state, ctx) {
  const busy = state.pollPaused.kind === ERROR_KIND.RATE_LIMITED;
  const text = busy
    ? "Status checks are paused because FurniAI is busy. Your concepts haven't been changed."
    : `Status checks are paused after ${POLL_FAILURES_BEFORE_PAUSE} failed attempts. Your concepts haven't been changed.`;
  const id = `${ctx.idPrefix}-paused`;
  const b = el(doc, "button", { type: "button", class: "fcg-btn", "data-action": "resume-polling", "data-focus-key": "resume-polling", "aria-describedby": id, text: "Check status again" });
  b.addEventListener("click", () => ctx.onResumePolling());
  return el(doc, "div", { class: "fcg-msg fcg-msg-warn fcg-paused", "data-poll-paused": state.pollPaused.code || "" }, el(doc, "p", { id, text }), b);
}

/** Text for the polite live region. */
export function pollingText(state, nextDelayMs) {
  if (state.list !== LIST_STATUS.READY) return "";
  const n = state.jobs.filter((j) => isNonTerminal(j.status) && !state.jobErrors[j.jobId]).length;
  if (!n) return "";
  if (state.pollPaused) return "Status checks paused.";
  if (!state.polling) return "";
  if (state.pollFailures > 0) {
    const s = Math.round((nextDelayMs || 0) / 1000);
    return `The last status check didn't go through. Checking again in ${s} s.`;
  }
  return n === 1 ? "Checking 1 concept for updates…" : `Checking ${n} concepts for updates…`;
}
