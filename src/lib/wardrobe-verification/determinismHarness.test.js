import { describe, expect, it, test } from "vitest";
import {
  canonicalSerialize,
  DEFAULT_DETERMINISM_RUNS,
  runDeterminismHarness
} from "../../../tests/wardrobe-ai/determinismHarness.js";

describe("Wardrobe AI determinism harness infrastructure", () => {
  it("canonicalizes object keys without reordering semantic arrays", () => {
    expect(canonicalSerialize({ z: 1, a: { y: 2, x: 3 }, list: [2, 1] })).toBe(
      '{"a":{"x":3,"y":2},"list":[2,1],"z":1}'
    );
  });

  it("detects a deterministic executor over 100 independent runs", async () => {
    const result = await runDeterminismHarness({
      command: { widthMm: 2400, sectionWidthsMm: [600, 1000, 800] },
      execute: async (command) => ({ revision: 1, command })
    });
    expect(result).toMatchObject({ deterministic: true, runs: DEFAULT_DETERMINISM_RUNS, mismatchRun: null });
  });

  it("reports the first non-deterministic run", async () => {
    let invocation = 0;
    const result = await runDeterminismHarness({
      runs: 3,
      command: { widthMm: 2400 },
      execute: async () => ({ invocation: invocation += 1 })
    });
    expect(result).toMatchObject({ deterministic: false, mismatchRun: 2 });
  });

  test.todo("BLOCKED: run the same canonical wardrobe_create command 100 times against Claude's deterministic kernel");
});
