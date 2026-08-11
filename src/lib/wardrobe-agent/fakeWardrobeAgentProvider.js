/**
 * Fake Wardrobe AI provider — the same role as ai-provider/fakeProvider.js,
 * for this agent's different (multi-turn, tool-calling) shape. Tests and the
 * eval suite must not call a paid live API by default (same rule as the
 * rest of this codebase) — this drives runWardrobeAgent.js deterministically,
 * with no network call.
 *
 * Two ways to use it:
 *
 *   createFakeWardrobeAgentProvider([
 *     { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 2400, heightMm: 2600, depthMm: 600 } }] },
 *     { text: "Created your wardrobe." },
 *   ])
 *     -> each array entry is one simulated `client.messages.create()` call,
 *        in order. `toolCalls` becomes tool_use content blocks (auto-
 *        assigned ids); `text` becomes a text block and, since it carries no
 *        tool_use block, ends runWardrobeAgent's loop for that turn.
 *
 *   createFakeWardrobeAgentProvider((callIndex, params) => ({ content: [...] }))
 *     -> full control when a scripted case needs to react to what the loop
 *        actually sent (e.g. asserting the tool_result from the previous
 *        step before deciding what to do next).
 */
function toolCallBlocks(step, callIndex) {
  const blocks = [];
  if (step.text) blocks.push({ type: "text", text: step.text });
  (step.toolCalls || []).forEach((call, i) => {
    blocks.push({ type: "tool_use", id: `fake_call_${callIndex}_${i}`, name: call.name, input: call.input });
  });
  return blocks;
}

export function createFakeWardrobeAgentProvider(script) {
  if (typeof script === "function") {
    let callIndex = 0;
    return {
      messages: {
        async create(params) {
          const response = await script(callIndex, params);
          callIndex += 1;
          return response;
        },
      },
    };
  }

  const steps = Array.isArray(script) ? script : [];
  let index = 0;
  return {
    messages: {
      async create() {
        if (index >= steps.length) {
          // Scripted steps exhausted without an explicit final text turn —
          // end the loop rather than looping forever on an empty script.
          return { content: [{ type: "text", text: "" }] };
        }
        const content = toolCallBlocks(steps[index], index);
        index += 1;
        return { content };
      },
    },
  };
}
