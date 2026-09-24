/** Assert helpers — OWN harness only. NOT production code. */

export class AssertError extends Error {
  constructor(message, evidence = []) {
    super(message);
    this.name = "AssertError";
    this.evidence = evidence;
  }
}

export function createAssert(collector) {
  const note = (m) => collector && collector.push(String(m));
  return {
    note,
    ok(cond, msg, evidence) {
      if (!cond) throw new AssertError(msg || "assertion failed", evidence || [msg]);
      note(`PASS: ${msg}`);
    },
    equal(actual, expected, msg) {
      const same =
        Object.is(actual, expected) || JSON.stringify(actual) === JSON.stringify(expected);
      if (!same) {
        throw new AssertError(msg || "not equal", [
          `expected=${JSON.stringify(expected)}`,
          `actual=${JSON.stringify(actual)}`,
        ]);
      }
      note(`PASS: ${msg} (${JSON.stringify(actual)})`);
    },
  };
}
