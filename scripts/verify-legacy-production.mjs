import { chromium } from "@playwright/test";

const origin = (process.argv[2] || "https://furniai-topaz.vercel.app").replace(/\/$/, "");
const browser = await chromium.launch();

try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const response = await page.goto(`${origin}/#/build/0`, { waitUntil: "networkidle" });
  if (!response?.ok()) throw new Error(`Production returned HTTP ${response?.status()}`);

  await page.waitForSelector("#bld3d", { state: "attached" });
  await page.waitForFunction(() => typeof Builder !== "undefined" && Builder.parts?.length > 0);
  await page.waitForTimeout(300);

  const result = await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => {
      const canvas = document.getElementById("bld3d");
      const gl = typeof Builder !== "undefined" ? Builder.ren?.getContext() : null;
      if (!canvas || !gl) return resolve({ canvas: Boolean(canvas), webgl: Boolean(gl), nonBlankFraction: 0 });
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let nonBlank = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] || pixels[i + 1] || pixels[i + 2]) nonBlank += 1;
      }
      resolve({
        canvas: true,
        webgl: true,
        width,
        height,
        partCount: Builder.parts.length,
        threeRevision: globalThis.THREE?.REVISION,
        nextAssets: Array.from(document.scripts).some((script) => script.src.includes("/_next/")),
        nonBlankFraction: nonBlank / (width * height),
      });
    });
  }));

  if (errors.length) throw new Error(`Page errors: ${errors.join("; ")}`);
  if (!result.canvas || !result.webgl) throw new Error("Legacy Builder canvas/WebGL renderer is missing");
  if (result.nextAssets) throw new Error("Production is serving Next.js assets");
  if (result.threeRevision !== "128") throw new Error(`Unexpected Three.js revision: ${result.threeRevision}`);
  if (result.nonBlankFraction <= 0.05) throw new Error(`Builder is blank: ${result.nonBlankFraction}`);

  console.log(JSON.stringify({ origin, verdict: "PASS", ...result }, null, 2));
} finally {
  await browser.close();
}
