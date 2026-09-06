import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, copyFile } from "node:fs/promises";
import { resolve, extname } from "node:path";

const root = process.cwd();
const artifactsDir = resolve(root, "docs/artifacts/g3.1-r2");
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

// Start simple static file server on port 4183
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

await new Promise((resolveServer) => server.listen(4183, "127.0.0.1", resolveServer));
console.log("Static server running on http://127.0.0.1:4183");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

async function getDoorCenter(page, partId) {
  return page.evaluate((id) => {
    const cv = document.getElementById("bld3d");
    const rect = cv.getBoundingClientRect();
    const mesh = Builder.scene.getObjectByName(`part_${id}`);
    if (!mesh) return null;
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
  await page.goto("http://127.0.0.1:4183/#/build/golden-parametric");
  await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.doorObjs && Builder.doorObjs.length === 4);
  await page.waitForTimeout(800);

  // Evidence 1: Front view showing frame-aligned plinth and 4 closed doors
  await page.evaluate(() => {
    Builder.rotY = Math.PI;
    Builder.rotX = 0.03;
    Builder.camDist = 4.8;
  });
  await page.waitForTimeout(600);
  const path1 = resolve(artifactsDir, "evidence_1_front_plinth_aligned.png");
  await page.screenshot({ path: path1 });
  await copyFile(path1, resolve(brainDir, "evidence_1_front_plinth_aligned.png"));
  console.log(`Saved Evidence 1: ${path1}`);

  // Evidence 2: 3/4 perspective view showing plinth footprint and flush alignment
  await page.evaluate(() => {
    Builder.rotY = Math.PI - 0.45;
    Builder.rotX = 0.12;
    Builder.camDist = 4.8;
  });
  await page.waitForTimeout(600);
  const path2 = resolve(artifactsDir, "evidence_2_perspective_plinth_footprint.png");
  await page.screenshot({ path: path2 });
  await copyFile(path2, resolve(brainDir, "evidence_2_perspective_plinth_footprint.png"));
  console.log(`Saved Evidence 2: ${path2}`);

  // Set default 3/4 perspective for door interactions
  await page.evaluate(() => {
    Builder.rotY = Math.PI - 0.35;
    Builder.rotX = 0.06;
    Builder.camDist = 4.8;
    Builder.doorObjs.forEach(d => { d.userData.base = 0; d.userData.cur = 0; d.rotation.y = 0; });
  });
  await page.waitForTimeout(600);

  // Evidence 3: DOOR_01 opened by clicking its surface
  const c1 = await getDoorCenter(page, "DOOR_01");
  await page.mouse.click(c1.x, c1.y);
  await page.waitForTimeout(1000); // allow smooth animation
  const path3 = resolve(artifactsDir, "evidence_3_door_01_opened.png");
  await page.screenshot({ path: path3 });
  await copyFile(path3, resolve(brainDir, "evidence_3_door_01_opened.png"));
  console.log(`Saved Evidence 3: ${path3}`);

  // Reset doors
  await page.evaluate(() => {
    Builder.doorObjs.forEach(d => { d.userData.base = 0; d.userData.cur = 0; d.rotation.y = 0; });
  });
  await page.waitForTimeout(600);

  // Evidence 4: DOOR_02 opened by clicking its surface
  const c2 = await getDoorCenter(page, "DOOR_02");
  await page.mouse.click(c2.x, c2.y);
  await page.waitForTimeout(1000);
  const path4 = resolve(artifactsDir, "evidence_4_door_02_opened.png");
  await page.screenshot({ path: path4 });
  await copyFile(path4, resolve(brainDir, "evidence_4_door_02_opened.png"));
  console.log(`Saved Evidence 4: ${path4}`);

  // Reset doors
  await page.evaluate(() => {
    Builder.doorObjs.forEach(d => { d.userData.base = 0; d.userData.cur = 0; d.rotation.y = 0; });
  });
  await page.waitForTimeout(600);

  // Evidence 5: DOOR_03 opened by clicking its surface
  const c3 = await getDoorCenter(page, "DOOR_03");
  await page.mouse.click(c3.x, c3.y);
  await page.waitForTimeout(1000);
  const path5 = resolve(artifactsDir, "evidence_5_door_03_opened.png");
  await page.screenshot({ path: path5 });
  await copyFile(path5, resolve(brainDir, "evidence_5_door_03_opened.png"));
  console.log(`Saved Evidence 5: ${path5}`);

  // Reset doors
  await page.evaluate(() => {
    Builder.doorObjs.forEach(d => { d.userData.base = 0; d.userData.cur = 0; d.rotation.y = 0; });
  });
  await page.waitForTimeout(600);

  // Evidence 6: DOOR_04 opened by clicking its surface
  const c4 = await getDoorCenter(page, "DOOR_04");
  await page.mouse.click(c4.x, c4.y);
  await page.waitForTimeout(1000);
  const path6 = resolve(artifactsDir, "evidence_6_door_04_opened.png");
  await page.screenshot({ path: path6 });
  await copyFile(path6, resolve(brainDir, "evidence_6_door_04_opened.png"));
  console.log(`Saved Evidence 6: ${path6}`);

  // Evidence 7: All four doors open showing interior
  await page.locator("#toggle-doors").click();
  await page.waitForTimeout(1000);
  const path7 = resolve(artifactsDir, "evidence_7_all_doors_open_interior.png");
  await page.screenshot({ path: path7 });
  await copyFile(path7, resolve(brainDir, "evidence_7_all_doors_open_interior.png"));
  console.log(`Saved Evidence 7: ${path7}`);

  // Evidence 8: Walnut material swatch
  const walnutSwatch = page.locator(".b-sw[data-mat='walnut']");
  await walnutSwatch.click();
  await page.waitForTimeout(800);
  const path8 = resolve(artifactsDir, "evidence_8_material_swatch_walnut.png");
  await page.screenshot({ path: path8 });
  await copyFile(path8, resolve(brainDir, "evidence_8_material_swatch_walnut.png"));
  console.log(`Saved Evidence 8: ${path8}`);

  console.log("All G3.1-R2 evidence captured successfully!");
} finally {
  await browser.close();
  server.close();
}
