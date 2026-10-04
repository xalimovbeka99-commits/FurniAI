import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

export function fixtureBuffer(name) {
  return readFileSync(join(FIXTURE_DIR, name));
}
export function fixtureArrayBuffer(name) {
  const b = fixtureBuffer(name);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

/**
 * three's GLTFLoader decodes embedded PNGs via createImageBitmap (or an
 * <img> element). Node has neither, so tests install a stand-in that
 * returns an ImageBitmap-like object; colour-space and disposal logic is
 * exercised for real, actual pixels are verified in the browser demo.
 */
let shimState = null; // ref-counted so several suites in one worker can share it

export function installImageBitmapShim() {
  if (!shimState) {
    const prev = { self: globalThis.self, createImageBitmap: globalThis.createImageBitmap };
    const bitmaps = [];
    globalThis.self = globalThis;
    globalThis.createImageBitmap = async (blob) => {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const view = new DataView(bytes.buffer);
      const bm = {
        width: view.getUint32(16), // PNG IHDR width/height
        height: view.getUint32(20),
        closed: false,
        close() {
          this.closed = true;
        },
      };
      bitmaps.push(bm);
      return bm;
    };
    shimState = { prev, bitmaps, refs: 0 };
  }
  shimState.refs++;
  let restored = false;
  return {
    bitmaps: shimState.bitmaps,
    restore() {
      if (restored || !shimState) return;
      restored = true;
      if (--shimState.refs > 0) return;
      const { prev } = shimState;
      if (prev.self === undefined) delete globalThis.self;
      else globalThis.self = prev.self;
      if (prev.createImageBitmap === undefined) delete globalThis.createImageBitmap;
      else globalThis.createImageBitmap = prev.createImageBitmap;
      shimState = null;
    },
  };
}

/** fetch() stand-in streaming `bytes` in `chunks` pieces; `gate` lets tests hold the response. */
export function createFakeFetch(routes) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, init });
    const route = routes[url.split("?")[0]] || routes["*"];
    if (!route) return { ok: false, status: 404, statusText: "Not Found", headers: new Map() };
    if (route.gate) await route.gate(init.signal);
    if (init.signal && init.signal.aborted) {
      const e = new Error("aborted");
      e.name = "AbortError";
      throw e;
    }
    if (route.networkError) throw new TypeError("Failed to fetch");
    if (route.status && route.status !== 200) return { ok: false, status: route.status, statusText: route.statusText || "", headers: new Map() };
    const bytes = new Uint8Array(route.bytes);
    const parts = route.chunks || 1;
    const size = Math.ceil(bytes.length / parts);
    const body = new ReadableStream({
      start(c) {
        for (let i = 0; i < bytes.length; i += size) c.enqueue(bytes.slice(i, i + size));
        c.close();
      },
    });
    const headers = new Map([["content-length", route.omitLength ? null : String(bytes.length)]]);
    return { ok: true, status: 200, headers: { get: (k) => headers.get(k) ?? null }, body };
  };
  fn.calls = calls;
  return fn;
}

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
