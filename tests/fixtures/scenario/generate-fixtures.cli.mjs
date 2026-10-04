// CLI for the deterministic Scenario GLB fixtures (LOCAL, test-only). Never imported by tests.
// No shebang on purpose (see generate-fixtures.mjs); run it with node:
//
//   node tests/fixtures/scenario/generate-fixtures.cli.mjs          # (re)write the files + manifest.json
//   node tests/fixtures/scenario/generate-fixtures.cli.mjs --check  # exit 1 if committed bytes differ
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAllFixtures } from "./generate-fixtures.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const sha = (b) => createHash("sha256").update(b).digest("hex");

const files = buildAllFixtures();
const manifest = Object.fromEntries(Object.entries(files).map(([n, b]) => [n, { bytes: b.length, sha256: sha(b) }]));
if (process.argv.includes("--check")) {
  let bad = 0;
  for (const [name, buf] of Object.entries(files)) {
    let onDisk = null;
    try { onDisk = readFileSync(join(HERE, name)); } catch { /* missing */ }
    const same = onDisk && onDisk.equals(buf);
    if (!same) bad++;
    console.log(`${same ? "ok  " : "DIFF"} ${name} ${buf.length}B ${sha(buf).slice(0, 16)}`);
  }
  process.exit(bad ? 1 : 0);
}
for (const [name, buf] of Object.entries(files)) writeFileSync(join(HERE, name), buf);
writeFileSync(join(HERE, "manifest.json"), JSON.stringify({ note: "Deterministic test fixtures (LOCAL). Regenerate with node tests/fixtures/scenario/generate-fixtures.cli.mjs; --check verifies.", files: manifest }, null, 2) + "\n");
console.log(JSON.stringify(manifest, null, 2));
