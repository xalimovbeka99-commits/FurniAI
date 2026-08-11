import { describe, expect, it } from "vitest";
import {
  canonicalSerialize,
  DEFAULT_DETERMINISM_RUNS,
  runDeterminismHarness
} from "../../../tests/wardrobe-ai/determinismHarness.js";
import { createWardrobe } from "../wardrobe-model/kernel.js";

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

  it("EXECUTED: runs the same canonical wardrobe_create command 100 times against the real deterministic kernel", async () => {
    const result = await runDeterminismHarness({
      command: { widthMm: 2400, heightMm: 2600, depthMm: 600 },
      execute: async (command) => createWardrobe(command),
    });
    expect(result).toMatchObject({ deterministic: true, runs: DEFAULT_DETERMINISM_RUNS, mismatchRun: null });
    const model = JSON.parse(result.canonicalOutput);
    expect(model.id).toBe("wardrobe-01");
    expect(model.sections[0].id).toBe("section-01");
  });
});
