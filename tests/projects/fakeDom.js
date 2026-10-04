/**
 * Minimal DOM for the concept-gallery tests (the repo has no jsdom/happy-dom).
 * Pattern copied from src/lib/designs/myDesigns/__tests__/fakeDom.js, not
 * imported, plus document visibility, focus and attribute lookup.
 *
 * innerHTML / outerHTML / insertAdjacentHTML THROW, so any markup-from-data
 * path in the gallery fails the test.
 */
class FakeNode {
  constructor(doc) {
    this.ownerDocument = doc;
    this.parentNode = null;
    this.childNodes = [];
  }
  get firstChild() {
    return this.childNodes[0] || null;
  }
  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    this.childNodes.push(child);
    child.parentNode = this;
    return child;
  }
  removeChild(child) {
    const i = this.childNodes.indexOf(child);
    if (i < 0) throw new Error("removeChild: not a child");
    this.childNodes.splice(i, 1);
    child.parentNode = null;
    return child;
  }
  get textContent() {
    return this.childNodes.map((c) => c.textContent).join("");
  }
}

class FakeText extends FakeNode {
  constructor(doc, text) {
    super(doc);
    this.nodeType = 3;
    this.data = String(text);
  }
  get textContent() {
    return this.data;
  }
}

class FakeElement extends FakeNode {
  constructor(doc, tag) {
    super(doc);
    this.nodeType = 1;
    this.tagName = String(tag).toUpperCase();
    this.attributes = new Map();
    this.listeners = new Map();
    this.disabled = false;
  }
  get children() {
    return this.childNodes.filter((c) => c.nodeType === 1);
  }
  get className() {
    return this.getAttribute("class") || "";
  }
  get id() {
    return this.getAttribute("id") || "";
  }
  get classList() {
    const names = this.className.split(/\s+/).filter(Boolean);
    return { contains: (n) => names.includes(n) };
  }
  setAttribute(k, v) {
    this.attributes.set(String(k), String(v));
  }
  getAttribute(k) {
    return this.attributes.has(k) ? this.attributes.get(k) : null;
  }
  hasAttribute(k) {
    return this.attributes.has(k);
  }
  removeAttribute(k) {
    this.attributes.delete(k);
  }
  get textContent() {
    return super.textContent;
  }
  set textContent(v) {
    for (const c of [...this.childNodes]) this.removeChild(c);
    if (v !== "" && v != null) this.appendChild(new FakeText(this.ownerDocument, v));
  }
  set innerHTML(_v) {
    throw new Error("innerHTML is forbidden in the concept gallery");
  }
  get innerHTML() {
    throw new Error("innerHTML is forbidden in the concept gallery");
  }
  set outerHTML(_v) {
    throw new Error("outerHTML is forbidden");
  }
  insertAdjacentHTML() {
    throw new Error("insertAdjacentHTML is forbidden");
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }
  focus() {
    this.ownerDocument.activeElement = this;
  }
  click() {
    if (this.disabled) return;
    const ev = { type: "click", target: this, preventDefault() {}, stopPropagation() {} };
    for (const fn of [...(this.listeners.get("click") || [])]) fn(ev);
  }
}

export function createFakeDocument() {
  const listeners = new Map();
  const doc = {
    hidden: false,
    visibilityState: "visible",
    activeElement: null,
    createElement: (tag) => new FakeElement(doc, tag),
    createTextNode: (text) => new FakeText(doc, text),
    getElementById: (id) => findAll(doc.documentElement, (n) => n.id === id)[0] || null,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    listenerCount: (type) => listeners.get(type)?.size || 0,
    /** Flip visibility and fire visibilitychange like a browser tab switch. */
    setHidden(hidden) {
      doc.hidden = hidden;
      doc.visibilityState = hidden ? "hidden" : "visible";
      for (const fn of [...(listeners.get("visibilitychange") || [])]) fn({ type: "visibilitychange" });
    },
  };
  doc.documentElement = new FakeElement(doc, "html");
  doc.head = doc.documentElement.appendChild(new FakeElement(doc, "head"));
  doc.body = doc.documentElement.appendChild(new FakeElement(doc, "body"));
  return doc;
}

export function findAll(root, pred) {
  const out = [];
  const walk = (n) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 1) {
        if (pred(c)) out.push(c);
        walk(c);
      }
    }
  };
  if (root) walk(root);
  return out;
}

export const byClass = (root, cls) => findAll(root, (n) => n.classList.contains(cls));
export const byTag = (root, tag) => findAll(root, (n) => n.tagName === tag.toUpperCase());
export const byAttr = (root, k, v) => findAll(root, (n) => (v === undefined ? n.hasAttribute(k) : n.getAttribute(k) === v));
export const allAttributeValues = (root) => findAll(root, () => true).flatMap((n) => [...n.attributes.values()]);

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Settle queued microtasks (works under vi.useFakeTimers too). */
export async function flush(times = 20) {
  for (let i = 0; i < times; i++) await Promise.resolve();
}
