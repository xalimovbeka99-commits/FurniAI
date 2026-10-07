/* DEMO-ONLY host script (classic script, like the static site). See host.html.
 * Evidence taxonomy (integration lead): every state is exactly one of
 *   SYNTHETIC/MOCKED  a synthetic fixture file loaded as-is (no server behaviour staged)
 *   SIMULATED         a staged environment: slow/404/410/403 routes, stubbed WebGL, the
 *                     fixture-backed /api/creative stand-in
 *   LIVE              real provider output; NOTHING on this page is LIVE.
 */
(function () {
  "use strict";
  var q = new URLSearchParams(location.search);
  var state = q.get("state") || "loaded";
  var BOX = "/docs/creative/fixtures/SYNTHETIC-box-not-scenario-generated.glb";
  var SCEN = "/tests/fixtures/scenario/";
  var INVALID = { "bad-magic": 1, "html-as": 1, truncated: 1, "no-mesh": 1 };
  var file = INVALID[q.get("file")] ? q.get("file") : "bad-magic";
  var http = /^(403|404|410|500|cors)$/.test(q.get("http") || "") ? q.get("http") : "404";
  var webgl = /^(none|throw|lost)$/.test(q.get("webgl") || "") ? q.get("webgl") : "none";
  var job = /^(succeeded|processing|failed|submission-unknown)$/.test(q.get("job") || "") ? q.get("job") : "succeeded";

  var STATES = {
    idle: ["SIMULATED", "Empty host page, nothing loaded"],
    loaded: ["SYNTHETIC/MOCKED", "Contract fixture SYNTHETIC-box-not-scenario-generated.glb"],
    textured: ["SYNTHETIC/MOCKED", "QE fixture textured-cube.glb (embedded PNG texture)"],
    "texture-missing": ["SYNTHETIC/MOCKED", "QE fixture missing-texture.glb (texture without image)"],
    loading: ["SIMULATED", "Slow route streams textured-cube.glb over minutes"],
    invalid: ["SYNTHETIC/MOCKED", "QE fixture " + file + ".glb"],
    unavailable: ["SIMULATED", http === "cors" ? "Second origin sends no CORS header (blocked fetch)" : "Route answers HTTP " + http],
    webgl: ["SIMULATED", "WebGL stubbed: " + webgl],
    replace: ["SYNTHETIC/MOCKED", "textured-cube.glb replaced by the SYNTHETIC box"],
    job: ["SIMULATED", "rev 2 fixture pack via /__rev2/api/creative, job " + job],
    forbidden: ["SIMULATED", "/__rev2/api/creative answers 403 (page-wide)"],
  };
  if (!STATES[state]) state = "loaded";
  var cls = STATES[state][0];
  var $ = function (id) { return document.getElementById(id); };
  $("evidence-class").textContent = "Evidence: " + cls;
  $("host-evidence").textContent = cls + " · " + STATES[state][1];
  document.title = "[" + cls + "] " + state + " · " + document.title;

  var links = [
    ["loaded", "Loaded"], ["textured", "Textured"], ["texture-missing", "Missing texture"], ["loading", "Loading"],
    ["invalid&file=bad-magic", "Invalid: bad magic"], ["invalid&file=html-as", "Invalid: HTML"], ["invalid&file=truncated", "Invalid: truncated"], ["invalid&file=no-mesh", "Invalid: no mesh"],
    ["unavailable&http=404", "Unavailable 404"], ["unavailable&http=410", "Unavailable 410"], ["unavailable&http=403", "Expired link 403"], ["unavailable&http=cors", "Blocked (CORS)"],
    ["webgl&webgl=none", "No WebGL"], ["webgl&webgl=throw", "WebGL throws"], ["webgl&webgl=lost", "Context lost"],
    ["replace", "Replace"], ["job&job=succeeded", "Job succeeded"], ["job&job=submission-unknown", "Job submission unknown"], ["forbidden", "Forbidden"], ["idle", "Idle"],
  ];
  var here = location.search.replace(/^\?state=/, "");
  links.forEach(function (l) {
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.href = "?state=" + l[0];
    a.textContent = l[1];
    if (l[0] === here || (l[0] === state && here.indexOf("&") < 0)) a.setAttribute("aria-current", "page");
    li.appendChild(a);
    $("host-states").appendChild(li);
  });

  // ---- SIMULATED WebGL failures (before mount) ----
  if (state === "webgl" && webgl !== "lost") {
    var orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type) {
      if (/webgl/i.test(String(type))) {
        if (webgl === "throw") throw new Error("SIMULATED: context creation failed");
        return null;
      }
      return orig.apply(this, arguments);
    };
  }

  var THREE = window.THREE;
  $("host-three").textContent = THREE ? "window.THREE r" + THREE.REVISION + (THREE.GLTFLoader ? " + THREE.GLTFLoader/OrbitControls globals" : " (no loaders)") : "missing";

  var opts = { THREE: THREE };
  var assets = {
    loaded: { url: BOX, demonstration: true },
    textured: { url: SCEN + "textured-cube.glb", demonstration: true },
    "texture-missing": { url: SCEN + "missing-texture.glb", demonstration: true },
    loading: { url: "/__slow" + SCEN + "textured-cube.glb?ms=600000", filename: "textured-cube.glb", demonstration: true },
    invalid: { url: SCEN + file + ".glb", demonstration: true },
    unavailable: {
      url: http === "cors" ? location.protocol + "//" + location.hostname + ":" + (Number(location.port) + 1) + "/__simcdn/blocked.glb" : "/__status/" + http + "/expired-or-missing.glb",
      filename: "expired-or-missing.glb",
      demonstration: true,
    },
    webgl: { url: SCEN + "textured-cube.glb", demonstration: true },
    replace: { url: SCEN + "textured-cube.glb", demonstration: true },
  };
  if (assets[state]) opts.asset = assets[state];
  var C = window.FurniAssetViewerCreative;
  if ((state === "job" || state === "forbidden") && C) {
    opts.creativeSource = C.createCreativeAssetSource({ baseUrl: "/__rev2/api/creative", getAuthToken: function () { return "sim-token"; } });
  }

  var host = (window.__host = { events: [], handle: null, disposed: false });
  var handle = window.FurniAssetViewer.mount($("viewer"), opts);
  host.handle = handle;
  var replaced = false;

  function render(s) {
    var t = s.status + (s.error ? " · " + s.error.code : "") + (s.model ? " · " + s.model.meshCount + " mesh" : "");
    $("host-state").textContent = t;
    var b = s.job && s.job.billing;
    $("host-billing").textContent = b && C ? C.describeBillingOutcome(b.outcome) : "No job";
  }
  handle.on("statechange", function (s) {
    host.events.push(s.status + (s.error ? ":" + s.error.code : ""));
    render(s);
    if (s.status === "ready" && state === "replace" && !replaced) {
      replaced = true;
      handle.load({ url: BOX, demonstration: true });
    }
    if (s.status === "ready" && state === "webgl" && webgl === "lost" && !host.lost) {
      host.lost = true;
      var cv = $("viewer").querySelector("canvas");
      var gl = cv && (cv.getContext("webgl2") || cv.getContext("webgl"));
      var ext = gl && gl.getExtension("WEBGL_lose_context");
      if (ext) setTimeout(function () { ext.loseContext(); }, 50);
    }
  });
  render(handle.getState());

  if (state === "job" && C) {
    fetch("/__rev2/jobs").then(function (r) { return r.json(); }).then(function (jobs) { handle.showJob(jobs[job]); });
  }
  if (state === "forbidden") handle.load({ jobId: "forbidden", index: 0, format: "glb" });

  $("host-replace").addEventListener("click", function () {
    if (host.disposed) return;
    var cur = handle.getState().asset;
    var toBox = !(cur && /SYNTHETIC-box/.test(cur.filename || ""));
    // every fixture is labelled: "Demonstration asset, synthetic fixture, not a generated result"
    handle.load({ url: toBox ? BOX : SCEN + "textured-cube.glb", demonstration: true });
  });
  $("host-navigate").addEventListener("click", function () {
    handle.dispose(); // what the host does on navigation / unmount (idempotent)
    host.disposed = true;
    $("host-state").textContent = "disposed (navigation simulated)";
  });
})();
