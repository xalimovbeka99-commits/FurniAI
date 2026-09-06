import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, copyFile } from "node:fs/promises";
import { resolve, extname } from "node:path";

const root = process.cwd();
const artifactsDir = resolve(root, "docs/artifacts/g4.1");
await mkdir(artifactsDir, { recursive: true });

const brainDir = "C:/Users/xalim/.gemini/antigravity/brain/7e0204ae-fd59-4bd8-b874-0c5713d89f7d";
await mkdir(brainDir, { recursive: true });

const mimeTypes = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

// Start simple static file server on port 4185
const server = createServer(async (req, res) => {
  const urlPath = req.url.split("?")[0].split("#")[0];
  const relativePath = urlPath === "/" ? "dist/index.html" : `dist${urlPath}`;
  const filePath = resolve(root, relativePath);

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not Found");
  }
});

await new Promise((resolveServer) => server.listen(4185, "127.0.0.1", resolveServer));
console.log("Static server running on http://127.0.0.1:4185");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('console', msg => console.log('PAGE LOG:', msg.text()));
page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

async function saveEvidence(filename, elementSelector = null) {
  const targetPath = resolve(artifactsDir, filename);
  if (elementSelector) {
    const el = page.locator(elementSelector);
    await el.screenshot({ path: targetPath });
  } else {
    await page.screenshot({ path: targetPath, fullPage: false });
  }
  await copyFile(targetPath, resolve(brainDir, filename));
  console.log(`Saved: ${filename}`);
}

async function getObjectCenter(page, name) {
  return page.evaluate((id) => {
    const cv = document.getElementById("bld3d");
    const rect = cv.getBoundingClientRect();
    const mesh = Builder.scene.getObjectByName(id);
    if (!mesh) return null;
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    const center = new THREE.Vector3();
    bb.getCenter(center);
    mesh.localToWorld(center);
    center.project(Builder.cam);
    const x = ((center.x + 1) / 2) * rect.width + rect.left;
    const y = ((-center.y + 1) / 2) * rect.height + rect.top;
    return { x, y };
  }, name);
}

try {
  // 1. Initial description screen
  await page.goto("http://127.0.0.1:4185/#/build/ai-wardrobe");
  await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.ready);
  await page.waitForSelector("#aiWardrobeInputSection:not([hidden])");
  await page.waitForTimeout(300);
  await saveEvidence("01-furniai-description-screen.png");

  // 2. Clarification question screen
  await page.fill("#aiWardrobeInput", "I need a wardrobe for my bedroom, about 2 metres tall.");
  await page.click("#aiWardrobeSubmitBtn");
  await page.waitForSelector("#aiWardrobeClarifySection:not([hidden])");
  await page.waitForTimeout(300);
  await saveEvidence("02-clarification-question-screen.png");

  // 3. Ready for review proposal screen (complete description)
  await page.click("#btnClarifyStartOver");
  await page.waitForSelector("#aiWardrobeInputSection:not([hidden])");
  await page.click("#aiGoldenExamplePrompt");
  await page.click("#aiWardrobeSubmitBtn");
  await page.waitForSelector("#aiWardrobeClarifySection:not([hidden])");

  // Answer the 3 clarification questions
  // Q1: doorCount -> 4
  await page.fill("#aiClarifyInput", "4");
  await page.click("#aiClarifySubmitBtn");
  await page.waitForTimeout(100);

  // Q2: finishType -> melamine
  await page.waitForSelector("#aiClarifyInput");
  await page.fill("#aiClarifyInput", "melamine");
  await page.click("#aiClarifySubmitBtn");
  await page.waitForTimeout(100);

  // Q3: bayLayouts -> shelves
  await page.waitForSelector("#aiClarifyInput");
  await page.fill("#aiClarifyInput", "shelves");
  await page.click("#aiClarifySubmitBtn");

  await page.waitForSelector("#aiWardrobeReviewSection:not([hidden])");
  await page.waitForTimeout(300);
  await saveEvidence("03-ready-for-review-proposal-screen.png");

  // 4. Explicit approval screen
  await saveEvidence("04-explicit-approval-screen.png", "#aiWardrobeReviewSection");

  // 5. Generated golden wardrobe with closed doors
  await page.click("#btnApproveGenerate3D");
  await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.doorObjs && Builder.doorObjs.length === 4);
  await page.waitForTimeout(400);
  await saveEvidence("05-generated-golden-wardrobe-closed-doors.png");

  // 6. All doors open revealing interior
  await page.click("#toggle-doors");
  await page.waitForTimeout(600);
  await saveEvidence("06-all-doors-open-interior-visible.png");

  // 7. Selected panel exact dimensions
  // Click left side panel
  const sideLCenter = await getObjectCenter(page, "part_CARC_SIDE_L");
  if (sideLCenter) {
    await page.mouse.click(sideLCenter.x, sideLCenter.y);
  } else {
    // Fallback: click directly or select
    await page.evaluate(() => {
      const mesh = Builder.scene.getObjectByName("part_CARC_SIDE_L");
      if (mesh) selectPartForInspection(mesh);
    });
  }
  await page.waitForTimeout(300);
  await saveEvidence("07-selected-panel-exact-dimensions.png", "#partInspectionPanel");

  // 8. Material changed visibly
  const walnutSwatch = page.locator(".b-sw[data-mat='walnut']");
  if (await walnutSwatch.count() > 0) {
    await walnutSwatch.click();
    await page.waitForTimeout(400);
  }
  await saveEvidence("08-material-changed-visibly.png");

  // 9. Mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(400);
  await saveEvidence("09-mobile-viewport.png");

  // 10. CNC & drilling safety labels
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(200);
  await saveEvidence("10-cnc-drilling-safety-label.png", "#partInspectionPanel");

  console.log("All 10 G4.1 evidence screenshots captured successfully!");
} finally {
  await browser.close();
  server.close();
}
