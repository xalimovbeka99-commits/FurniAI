/**
 * A stand-in for Asset Engineer's mountAssetViewer (src/lib/assetViewer, v2.1 at b34e259) for
 * unit tests. It records load() calls and drives the REAL injected creative source, so the
 * gallery sees the same { ok, error: { code, serverCode, status, details } } results the viewer
 * returns, and getState().concept as the viewer reports it (normalizeConcept, noticeSource).
 */
import { isRetryableResolveError, normalizeConcept } from "../../../src/lib/assetViewer/creativeAsset.js";

export function fakeViewerFactory(behaviour = async () => ({ ok: true })) {
  const made = [];
  const factory = (el, opts) => {
    const v = {
      el,
      opts,
      loads: [],
      urls: [],
      resolves: 0,
      concept: null,
      disposed: false,
      async load(ref) {
        v.loads.push(ref);
        v.concept = normalizeConcept(ref.concept); // v2.1: set from the first state, fallback if none
        return behaviour(v, ref, opts.creativeSource);
      },
      getState() {
        return { concept: v.concept };
      },
      dispose() {
        v.disposed = true;
      },
    };
    made.push(v);
    return v;
  };
  factory.made = made;
  return factory;
}

const errorRecord = (e) => ({ code: e.code, serverCode: e.serverCode, status: e.status, details: e.details });

/**
 * Mimics v2.1 creativeFlow: resolve (V1: one more resolve if the first fails retryably) ->
 * display; on a display failure re-resolve once (not retried again) and display once more.
 */
export const v2Like = (displayResults) => async (v, ref, source) => {
  const resolve = async (allowRetry) => {
    v.resolves++;
    try {
      return await source.resolve(ref.jobId, ref.index);
    } catch (e) {
      if (allowRetry && isRetryableResolveError(e)) return resolve(false);
      throw e;
    }
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    let d;
    try {
      d = await resolve(attempt === 0);
    } catch (e) {
      return { ok: false, error: errorRecord(e) };
    }
    v.concept = d.concept || v.concept;
    v.urls.push(d.url);
    const r = displayResults.length ? displayResults.shift() : "ok";
    if (r === "ok") return { ok: true };
  }
  return { ok: false, error: { code: "ASSET_DISPLAY_FAILED" } };
};
