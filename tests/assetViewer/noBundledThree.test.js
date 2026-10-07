/**
 * The static Studio page already loads three r128 as window.THREE. The
 * viewer must not import or bundle a second three: every three-related
 * class is injected. This test enforces it on the source and on an actual
 * esbuild IIFE bundle of the browser entry (esbuild ships with vite).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(ROOT, "src", "lib", "assetViewer");

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("no bundled three.js", () => {
  it("no source file under src/lib/assetViewer imports three, @react-three or react", () => {
    const offenders = [];
    for (const f of walk(SRC).filter((p) => p.endsWith(".js"))) {
      const code = readFileSync(f, "utf8");
      const specs = [...code.matchAll(/(?:import\s[^'"]*?from\s*|import\s*\(\s*|require\s*\(\s*|export\s[^'"]*?from\s*)["']([^"']+)["']/g)].map((m) => m[1]);
      for (const s of specs) if (!s.startsWith(".")) offenders.push(`${relative(ROOT, f)} -> ${s}`);
    }
    expect(offenders).toEqual([]);
  });

  it("an esbuild IIFE bundle of entry.js has no three.js inside and stays small", async () => {
    const { build } = await import("esbuild");
    const out = await build({
      entryPoints: [join(SRC, "entry.js")],
      bundle: true,
      format: "iife",
      globalName: "FurniAssetViewer",
      write: false,
      metafile: true,
      logLevel: "silent",
    });
    const inputs = Object.keys(out.metafile.inputs);
    expect(inputs.every((i) => i.startsWith("src/lib/assetViewer/"))).toBe(true);
    const code = out.outputFiles[0].text;
    expect(code).not.toMatch(/class\s+WebGLRenderer|REVISION\s*=\s*["']\d+|function\s+WebGLRenderer/);
    // Unminified ceiling raised from 60 KiB to 96 KiB in round 2 for the /api/creative
    // adapter + job states; the minified ceiling is the one that matters for the page.
    expect(code.length).toBeLessThan(96 * 1024);
    const min = await build({ entryPoints: [join(SRC, "entry.js")], bundle: true, minify: true, format: "iife", globalName: "FurniAssetViewer", write: false, logLevel: "silent" });
    expect(min.outputFiles[0].text.length).toBeLessThan(48 * 1024);
    // the bundle evaluates without any THREE global and exposes the mount API
    const fn = new Function(`${code}; return FurniAssetViewer;`);
    const api = fn();
    expect(typeof api.mountAssetViewer).toBe("function");
    // v3: the interim host interface is on the global; the /api/creative (Scenario) adapter
    // is NOT in the core bundle any more (optional, see entry.creative.js)
    expect(typeof api.mount).toBe("function");
    expect(api.createCreativeAssetSource).toBeUndefined();
    expect(api.version).toBe("asset-viewer-module/3");
  });

  it("the optional creative adapter bundle (entry.creative.js) is three-free, small, and only the adapter", async () => {
    const { build } = await import("esbuild");
    const opts = { entryPoints: [join(SRC, "entry.creative.js")], bundle: true, format: "iife", globalName: "FurniAssetViewerCreative", write: false, logLevel: "silent" };
    const out = await build({ ...opts, metafile: true });
    expect(Object.keys(out.metafile.inputs).every((i) => i.startsWith("src/lib/assetViewer/"))).toBe(true);
    const code = out.outputFiles[0].text;
    expect(code).not.toMatch(/class\s+WebGLRenderer|REVISION\s*=\s*["']\d+/);
    const min = await build({ ...opts, minify: true });
    expect(min.outputFiles[0].text.length).toBeLessThan(16 * 1024);
    const api = new Function(`${code}; return FurniAssetViewerCreative;`)();
    expect(typeof api.createCreativeAssetSource).toBe("function");
    expect(api.mountAssetViewer).toBeUndefined();
    expect(api.version).toBe("asset-viewer-creative/3");
  });

  it("no source file reads a THREE global (window.THREE / globalThis.THREE / bare THREE); mount.js only uses the THREE option", () => {
    const offenders = [];
    for (const f of walk(SRC).filter((p) => p.endsWith(".js"))) {
      const code = readFileSync(f, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
        .replace(/(["'`])(?:\\.|(?!\1)[^\\\n])*\1/g, '""');
      const rel = relative(ROOT, f);
      if (/\b(?:window|globalThis|self)\s*\.\s*THREE\b/.test(code)) offenders.push(`${rel}: global THREE`);
      if (rel.endsWith("/mount.js")) {
        expect(code).toMatch(/const\s*\{\s*THREE\s*,[^}]*\}\s*=\s*options/);
      } else if (/\bTHREE\b/.test(code)) offenders.push(`${rel}: bare THREE`);
    }
    expect(offenders).toEqual([]);
  });
});
