import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildGeometry } from "../buildGeometry.js";
import { createDefaultConfig } from "../furnitureConfig.js";
import frozen from "../../../tests/wardrobe-ai/fixtures/frozen-surfaces.json";

function normalizedSha256(content) {
  const text = typeof content === "string" ? content : content.toString("utf8");
  return createHash("sha256").update(text.replace(/\r\n/g, "\n"), "utf8").digest("hex");
}

describe("frozen builder/viewer/configurator surfaces", () => {
  for (const [relativePath, expectedHash] of Object.entries(frozen.files)) {
    it(`preserves ${relativePath}`, async () => {
      const content = await readFile(path.resolve(process.cwd(), relativePath), "utf8");
      const actualHash = normalizedSha256(content);
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
      dividerCount: parts.filter((part) => part.role === "divider").length,
    };
    expect(actual).toEqual(frozen.defaultWardrobeSemanticBaseline);
  });
});
