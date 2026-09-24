/** Markdown report writer. NOT production code. */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { redactSecrets } from "./env.js";

export function formatReport({ mode, startedAt, finishedAt, results, notes = [] }) {
  const label = mode === "real-db" ? "REAL-DB" : "SIMULATED";
  const lines = [
    `# Persistence DB harness report — ${label}`,
    "",
    `**Mode:** ${label}`,
    `**Started:** ${startedAt}`,
    `**Finished:** ${finishedAt}`,
    "",
    "> NOT production code. SIMULATED uses `createFakePostgrest` and does **not**",
    "> prove Postgres durability or that deployed RLS matches schema.sql.",
    "",
    "| Case | Procedure § | Result | Evidence |",
    "|---|---|---|---|",
  ];
  for (const r of results) {
    const ev = redactSecrets((r.evidence || []).slice(0, 4).join("; ").replace(/\|/g, "/"));
    lines.push(`| ${r.id} ${r.title} | ${r.procedureSection} | **${r.status}** | ${ev} |`);
  }
  lines.push("", "## Details", "");
  for (const r of results) {
    lines.push(`### ${r.id} — ${r.title} → ${r.status}`);
    lines.push(`Procedure: ${r.procedureSection}`);
    if (r.error) lines.push(`Error: \`${redactSecrets(r.error)}\``);
    for (const e of r.evidence || []) lines.push(`- ${redactSecrets(e)}`);
    lines.push("");
  }
  if (notes.length) {
    lines.push("## Notes", "");
    for (const n of notes) lines.push(`- ${redactSecrets(n)}`);
    lines.push("");
  }
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const blocked = results.filter((r) => r.status === "BLOCKED" || r.status === "SKIP").length;
  lines.push("## Summary");
  lines.push(`PASS=${passed} FAIL=${failed} BLOCKED/SKIP=${blocked} TOTAL=${results.length}`);
  lines.push("");
  return lines.join("\n");
}

export function writeReport(filePath, markdown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, markdown, "utf8");
  return filePath;
}
