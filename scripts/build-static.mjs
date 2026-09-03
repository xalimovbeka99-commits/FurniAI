import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = process.cwd();
const output = resolve(root, "dist");

const threeGlobalPlugin = {
  name: "three-global-plugin",
  setup(b) {
    b.onResolve({ filter: /^three$/ }, (args) => ({
      path: args.path,
      namespace: "three-global",
    }));
    b.onLoad({ filter: /.*/, namespace: "three-global" }, () => ({
      contents: "module.exports = globalThis.THREE || window.THREE;",
      loader: "js",
    }));
  },
};

// Build the standalone browser runtime bridge for PartGraph v0.1
await build({
  entryPoints: [resolve(root, "src/lib/adapters/browserBridge.js")],
  bundle: true,
  format: "iife",
  globalName: "PartGraphBridge",
  plugins: [threeGlobalPlugin],
  outfile: resolve(root, "partgraph-runtime-bridge.js"),
});

const files = [
  "index.html",
  "styles.css",
  "app.js",
  "legacy-builder-adapter.js",
  "partgraph-runtime-bridge.js",
  "vendor-three-r128.min.js",
  "vendor-supabase.min.js",
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of files) {
  await cp(resolve(root, file), resolve(output, file));
}

console.log(`Built legacy FurniAI static application (${files.length} files) in ${output}`);
