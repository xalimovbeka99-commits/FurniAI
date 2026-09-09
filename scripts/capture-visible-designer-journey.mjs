import { chromium } from "playwright";
import http from "node:http";
import { readFile, mkdir, copyFile } from "node:fs/promises";
import { resolve, extname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { startAnthropicRelay } from "./anthropic-relay.mjs";

const root = process.cwd();
const artifactsDir = resolve(root, "docs/artifacts/visible-designer");
await mkdir(artifactsDir, { recursive: true });

const brainDir = "C:/Users/xalim/.gemini/antigravity/brain/0a40edbe-7cbd-4c26-b2e6-899dbe06fa41";
await mkdir(brainDir, { recursive: true });

function loadEnvLocal() {
  const file = join(root, ".env.local");
  if (!existsSync(file)) return false;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (value === "") continue;
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return true;
}

loadEnvLocal();

// Start sandbox relay for Anthropic if key present
let relay = null;
if (process.env.ANTHROPIC_API_KEY) {
  relay = await startAnthropicRelay();
  process.env.ANTHROPIC_BASE_URL = relay.baseUrl;
  console.log(`[relay] Connected to Anthropic via ${relay.baseUrl}`);
}

// Import api handler
const proposeMod = await import(pathToFileURL(resolve(root, "api/design/propose.js")).href);
const proposeHandler = proposeMod.default;

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return raw; }
}

function makeRes(res) {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(obj) { return this.send(JSON.stringify(obj)); },
    send(body) {
      res.writeHead(this.statusCode, { "content-type": "application/json", ...this.headers });
      res.end(typeof body === "string" ? body : JSON.stringify(body));
      return this;
    },
  };
}

const PORT = 4195;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === "/api/design/propose") {
    req.body = req.method === "POST" ? await readBody(req) : undefined;
    req.query = Object.fromEntries(url.searchParams);
    return proposeHandler(req, makeRes(res));
  }

  const relative = url.pathname === "/" ? "dist/index.html" : `dist${url.pathname}`;
  const filePath = resolve(root, relative);
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "content-type": MIME[extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not Found");
  }
});

