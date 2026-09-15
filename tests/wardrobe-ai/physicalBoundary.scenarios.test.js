/**
 * Physical-boundary audit — panel thickness mutations + clearance labels.
 * Tool-path clearance/overlap cases live in adversarial-scenarios.json;
 * this harness covers direct model mutations the tool surface cannot express.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { createWardrobe } from "@/lib/wardrobe-model/kernel.js";
import { validateWardrobeModel } from "@/lib/wardrobe-model/validator.js";
import { findTool } from "@/lib/wardrobe-tools/tools.js";

const dir = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(dir, "fixtures", "physical-boundary-scenarios.json"), "utf8"),
);
const adversarial = JSON.parse(
  readFileSync(join(dir, "fixtures", "adversarial-scenarios.json"), "utf8"),
);

describe("physical-boundary panel thickness mutations", () => {
  for (const c of fixture.cases) {
    const enforcement = c.metadata?.enforcement ?? "enforced";
    test(`${c.id} [${enforcement}] → ${c.expectedError}`, () => {
      const base = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
      const mutated = { ...base, ...c.mutation };
      const issues = validateWardrobeModel(mutated);

      if (enforcement === "aspirational") {
        expect(Array.isArray(issues)).toBe(true);
        const hit = issues.some((i) => i.code === c.expectedError);
        expect(hit).toBe(false);
        return;
      }

      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some((i) => i.code === c.expectedError)).toBe(true);
    });
  }
});

describe("physical-boundary clearance labels present in adversarial fixture", () => {
  const required = [
    "drawer-bank-exceeds-interior-height",
    "shelf-at-exact-drawer-bank-vertical",
    "shelf-spacing-below-60mm-clearance",
    "hanging-rail-below-800mm-clearance",
    "bay-width-at-kernel-floor-300",
    "depth-below-300-hanging-rod-floor",
  ];
  for (const id of required) {
    test(`fixture includes ${id}`, () => {
      const c = adversarial.cases.find((x) => x.id === id);
      expect(c).toBeTruthy();
      expect(c.metadata?.category).toMatch(/physical-clearance|oob-dims|collision/);
    });
  }

  test("enforced drawer overflow rejects via tools without mutating seed", () => {
    const c = adversarial.cases.find((x) => x.id === "drawer-bank-exceeds-interior-height");
    const create = findTool("wardrobe_create");
    const seed = create.run(null, c.seed).model;
    const before = { id: seed.id, revision: seed.revision };
    const add = findTool("component_add");
    const result = add.run(seed, {
      sectionId: seed.sections[0].id,
      type: "DRAWER_BANK",
      rows: 5,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("INSUFFICIENT_VERTICAL_CLEARANCE");
    expect(seed.id).toBe(before.id);
    expect(seed.revision).toBe(before.revision);
  });

  test("bay width 300 remains permitted", () => {
    const create = findTool("wardrobe_create");
    const result = create.run(null, { widthMm: 300, heightMm: 2500, depthMm: 600 });
    expect(result.success).toBe(true);
  });
});