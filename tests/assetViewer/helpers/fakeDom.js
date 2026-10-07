/**
 * Just enough DOM for the viewer core in vitest's node environment
 * (no jsdom in this repo, and adding a dev dependency is out of scope).
 */
export class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.style = { cssText: "", display: "" };
    this.textContent = "";
    this.clientWidth = 0;
    this.clientHeight = 0;
    this.listeners = {};
    this.clicks = 0;
  }
  get firstChild() {
    return this.children[0] || null;
  }
  appendChild(c) {
    if (c.parentNode) c.parentNode.removeChild(c);
    this.children.push(c);
    c.parentNode = this;
    return c;
  }
  insertBefore(c, ref) {
    if (c.parentNode) c.parentNode.removeChild(c);
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i < 0) this.children.push(c);
    else this.children.splice(i, 0, c);
    c.parentNode = this;
    return c;
  }
  removeChild(c) {
    const i = this.children.indexOf(c);
    if (i < 0) throw new Error("not a child");
    this.children.splice(i, 1);
    c.parentNode = null;
    return c;
  }
  setAttribute(k, v) {
    this.attributes[k] = String(v);
  }
  getAttribute(k) {
    return k in this.attributes ? this.attributes[k] : null;
  }
  addEventListener(t, fn) {
    (this.listeners[t] ||= new Set()).add(fn);
  }
  removeEventListener(t, fn) {
    this.listeners[t] && this.listeners[t].delete(fn);
  }
  click() {
    this.clicks++;
  }
  /** test helper: run this element's listeners for `type` (as a real dispatchEvent would). */
  dispatch(type, ev = {}) {
    const e = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...ev };
    for (const fn of [...(this.listeners[type] || [])]) fn(e);
    return e;
  }
  focus() {
    this.ownerDocument.activeElement = this;
  }
  /** depth-first search by attribute name */
  find(attr) {
    if (attr in this.attributes) return this;
    for (const c of this.children) {
      const f = c.find ? c.find(attr) : null;
      if (f) return f;
    }
    return null;
  }
  get listenerCount() {
    return Object.values(this.listeners).reduce((n, s) => n + s.size, 0);
  }
}

export class FakeResizeObserver {
  static instances = [];
  constructor(cb) {
    this.cb = cb;
    this.observed = [];
    this.disconnected = false;
    FakeResizeObserver.instances.push(this);
  }
  observe(el) {
    this.observed.push(el);
  }
  disconnect() {
    this.disconnected = true;
    this.observed = [];
  }
}

export function createFakeDocument({ width = 640, height = 480, raf = null, resizeObserver = true } = {}) {
  const created = [];
  const winListeners = {};
  const win = {
    devicePixelRatio: 1,
    ResizeObserver: resizeObserver ? FakeResizeObserver : undefined,
    addEventListener(t, fn) {
      (winListeners[t] ||= new Set()).add(fn);
    },
    removeEventListener(t, fn) {
      winListeners[t] && winListeners[t].delete(fn);
    },
    get listenerCount() {
      return Object.values(winListeners).reduce((n, set) => n + set.size, 0);
    },
    dispatch(t) {
      for (const fn of [...(winListeners[t] || [])]) fn({ type: t });
    },
    URL: {
      created: [],
      revoked: [],
      createObjectURL(blob) {
        const u = `blob:fake/${this.created.length}`;
        this.created.push({ u, blob });
        return u;
      },
      revokeObjectURL(u) {
        this.revoked.push(u);
      },
    },
  };
  if (raf) {
    win.requestAnimationFrame = raf.request;
    win.cancelAnimationFrame = raf.cancel;
  }
  const doc = {
    defaultView: win,
    createElement(tag) {
      const el = new FakeElement(tag, doc);
      created.push(el);
      return el;
    },
    created,
  };
  const container = new FakeElement("div", doc);
  container.clientWidth = width;
  container.clientHeight = height;
  return { doc, win, container };
}

/** Manual requestAnimationFrame: frames only run when flush() is called. */
export function createManualRaf() {
  let next = 1;
  const queue = new Map();
  const cancelled = [];
  return {
    request: (fn) => {
      const id = next++;
      queue.set(id, fn);
      return id;
    },
    cancel: (id) => {
      cancelled.push(id);
      queue.delete(id);
    },
    flush() {
      const fns = [...queue.values()];
      queue.clear();
      fns.forEach((f) => f(0));
      return fns.length;
    },
    get pending() {
      return queue.size;
    },
    cancelled,
  };
}