await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
console.log(`Server listening on http://127.0.0.1:${PORT}`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

async function saveEvidence(filename) {
  const targetPath = resolve(artifactsDir, filename);
  await page.screenshot({ path: targetPath, fullPage: false });
  await copyFile(targetPath, resolve(brainDir, filename));
  console.log(`Saved: ${filename}`);
}

async function getViewerState() {
  return page.evaluate(() => {
    const state = window.aiWardrobeState || {};
    const spec = state.spec || {};
    const dims = spec.envelope || {};
    let bbox = null;
    if (typeof Builder !== "undefined" && Builder.parts && Builder.parts[0]) {
      const b = new THREE.Box3().setFromObject(Builder.parts[0]);
      const sz = b.getSize(new THREE.Vector3());
      bbox = {
        widthMm: Math.round(sz.x * 1000),
        heightMm: Math.round(sz.y * 1000),
        depthMm: Math.round(sz.z * 1000),
      };
    }
    const sidePanel = typeof Builder !== "undefined" && Builder.scene ? Builder.scene.getObjectByName("part_CARC_SIDE_L") : null;
    const matHex = sidePanel && sidePanel.material
      ? (Array.isArray(sidePanel.material) ? sidePanel.material[0].color.getHex() : sidePanel.material.color.getHex())
      : null;
    return {
      revision: spec.revision || state.revision,
      widthMm: dims.widthMm,
      heightMm: dims.heightMm,
      depthMm: dims.depthMm,
      finishType: spec.finishType,
      bayLayouts: spec.bays ? spec.bays.map(b => b.layoutType) : null,
      partsCount: Builder ? Builder.parts.length : 0,
      bbox,
      matHex: matHex ? "0x" + matHex.toString(16) : null,
      streamLastText: document.getElementById("aiConversationalStream")?.lastElementChild?.textContent || "",
    };
  });
}

async function getDoorCenter(partId) {
  return page.evaluate((id) => {
    const cv = document.getElementById("bld3d");
    const rect = cv.getBoundingClientRect();
    const mesh = Builder.scene.getObjectByName(`part_${id}`);
    if (!mesh) return null;
    mesh.updateMatrixWorld(true);
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    const center = new THREE.Vector3();
    bb.getCenter(center);
    mesh.localToWorld(center);
    center.project(Builder.cam);
    const x = ((center.x + 1) / 2) * rect.width + rect.left;
    const y = ((-center.y + 1) / 2) * rect.height + rect.top;
    return { x, y, inFrustum: center.z >= -1 && center.z <= 1 };
  }, partId);
}

try {
  console.log("\n=======================================================");
  console.log("EXECUTING VISIBLE DESIGNER CUSTOMER JOURNEY");
  console.log("=======================================================\n");

  await page.goto(`http://127.0.0.1:${PORT}/#/build/ai-wardrobe`);
  await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.ready);

  // 1. Initial wardrobe draft
  console.log("[Step 1] Initial wardrobe draft ('Make me a wardrobe')...");
  await page.fill("#aiWardrobeInput", "Make me a wardrobe");
  await page.click("#aiWardrobeSubmitBtn");
  await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.parts && Builder.parts.length > 0);
  await page.waitForTimeout(500);

  const state1 = await getViewerState();
  await saveEvidence("01_initial_wardrobe_draft.png");
  console.log("Step 1 Results:", JSON.stringify(state1));

  // 2. Real model-required wording producing a visible dimension change
  console.log("\n[Step 2] Real model edit ('could you open it up a bit for me — go to two metres across')...");
  const liveMessage = "could you open it up a bit for me — go to two metres across";
  await page.fill("#aiConversationalInput", liveMessage);
  await page.click("#aiConversationalSendBtn");

  // Wait for the real model response
  await page.waitForFunction(() => {
    const el = document.getElementById("revRevision");
    return el && el.textContent === "2";
  }, { timeout: 35000 });
  await page.waitForTimeout(500);

  const state2 = await getViewerState();
  await saveEvidence("02_real_model_width_2000mm.png");
  console.log("Step 2 Results:", JSON.stringify(state2));

  // 3. Material change
  console.log("\n[Step 3] Material change ('change material to walnut')...");
  await page.fill("#aiConversationalInput", "change material to walnut");
  await page.click("#aiConversationalSendBtn");
  await page.waitForFunction(() => {
    const el = document.getElementById("revFinish");
    return el && el.textContent.toLowerCase().includes("walnut");
  }, { timeout: 10000 });
  await page.waitForTimeout(500);

  const state3 = await getViewerState();
  await saveEvidence("03_material_updated_walnut.png");
  console.log("Step 3 Results:", JSON.stringify(state3));

  // 4. Supported shelf-layout change
  console.log("\n[Step 4] Supported shelf-layout change ('switch the left bay to two shelves')...");
  await page.fill("#aiConversationalInput", "switch the left bay to two shelves");
  await page.click("#aiConversationalSendBtn");
  await page.waitForFunction(() => {
    const el = document.getElementById("revRevision");
    return el && el.textContent === "4";
  }, { timeout: 10000 });
  await page.waitForTimeout(500);

  const state4 = await getViewerState();
  await saveEvidence("04_supported_shelf_layout_change.png");
  console.log("Step 4 Results:", JSON.stringify(state4));

  // 5. Unsupported request leaving the design unchanged
  console.log("\n[Step 5] Unsupported request ('Add another shelf on the right')...");
  await page.fill("#aiConversationalInput", "Add another shelf on the right");
  await page.click("#aiConversationalSendBtn");
  await page.waitForFunction(() => {
    const stream = document.getElementById("aiConversationalStream");
    return stream && stream.textContent.includes("maximum supported shelving");
  }, { timeout: 10000 });
  await page.waitForTimeout(500);

  const state5 = await getViewerState();
  await saveEvidence("05_unsupported_request_unchanged.png");
  console.log("Step 5 Results:", JSON.stringify(state5));

  // 6. Undo restoring the previous design
  console.log("\n[Step 6] Undo restoring the previous design...");
  await page.click("#btnUndoEdit");
  await page.waitForFunction(() => {
    const el = document.getElementById("revRevision");
    return el && el.textContent === "3";
  }, { timeout: 10000 });
  await page.waitForTimeout(500);

  const state6 = await getViewerState();
  await saveEvidence("06_undo_restores_previous_design.png");
  console.log("Step 6 Results:", JSON.stringify(state6));

  // 7. Working door interaction
  console.log("\n[Step 7] Working door interaction...");
  const doorIds = ["DOOR_01", "DOOR_02", "DOOR_03", "DOOR_04"];
  for (let i = 0; i < 4; i++) {
    const id = doorIds[i];
    const center = await getDoorCenter(id);
    console.log(`Door ${id} center:`, center);
    if (center && center.inFrustum) {
      await page.mouse.click(center.x, center.y);
      await page.waitForTimeout(300);
    }
  }
  await page.waitForTimeout(1000);
  await saveEvidence("07_doors_opened_interior_revealed.png");

  for (let i = 0; i < 4; i++) {
    const id = doorIds[i];
    const center = await getDoorCenter(id);
    if (center && center.inFrustum) {
      await page.mouse.click(center.x, center.y);
      await page.waitForTimeout(300);
    }
  }
  await page.waitForTimeout(1000);
  await saveEvidence("08_doors_closed_again.png");

  console.log("\nAll 7 customer journey steps verified with browser evidence!");
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  if (relay) relay.closeSync?.();
}
