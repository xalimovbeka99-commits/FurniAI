#!/usr/bin/env node
/**
 * scripts/db-verify/race-worker.mjs
 * ---------------------------------------------------------------------
 * One competing writer, in its own OS process with its own HTTP connection.
 * Reads its job from STDIN (never argv — argv is visible in `ps`), waits for
 * the shared start instant, sends exactly one save, prints one JSON line.
 *
 * Output carries status, code, ok, idempotentReplay and timing. Never the
 * token, never the body.
 */
let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const job = JSON.parse(raw);

const wait = job.startAt - Date.now();
if (wait > 0) await new Promise((r) => setTimeout(r, wait));
// Spin the last millisecond so the writers leave as close together as the OS allows.
while (Date.now() < job.startAt) { /* spin */ }

const sentAt = Date.now();
let out;
try {
  const res = await fetch(job.url, {
    method: "POST",
    headers: { authorization: `Bearer ${job.token}`, "content-type": "application/json" },
    body: JSON.stringify(job.body),
  });
  const body = await res.json().catch(() => null);
  out = {
    worker: job.worker,
    status: res.status,
    ok: body?.ok ?? null,
    code: body?.code ?? null,
    idempotentReplay: body?.idempotentReplay ?? false,
    concurrent: body?.details?.concurrent ?? false,
    sentAt,
    ms: Date.now() - sentAt,
  };
} catch (err) {
  out = { worker: job.worker, status: 0, error: err?.name || "Error", sentAt, ms: Date.now() - sentAt };
}
process.stdout.write(JSON.stringify(out) + "\n");
