/**
 * Phase 0 evaluation harness — characterizes api/constructionValidator.js.
 * Plan and fixture classes: docs/research/06-eval-harness.md.
 *
 * Run: node --test tests/
 *
 * CommonJS on purpose: the module under test is CJS and this must run with
 * zero product-code changes. Fixture classes:
 *   regression        -> asserted, red build on failure
 *   characterization  -> asserted, failure means "investigate", not "bug"
 *   knownGap          -> test.todo(); missing rule documented, current
 *                        silence is NEVER asserted as correct behavior
 * Every fixture declares a capability status (docs/MASTER-PLAN.md §14);
 * nothing here may imply more maturity than "preview"/"conceptual".
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { evaluateConstruction } = require('../api/constructionValidator.js');

const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const fixtures = fs.readdirSync(FIXTURE_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, f), 'utf8')));

const CAPABILITIES = ['production_ready', 'preview', 'conceptual', 'unsupported'];

function matchFinding(actual, spec) {
  if (spec.field && actual.field !== spec.field) return false;
  if (spec.severity && actual.severity !== spec.severity) return false;
  if (spec.messageIncludes && !actual.message.toLowerCase().includes(spec.messageIncludes.toLowerCase())) return false;
  if (spec.hasFix === true && !actual.fix) return false;
  if (spec.hasFix === false && actual.fix) return false;
  if (spec.fixEquals) {
    if (!actual.fix) return false;
    for (const [k, v] of Object.entries(spec.fixEquals)) {
      if (JSON.stringify(actual.fix[k]) !== JSON.stringify(v)) return false;
    }
  }
  return true;
}

for (const fx of fixtures) {
  const label = `[${fx.class}] [${fx.capability}] ${fx.id}`;

  // Sanity on the fixture file itself.
  test(`${label} — fixture is well-formed`, () => {
    assert.ok(['regression', 'characterization', 'knownGap'].includes(fx.class), 'valid class');
    assert.ok(CAPABILITIES.includes(fx.capability), 'valid capability status');
    assert.equal(fx.capability === 'production_ready', false,
      'Phase 0: nothing may claim production_ready');
  });

  if (fx.class === 'knownGap') {
    test(`${label} — ${fx.expect.todo}`, { todo: true }, () => {});
    continue;
  }

  test(label, () => {
    const findings = evaluateConstruction(fx.config);

    if (fx.expect.findings.length === 0) {
      assert.deepEqual(findings, [], `expected clean, got: ${JSON.stringify(findings)}`);
      return;
    }

    // Every expected finding must be present…
    for (const spec of fx.expect.findings) {
      assert.ok(findings.some(f => matchFinding(f, spec)),
        `missing expected finding ${JSON.stringify(spec)} in ${JSON.stringify(findings)}`);
    }
    // …and no unexpected extras (count must match).
    assert.equal(findings.length, fx.expect.findings.length,
      `unexpected extra findings: ${JSON.stringify(findings)}`);

    // Auto-repair contract: applying the deterministic fix clears the board.
    if (fx.expect.fixResolves) {
      const fixed = { ...fx.config };
      for (const f of findings) if (f.fix) Object.assign(fixed, f.fix);
      const after = evaluateConstruction(fixed);
      assert.deepEqual(after, [],
        `fix did not fully resolve: ${JSON.stringify(after)}`);
    }
  });
}
