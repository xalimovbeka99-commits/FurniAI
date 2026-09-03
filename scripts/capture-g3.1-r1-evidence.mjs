import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, copyFile } from "node:fs/promises";
import { resolve, extname } from "node:path";

const root = process.cwd();
const artifactsDir = resolve(root, "docs/artifacts/g3.1-r1");
await mkdir(artifactsDir, { recursive: true });

const mimeTypes = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

// Start simple static file server
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

await new Promise((resolveServer) => server.listen(4179, "127.0.0.1", resolveServer));
console.log("Static server running on http://127.0.0.1:4179");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

try {
  await page.goto("http://127.0.0.1:4179/#/build/golden-parametric");
  await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.doorObjs && Builder.doorObjs.length === 4);
  await page.waitForTimeout(600); // allow initial render & lerps

  // Evidence A: Closed distinct doors
  const pathA = resolve(artifactsDir, "evidence_A_doors_closed_distinct.png");
  await page.screenshot({ path: pathA });
  console.log(`Saved Evidence A: ${pathA}`);

  // Evidence B: All four doors open showing internal construction
  await page.locator("#toggle-doors").click();
  await page.waitForTimeout(800); // allow door animation to complete rotation
  const pathB = resolve(artifactsDir, "evidence_B_doors_open_interior.png");
  await page.screenshot({ path: pathB });
  console.log(`Saved Evidence B: ${pathB}`);

  // Evidence C: Different material selected (walnut swatch)
  const walnutSwatch = page.locator(".b-sw[data-mat='walnut']");
  await walnutSwatch.click();
  await page.waitForTimeout(600);
  const pathC = resolve(artifactsDir, "evidence_C_material_updated_walnut.png");
  await page.screenshot({ path: pathC });
  console.log(`Saved Evidence C: ${pathC}`);

  // Evidence D: Complete wardrobe framed within existing 3D Builder interface
  // Close doors partially or toggle to show complete framed assembly
  await page.locator("#toggle-doors").click();
  await page.waitForTimeout(800);
  // Re-apply oak for natural wood finish view
  const oakSwatch = page.locator(".b-sw[data-mat='oak']");
  await oakSwatch.click();
  await page.waitForTimeout(600);
  const pathD = resolve(artifactsDir, "evidence_D_complete_builder_framed.png");
  await page.screenshot({ path: pathD });
  console.log(`Saved Evidence D: ${pathD}`);

  // Copy to conversation brain artifact directory
  const brainDir = "C:/Users/xalim/.gemini/antigravity/brain/3100e3fe-eedd-4e28-9793-20ee8321986c";
  await copyFile(pathA, resolve(brainDir, "evidence_A_doors_closed_distinct.png"));
  await copyFile(pathB, resolve(brainDir, "evidence_B_doors_open_interior.png"));
  await copyFile(pathC, resolve(brainDir, "evidence_C_material_updated_walnut.png"));
  await copyFile(pathD, resolve(brainDir, "evidence_D_complete_builder_framed.png"));
  console.log("Copied all evidence screenshots to conversation brain artifact directory.");

} finally {
  await browser.close();
  server.close();
}
