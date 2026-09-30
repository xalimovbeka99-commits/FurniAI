/**
 * Demo driver: mounts the REAL module with the FAKE client, one scenario per
 * state. Bundled by demo/my-designs/build-demo.mjs into a temp dir.
 */
import { mountMyDesigns } from "../../src/lib/designs/myDesigns/mountMyDesigns.js";
import { createFakeDesignsApiClient, demoSeed, fakeErrors } from "../../src/lib/designs/myDesigns/fakeDesignsApiClient.js";

const never = () => new Promise(() => {});
const seed = demoSeed();
const [BEDROOM, , , SHELL] = seed.designs;

/** @type {Record<string, { label: string, client: () => object, token?: string|null, open?: string }>} */
const SCENARIOS = {
  loading: { label: "Loading", client: () => createFakeDesignsApiClient({ ...seed, gate: never }) },
  empty: { label: "Empty", client: () => createFakeDesignsApiClient({ designs: [] }) },
  "signed-out": { label: "Signed out (no session)", token: null, client: () => createFakeDesignsApiClient(seed) },
  "error-401": { label: "401 expired", client: () => createFakeDesignsApiClient({ ...seed, fail: { listDesigns: fakeErrors.missingAuth() } }) },
  "error-network": { label: "Network", client: () => createFakeDesignsApiClient({ ...seed, fail: { listDesigns: fakeErrors.network() } }) },
  "error-5xx": { label: "5xx", client: () => createFakeDesignsApiClient({ ...seed, fail: { listDesigns: fakeErrors.storageUnavailable() } }) },
  "error-not-configured": { label: "503 not configured", client: () => createFakeDesignsApiClient({ ...seed, fail: { listDesigns: fakeErrors.notConfigured() } }) },
  list: { label: "List", client: () => createFakeDesignsApiClient(seed) },
  opening: { label: "Opening", open: BEDROOM.designId, client: () => createFakeDesignsApiClient({ ...seed, gate: (m) => (m === "getRevision" ? never() : undefined) }) },
  opened: { label: "Opened", open: BEDROOM.designId, client: () => createFakeDesignsApiClient(seed) },
  "open-404": { label: "Open 404", open: BEDROOM.designId, client: () => createFakeDesignsApiClient({ ...seed, fail: { getDesign: fakeErrors.notFound() } }) },
  "open-no-revision": { label: "Open: no revision", open: SHELL.designId, client: () => createFakeDesignsApiClient(seed) },
  "open-integrity": { label: "Open 409 integrity", open: BEDROOM.designId, client: () => createFakeDesignsApiClient({ ...seed, fail: { getRevision: fakeErrors.integrity(2) } }) },
  "open-network": { label: "Open network", open: BEDROOM.designId, client: () => createFakeDesignsApiClient({ ...seed, fail: { getRevision: fakeErrors.network() } }) },
};

const bar = document.getElementById("demoBar");
const root = document.getElementById("myDesignsRoot");
const log = document.getElementById("studioLog");
let handle = null;

function run(name) {
  const sc = SCENARIOS[name] || SCENARIOS.list;
  if (handle) handle.destroy();
  log.textContent = "onOpenDesign: (not called)";
  document.body.removeAttribute("data-demo-ready");
  for (const b of bar.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.state === name));
  const token = "token" in sc ? sc.token : "demo-token";
  handle = mountMyDesigns(root, {
    client: sc.client(),
    getAccessToken: async () => token,
    onSignIn: () => { log.textContent = "onSignIn() called — the Studio would open its sign-in modal."; },
    onOpenDesign: (selection, record) => {
      log.textContent =
        "onOpenDesign(selection, record)\nselection = " + JSON.stringify(selection) +
        "\nrecord.fingerprint = " + JSON.stringify(record.fingerprint) +
        "  record.validationStatus = " + JSON.stringify(record.validationStatus);
    },
  });
  const ready = () => document.body.setAttribute("data-demo-ready", name);
  setTimeout(async () => {
    if (sc.open) await Promise.race([handle.openDesign(sc.open), new Promise((r) => setTimeout(r, 150))]);
    ready();
  }, 50);
  const url = new URL(location.href);
  url.searchParams.set("state", name);
  history.replaceState(null, "", url);
}

for (const [name, sc] of Object.entries(SCENARIOS)) {
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.state = name;
  b.textContent = sc.label;
  b.addEventListener("click", () => run(name));
  bar.appendChild(b);
}
window.__myDesignsDemo = { scenarios: Object.keys(SCENARIOS), run };
run(new URL(location.href).searchParams.get("state") || "list");
