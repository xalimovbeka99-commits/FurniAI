/**
 * My Designs — DOM rendering. Framework-free.
 *
 * Rules:
 *  - Every string from a response is written with `textContent` or
 *    `setAttribute`. There is no `innerHTML` anywhere in this module.
 *  - The header, the live status line and the alert region are created once
 *    and persist, so assistive tech keeps its live-region subscriptions.
 *  - The list body is rebuilt only when the list state object changes; open
 *    progress only toggles attributes on the existing buttons, so focus stays
 *    where the customer left it.
 */

import { LIST_STATUS, OPEN_STATUS, ERROR_KIND, OPEN_DISABLED_NOTICE, messageFor } from "./state.js";

let instanceCounter = 0;

/**
 * @param {Document} doc
 * @param {HTMLElement} rootEl
 * @param {{
 *   onRefresh: () => void,
 *   onOpen: (designId: string) => void,
 *   onDismiss: () => void,
 *   onSignIn?: (() => void) | null,
 *   formatDate: (iso: string|null) => string,
 *   title?: string,
 *   openEnabled?: boolean,
 * }} handlers
 */
export function createView(doc, rootEl, handlers) {
  const n = ++instanceCounter;
  const titleId = `fmd-title-${n}`;
  const listeners = [];
  const on = (el, type, fn) => {
    el.addEventListener(type, fn);
    listeners.push([el, type, fn]);
  };

  const section = el(doc, "section", { class: "fmd", "aria-labelledby": titleId, "aria-busy": "false" });
  const head = el(doc, "div", { class: "fmd-head" });
  const title = el(doc, "h2", { class: "fmd-title", id: titleId }, handlers.title || "My designs");
  const refreshBtn = el(doc, "button", { type: "button", class: "fmd-refresh" }, "Refresh");
  on(refreshBtn, "click", () => handlers.onRefresh());
  head.appendChild(title);
  head.appendChild(refreshBtn);

  const openEnabled = handlers.openEnabled !== false;
  const noticeId = `fmd-notice-${n}`;
  const status = el(doc, "p", { class: "fmd-status", role: "status", "aria-live": "polite" });
  const alert = el(doc, "div", { class: "fmd-alert", role: "alert" });
  const body = el(doc, "div", { class: "fmd-body" });

  section.appendChild(head);
  section.appendChild(status);
  if (!openEnabled) {
    section.setAttribute("data-open-enabled", "false");
    section.appendChild(el(doc, "p", { class: "fmd-notice", id: noticeId }, OPEN_DISABLED_NOTICE));
  }
  section.appendChild(alert);
  section.appendChild(body);
  rootEl.appendChild(section);

  /** @type {Map<string, HTMLButtonElement>} */
  let openButtons = new Map();
  let renderedList = null;
  let renderedOpen = null;
  // Listeners attached to per-render body elements; dropped with the body.
  let bodyListeners = [];
  const onBody = (node, type, fn) => {
    node.addEventListener(type, fn);
    bodyListeners.push([node, type, fn]);
  };

  function clearBody() {
    for (const [node, type, fn] of bodyListeners) node.removeEventListener(type, fn);
    bodyListeners = [];
    clear(body);
    openButtons = new Map();
  }

  function renderList(list) {
    clearBody();
    section.setAttribute("data-list-state", list.status);
    if (list.status === LIST_STATUS.IDLE || list.status === LIST_STATUS.LOADING) {
      const wrap = el(doc, "div", { class: "fmd-loading" });
      for (let i = 0; i < 3; i++) wrap.appendChild(el(doc, "div", { class: "fmd-skeleton", "aria-hidden": "true" }));
      body.appendChild(wrap);
      return;
    }
    if (list.status === LIST_STATUS.EMPTY) {
      const panel = el(doc, "div", { class: "fmd-panel fmd-empty" });
      panel.appendChild(el(doc, "p", {}, "You have no saved designs yet."));
      panel.appendChild(el(doc, "p", { class: "fmd-meta" }, "Designs you save from the Studio appear here."));
      body.appendChild(panel);
      return;
    }
    if (list.status === LIST_STATUS.ERROR) {
      const kind = list.error ? list.error.kind : ERROR_KIND.SERVER;
      const panel = el(doc, "div", { class: "fmd-panel fmd-error", "data-kind": kind, role: "alert" });
      if (list.error && list.error.code) panel.setAttribute("data-code", list.error.code);
      panel.appendChild(el(doc, "p", {}, messageFor(list.error, "list")));
      const actions = el(doc, "div", { class: "fmd-panel-actions" });
      if (kind === ERROR_KIND.SIGNED_OUT && typeof handlers.onSignIn === "function") {
        const signIn = el(doc, "button", { type: "button", class: "fmd-primary fmd-signin" }, "Sign in");
        onBody(signIn, "click", () => handlers.onSignIn());
        actions.appendChild(signIn);
      }
      const retry = el(doc, "button", { type: "button", class: "fmd-action fmd-retry" }, "Try again");
      onBody(retry, "click", () => handlers.onRefresh());
      actions.appendChild(retry);
      panel.appendChild(actions);
      body.appendChild(panel);
      return;
    }
    // LIST
    const ul = el(doc, "ul", { class: "fmd-list", "aria-label": "Saved designs" });
    list.designs.forEach((d, i) => {
      const li = el(doc, "li", { class: "fmd-item" });
      const metaId = `fmd-meta-${n}-${i}`;
      const btn = el(doc, "button", {
        type: "button",
        class: "fmd-open",
        "data-design-id": d.designId,
        "aria-describedby": openEnabled ? metaId : `${metaId} ${noticeId}`,
      });
      if (!openEnabled) btn.disabled = true;
      btn.appendChild(el(doc, "span", { class: "fmd-name" }, d.name && d.name.trim() ? d.name : "Untitled design"));
      const when = handlers.formatDate(d.updatedAt || d.createdAt);
      btn.appendChild(el(doc, "span", { class: "fmd-meta", id: metaId }, when ? `Updated ${when}` : "Saved design"));
      onBody(btn, "click", () => handlers.onOpen(d.designId));
      li.appendChild(btn);
      ul.appendChild(li);
      openButtons.set(d.designId, btn);
    });
    body.appendChild(ul);
  }

  function renderOpen(open) {
    const opening = open.status === OPEN_STATUS.OPENING;
    for (const [id, btn] of openButtons) {
      btn.disabled = opening || !openEnabled;
      if (opening && id === open.designId) btn.setAttribute("aria-busy", "true");
      else btn.removeAttribute("aria-busy");
      if (open.status === OPEN_STATUS.OPENED && id === open.designId) btn.setAttribute("aria-current", "true");
      else btn.removeAttribute("aria-current");
    }
    refreshBtn.disabled = opening;
    section.setAttribute("data-open-state", open.status);

    clear(alert);
    if (open.status === OPEN_STATUS.ERROR) {
      const kind = open.error ? open.error.kind : ERROR_KIND.SERVER;
      alert.setAttribute("data-kind", kind);
      alert.appendChild(el(doc, "span", { class: "fmd-alert-text" }, messageFor(open.error, "open")));
      const actions = el(doc, "span", { class: "fmd-panel-actions" });
      if (kind === ERROR_KIND.SIGNED_OUT && typeof handlers.onSignIn === "function") {
        const signIn = el(doc, "button", { type: "button", class: "fmd-primary fmd-signin" }, "Sign in");
        signIn.addEventListener("click", () => handlers.onSignIn());
        actions.appendChild(signIn);
      }
      const dismiss = el(doc, "button", { type: "button", class: "fmd-action fmd-dismiss" }, "Dismiss");
      dismiss.addEventListener("click", () => handlers.onDismiss());
      actions.appendChild(dismiss);
      alert.appendChild(actions);
    } else {
      alert.removeAttribute("data-kind");
    }
  }

  function renderStatus(state) {
    const { list, open } = state;
    let text = "";
    if (open.status === OPEN_STATUS.OPENING) text = `Opening ${quote(open.name)}…`;
    else if (open.status === OPEN_STATUS.OPENED) text = `Opened ${quote(open.name)} (revision ${open.revision}).`;
    else if (list.status === LIST_STATUS.LOADING || list.status === LIST_STATUS.IDLE) text = "Loading your designs…";
    else if (list.status === LIST_STATUS.LIST) text = `${list.designs.length} saved design${list.designs.length === 1 ? "" : "s"}.`;
    else if (list.status === LIST_STATUS.EMPTY) text = "No saved designs.";
    status.textContent = text;
    const busy = list.status === LIST_STATUS.LOADING || open.status === OPEN_STATUS.OPENING;
    section.setAttribute("aria-busy", busy ? "true" : "false");
  }

  return {
    section,
    /** @param {import("./state.js").MyDesignsState} state */
    update(state) {
      if (state.list !== renderedList) {
        renderList(state.list);
        renderedList = state.list;
        renderedOpen = null; // buttons are new; re-apply open attributes
      }
      if (state.open !== renderedOpen) {
        renderOpen(state.open);
        renderedOpen = state.open;
      }
      renderStatus(state);
    },
    destroy() {
      clearBody();
      for (const [node, type, fn] of listeners) node.removeEventListener(type, fn);
      listeners.length = 0;
      clear(alert);
      if (section.parentNode) section.parentNode.removeChild(section);
    },
  };
}

function quote(name) {
  return name && name.trim() ? `“${name}”` : "design";
}

/**
 * Create an element with attributes and optional text. Text goes through
 * textContent, so it is never parsed as markup.
 */
function el(doc, tag, attrs = {}, text) {
  const node = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    if (k === "class") node.className = String(v);
    else node.setAttribute(k, String(v));
  }
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Inject module styles once per document. */
export function ensureStyles(doc, id, css) {
  if (!doc || typeof doc.getElementById !== "function") return;
  if (doc.getElementById(id)) return;
  const style = doc.createElement("style");
  style.setAttribute("id", id);
  style.textContent = css;
  (doc.head || doc.documentElement || doc.body).appendChild(style);
}

export function defaultFormatDate(iso) {
  if (typeof iso !== "string" || !iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
