import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const output = resolve(root, "dist");
const files = [
  "index.html",
  "styles.css",
  "app.js",
  "legacy-builder-adapter.js",
  "vendor-three-r128.min.js",
  "vendor-supabase.min.js",
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of files) {
  await cp(resolve(root, file), resolve(output, file));
}

console.log(`Built legacy FurniAI static application (${files.length} files) in ${output}`);
