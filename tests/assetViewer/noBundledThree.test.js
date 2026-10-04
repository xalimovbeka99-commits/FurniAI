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
    expect(api.version).toBe("asset-viewer-module/2");
  });
});
