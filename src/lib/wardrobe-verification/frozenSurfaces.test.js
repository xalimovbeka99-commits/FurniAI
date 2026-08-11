import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildGeometry } from "../buildGeometry.js";
import { createDefaultConfig } from "../furnitureConfig.js";
import frozen from "../../../tests/wardrobe-ai/fixtures/frozen-surfaces.json";

describe("frozen builder/viewer/configurator surfaces", () => {
  for (const [relativePath, expectedHash] of Object.entries(frozen.files)) {
    it(`preserves ${relativePath}`, async () => {
      const content = await readFile(path.resolve(process.cwd(), relativePath));
      const actualHash = createHash("sha256").update(content).digest("hex");
      expect(actualHash).toBe(expectedHash);
    });
  }

  it("preserves the existing default wardrobe semantic behavior", () => {
    const config = createDefaultConfig("wardrobe");
    const parts = buildGeometry(config);
    const actual = {
      type: config.type,
      dimensionsMetres: config.dimensions,
      moduleKinds: config.modules.map((module) => module.kind),
      moduleCount: config.modules.length,
      shelfCount: parts.filter((part) => part.role === "shelf").length,
      drawerFrontCount: parts.filter((part) => part.role === "drawerFront").length,
      doorCount: parts.filter((part) => part.role === "door").length,
      dividerCount: parts.filter((part) => part.role === "divider").length
    };
    expect(actual).toEqual(frozen.defaultWardrobeSemanticBaseline);
  });
});
