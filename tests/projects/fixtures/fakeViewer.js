/**
 * A stand-in for Asset Engineer's mountAssetViewer (src/lib/assetViewer, v2) for unit tests.
 * It records load() calls and drives the REAL injected creative source, so the gallery sees the
 * same { ok, error: { code, serverCode, status } } results the v2 viewer returns.
 */
export function fakeViewerFactory(behaviour = async () => ({ ok: true })) {
  const made = [];
  const factory = (el, opts) => {
    const v = {
      el,
      opts,
      loads: [],
      urls: [],
      disposed: false,
      async load(ref) {
        v.loads.push(ref);
        return behaviour(v, ref, opts.creativeSource);
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

/** Mimics v2 creativeFlow: resolve -> display; on a display failure re-resolve once and retry once. */
export const v2Like = (displayResults) => async (v, ref, source) => {
  for (let attempt = 0; attempt < 2; attempt++) {
    let d;
    try {
      d = await source.resolve(ref.jobId, ref.index);
    } catch (e) {
      return { ok: false, error: { code: e.code, serverCode: e.serverCode, status: e.status } };
    }
    v.urls.push(d.url);
    const r = displayResults.length ? displayResults.shift() : "ok";
    if (r === "ok") return { ok: true };
  }
  return { ok: false, error: { code: "ASSET_DISPLAY_FAILED" } };
};
