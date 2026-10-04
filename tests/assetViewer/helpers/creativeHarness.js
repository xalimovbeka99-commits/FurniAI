/**
 * Wires the SIMULATED /api/creative stand-in (fixtures only, not Scenario)
 * to a real viewer core via createCreativeAssetSource.
 */
import { createCreativeAssetSource } from "../../../src/lib/assetViewer/index.js";
import { createCreativeStandIn, SIM_TOKEN } from "./creativeStandIn.js";
import { fixtureBuffer } from "./fixtures.js";
import { mountForTest } from "./mountHarness.js";

export function simFiles() {
  const fbx = fixtureBuffer("simulated-download-only.fbx");
  return {
    "chair-textured.glb": fixtureBuffer("chair-textured.glb"),
    "table-untextured.glb": fixtureBuffer("table-untextured.glb"),
    "corrupt.glb": fixtureBuffer("corrupt.glb"),
    "simulated-download-only.fbx": fbx,
    "simulated-asset.bin": fbx,
    "simulated-download-only.zip": fbx,
  };
}

/** Immediate timers that record the requested delay (watchJob polling). */
export function createInstantTimers() {
  const delays = [];
  const cleared = [];
  let id = 0;
  return {
    delays,
    cleared,
    setTimeout(fn, ms) {
      delays.push(ms);
      const h = ++id;
      setImmediate(fn);
      return h;
    },
    clearTimeout(h) {
      cleared.push(h);
    },
  };
}

export function mountCreative({ standIn, token = SIM_TOKEN, getAuthToken, options = {}, jobs } = {}) {
  const sim = standIn || createCreativeStandIn({ files: simFiles(), jobs });
  const apiCalls = [];
  const apiFetch = (url, init) => {
    apiCalls.push({ url: String(url), init });
    return sim.fetch(url, init);
  };
  const tokenCalls = { n: 0 };
  const source = createCreativeAssetSource({
    fetchImpl: apiFetch,
    getAuthToken:
      getAuthToken ||
      (() => {
        tokenCalls.n += 1;
        return token;
      }),
  });
  const cdnCalls = [];
  const cdnFetch = (url, init) => {
    cdnCalls.push({ url: String(url), init });
    return sim.fetch(url, init);
  };
  const t = mountForTest({ options: { fetch: cdnFetch, creativeSource: source, ...options } });
  return { ...t, sim, source, apiCalls, cdnCalls, tokenCalls };
}

/** Every <a> the viewer created and clicked (download({ save:true })). */
export function clickedAnchors(doc) {
  return doc.created.filter((e) => e.tagName === "A" && e.clicks > 0);
}
