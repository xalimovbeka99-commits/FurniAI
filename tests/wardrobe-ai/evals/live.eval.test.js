import { describe, expect, test } from "vitest";
import { runWardrobeAgent } from "@/lib/wardrobe-agent/runWardrobeAgent";
import { createAnthropicChatClient, createOpenAIChatClient } from "@/lib/ai-provider";

/**
 * Live Wardrobe AI evaluation — the real model, real judgement, real cost.
 * ----------------------------------------------------------------------
 * Not part of normal CI (see docs/KNOWN_LIMITATIONS.md): skipped whenever
 * ANTHROPIC_API_KEY isn't set, so `npx vitest run` never makes a network
 * call or spends money by default. Run explicitly with:
 *
 *   ANTHROPIC_API_KEY=sk-... npx vitest run tests/wardrobe-ai/evals/live.eval.test.js
 *
 * This exists because the fake-provider suites (creation/editing/robustness
 * .eval.test.js) prove the LOOP and the TOOLS are correct given a scripted
 * model response — they cannot prove the real model reliably picks the
 * right tool calls for open-ended natural language. This suite is that
 * second, real check, matching Codex's own recommendation in
 * docs/WARDROBE_AI_VERIFICATION_REPORT.md: "deterministic fake-provider/
 * tool-loop evals for CI and a separately reported live-provider
 * evaluation run."
 */
describe.skipIf(!process.env.ANTHROPIC_API_KEY)("eval: live provider", () => {
  test("creates a wardrobe matching the stated dimensions from one open-ended message", async () => {
    const client = createAnthropicChatClient();
    const result = await runWardrobeAgent({
      client,
      model: null,
      message: "Create a 2400mm wide, 2600mm high, 600mm deep wardrobe with three sections.",
    });

    expect(result.model).toBeTruthy();
    expect(result.model.widthMm).toBe(2400);
    expect(result.model.heightMm).toBe(2600);
    expect(result.model.depthMm).toBe(600);
    expect(result.model.sections.length).toBe(3);
  }, 30000);

  test("a follow-up edit mutates the same wardrobe rather than starting over", async () => {
    const client = createAnthropicChatClient();
    const turn1 = await runWardrobeAgent({
      client,
      model: null,
      message: "Create a 2400x2600x600 wardrobe with two sections.",
    });
    const wardrobeId = turn1.model.id;

    const turn2 = await runWardrobeAgent({
      client,
      model: turn1.model,
      conversation: turn1.conversation,
      message: "Make the first section 700mm wide.",
    });

    expect(turn2.model.id).toBe(wardrobeId);
    expect(turn2.model.sections[0].widthMm).toBe(700);
  }, 30000);

  test("refuses an unsupported request instead of inventing a component", async () => {
    const client = createAnthropicChatClient();
    const created = await runWardrobeAgent({
      client,
      model: null,
      message: "Create a 2400x2600x600 wardrobe.",
    });
    const result = await runWardrobeAgent({
      client,
      model: created.model,
      conversation: created.conversation,
      message: "Add a motorized rotating carousel section that spins the clothes into view.",
    });

    expect(result.model).toEqual(created.model); // unchanged: nothing valid to call
  }, 30000);
});

/**
 * One controlled live smoke test against the real OpenAI provider (Step 12
 * of the provider-failover mission) — proves the OpenAI chat adapter
 * actually drives the same eight Wardrobe tools against a live model, not
 * just against mocks. Skipped whenever OPENAI_API_KEY isn't set, same
 * convention as the Anthropic suite above:
 *
 *   OPENAI_API_KEY=sk-... npx vitest run tests/wardrobe-ai/evals/live.eval.test.js
 */
describe.skipIf(!process.env.OPENAI_API_KEY)("eval: live provider (OpenAI)", () => {
  test("creates a wardrobe matching the stated dimensions from one open-ended message", async () => {
    const client = createOpenAIChatClient();
    const result = await runWardrobeAgent({
      client,
      model: null,
      message: "Create a 2400mm wide, 2600mm high, 600mm deep wardrobe with three sections.",
    });

    expect(result.model).toBeTruthy();
    expect(result.model.widthMm).toBe(2400);
    expect(result.model.heightMm).toBe(2600);
    expect(result.model.depthMm).toBe(600);
    expect(result.model.sections.length).toBe(3);
  }, 30000);
});
