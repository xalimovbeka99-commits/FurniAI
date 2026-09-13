/**
 * Adversarial fixture harness — executes tests/wardrobe-ai/fixtures/adversarial-scenarios.json
 * against the real wardrobe tools / agent loop.
 *
 * Fail-closed contract (enforced cases):
 *   success === false, expectedError matches, model + revision unchanged when a seed exists.
 *
 * Permitted cases (metadata.enforcement === "permitted" or expectedSuccess):
 *   success === true; used to lock in floors that must remain allowed (e.g. bay width 300,
 *   shelf spacing 60-99mm).
 *
 * Aspirational cases are recorded in the fixture with metadata.enforcement === "aspirational"
 * and are asserted only as documentation (they must still not throw / crash the harness).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { findTool } from "@/lib/wardrobe-tools/tools.js";
import { createWardrobe, addSection, addComponent } from "@/lib/wardrobe-model/kernel.js";
import { runWardrobeAgent } from "@/lib/wardrobe-agent/runWardrobeAgent.js";
import { createFakeWardrobeAgentProvider } from "@/lib/wardrobe-agent/fakeWardrobeAgentProvider.js";

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "adversarial-scenarios.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

function buildSeed(seed) {
  if (!seed) return null;
  let model = createWardrobe({
    widthMm: seed.widthMm,
    heightMm: seed.heightMm,
    depthMm: seed.depthMm,
  });
  for (const extra of seed.extraSections || []) {
    model = addSection(model, { widthMm: extra.widthMm });
  }
  for (const c of seed.components || []) {
    const sectionId = model.sections[c.section ?? 0].id;
    model = addComponent(model, {
      sectionId,
      type: c.type,
      positionMm: c.positionMm,
      ...(c.rows !== undefined ? { rows: c.rows } : {}),
    });
  }
  return model;
}

function resolvePlaceholders(value, model) {
  if (typeof value === "string") {
    if (value === "$section0") return model?.sections?.[0]?.id;
    if (value === "$component0") {
      for (const s of model?.sections || []) {
        if (s.components[0]) return s.components[0].id;
      }
      return value;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => resolvePlaceholders(v, model));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolvePlaceholders(v, model)]));
  }
  return value;
}

function snapshotIdentity(model) {
  if (!model) return null;
  return {
    id: model.id,
    revision: model.revision,
    widthMm: model.widthMm,
    heightMm: model.heightMm,
    depthMm: model.depthMm,
    panelThicknessMm: model.panelThicknessMm,
    sectionIds: model.sections.map((s) => s.id),
    componentIds: model.sections.flatMap((s) => s.components.map((c) => c.id)),
  };
}

describe("adversarial-scenarios fixture harness", () => {
  test("fixture has at least 15 newly added cases beyond the original eight ids", () => {
    const originalIds = new Set([
      "negative-width",
      "zero-height",
      "section-exceeds-space",
      "shelf-outside-section",
      "overlapping-components",
      "unsupported-component",
      "fabricated-tool",
      "llm-geometry-coordinates",
    ]);
    const allIds = fixture.cases.map((c) => c.id);
    const newIds = allIds.filter((id) => !originalIds.has(id));
    expect(allIds.length).toBeGreaterThanOrEqual(23);
    expect(newIds.length).toBeGreaterThanOrEqual(15);
  });

  for (const c of fixture.cases) {
    const enforcement = c.metadata?.enforcement ?? "enforced";
    const label = c.expectedError || (c.expectedSuccess ? "success" : "doc");
    test(`${c.id} [${enforcement}] → ${label}`, async () => {
      const seedModel = buildSeed(c.seed);
      const before = snapshotIdentity(seedModel);

      if (enforcement === "aspirational") {
        // Document-only: must not crash; do not require fail-closed yet.
        if (c.request) {
          const tool = findTool(c.request.tool);
          expect(tool).toBeTruthy();
          const args = resolvePlaceholders(c.request.arguments, seedModel);
          const result = tool.run(seedModel, args === null ? null : args);
          expect(result).toBeTruthy();
          expect(typeof result.success).toBe("boolean");
        }
        return;
      }

      if (enforcement === "permitted" || c.expectedSuccess) {
        expect(c.request, `${c.id} needs request`).toBeTruthy();
        const tool = findTool(c.request.tool);
        expect(tool, `unknown tool ${c.request.tool}`).toBeTruthy();
        const args = resolvePlaceholders(c.request.arguments, seedModel);
        const result = tool.run(seedModel, args);
        expect(result.success).toBe(true);
        expect(result.model).toBeTruthy();
        return;
      }

      if (c.agentToolCall) {
        const client = createFakeWardrobeAgentProvider([
          { toolCalls: [c.agentToolCall] },
          { text: "That tool is not available." },
        ]);
        const result = await runWardrobeAgent({
          client,
          model: seedModel,
          message: c.prompt || `Adversarial: ${c.id}`,
        });
        expect(result.toolCalls[0].result).toMatchObject({
          success: false,
          error: c.expectedError,
        });
        expect(snapshotIdentity(result.model)).toEqual(before);
        return;
      }

      expect(c.request, `${c.id} needs request or agentToolCall`).toBeTruthy();
      const tool = findTool(c.request.tool);
      expect(tool, `unknown tool ${c.request.tool}`).toBeTruthy();
      const args = resolvePlaceholders(c.request.arguments, seedModel);
      const result = tool.run(seedModel, args);

      expect(result.success).toBe(false);
      expect(result.error).toBe(c.expectedError);
      expect(result.model).toBeUndefined();

      if (seedModel) {
        expect(snapshotIdentity(seedModel)).toEqual(before);
      }
    });
  }
});