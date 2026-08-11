import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

const root = process.cwd();
// Scoped to documents this repository actually commits today (Wardrobe AI
// Phase 1). A separate, not-yet-committed initiative owns a larger
// required-document set (MASTER_ENGINEERING_SPEC.md, AGENTS.md, architecture/
// engineering docs, etc.) — this script doesn't gate on files that aren't
// part of the tree it's committed alongside.
const required = [
  "docs/WARDROBE_MODEL_SCHEMA.md",
  "docs/TOOL_CONTRACTS.md",
  "docs/KNOWN_LIMITATIONS.md",
  "docs/IMPLEMENTATION_CHANGELOG.md",
  "docs/WARDROBE_AI_BASELINE.md",
  "docs/WARDROBE_AI_VERIFICATION_REPORT.md",
  "docs/WARDROBE_AI_TEST_PLAN.md",
];

const ignoredDirectories = new Set([
  ".git",
  ".next",
  "node_modules",
  "output",
  "out",
]);

function markdownFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...markdownFiles(path));
    if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
      files.push(path);
    }
  }
  return files;
}

const errors = [];
for (const relative of required) {
  if (!existsSync(resolve(root, relative))) {
    errors.push(`Missing required document: ${relative}`);
  }
}

const linkPattern = /!?\[[^\]]*]\(([^)]+)\)/g;
for (const file of markdownFiles(root)) {
  const body = readFileSync(file, "utf8");
  for (const match of body.matchAll(linkPattern)) {
    let target = match[1].trim();
    if (target.startsWith("<") && target.endsWith(">")) {
      target = target.slice(1, -1);
    }
    target = target.split(/\s+["']/)[0].split("#")[0];
    if (
      !target ||
      target.startsWith("#") ||
      /^(https?:|mailto:|data:)/i.test(target)
    ) {
      continue;
    }
    const absolute = resolve(dirname(file), decodeURIComponent(target));
    if (!existsSync(absolute)) {
      errors.push(
        `${file.slice(root.length + 1)}: broken relative link "${target}"`,
      );
      continue;
    }
    statSync(absolute);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Documentation structure and relative links are valid.");
}

