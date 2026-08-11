import { describe, expect, test } from "vitest";
import { runWardrobeAgent } from "@/lib/wardrobe-agent/runWardrobeAgent";
import { createFakeWardrobeAgentProvider } from "@/lib/wardrobe-agent/fakeWardrobeAgentProvider";
import { createWardrobe, addComponent } from "@/lib/wardrobe-model/kernel";

/**
 * Wardrobe AI evaluation suite — robustness: impossible requests,
 * unsupported components, and provider misbehavior. Every case here checks
 * that the model is either unchanged or changed only by a real, successful
 * tool call — never "changed" by narration alone.
 */
describe("eval: invalid / impossible requests", () => {
  test("an impossible dimension is rejected by the tool, model unchanged", async () => {
    const model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_resize", input: { widthMm: -500 } }] },
      { text: "A negative width isn't possible — did you mean to make it narrower by some amount?" },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Make it negative 500mm wide." });

    expect(result.toolCalls[0].result.success).toBe(false);
    expect(result.model).toEqual(model);
  });

  test("resizing a section that does not exist fails cleanly with a typed error, not a silent no-op success", async () => {
    const model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "section_resize", input: { sectionId: "S_nonexistent", widthMm: 700 } }] },
      { text: "I couldn't find that section." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Resize the section that isn't there." });
    expect(result.toolCalls[0].result).toMatchObject({ success: false, error: "SECTION_NOT_FOUND" });
  });

  test("unsupported request (a component type outside SHELF/DRAWER_BANK/HANGING_RAIL/DOOR) is refused, not invented", async () => {
    const model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    const client = createFakeWardrobeAgentProvider([
      { text: "A rotating carousel section isn't a component this system supports yet — I can add a shelf, drawer bank, hanging rail, or door instead." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Add a curved automated rotating carousel section." });

    expect(result.toolCalls).toHaveLength(0);
    expect(result.model).toEqual(model);
    expect(result.assistantMessage.toLowerCase()).toMatch(/support/);
  });

  test("if the provider names a tool that does not exist, it is rejected as TOOL_NOT_AVAILABLE, never executed as if it were real", async () => {
    const model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_paint", input: { color: "gold" } }] },
      { text: "I can't do that." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Paint it gold." });
    expect(result.toolCalls[0].result).toMatchObject({ success: false, error: "TOOL_NOT_AVAILABLE" });
    expect(result.model).toEqual(model);
  });

  test("a DIVIDER component_add request is refused as NOT_IMPLEMENTED, not silently dropped or faked", async () => {
    const model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "component_add", input: { sectionId: model.sections[0].id, type: "DIVIDER" } }] },
      { text: "Dividers are added automatically between sections — you can't add one directly." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Add a divider in the middle of this section." });
    expect(result.toolCalls[0].result).toMatchObject({ success: false, error: "NOT_IMPLEMENTED" });
  });

  test("moving along an unsupported axis is refused rather than guessed", async () => {
    const model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    const addClient = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "component_add", input: { sectionId: model.sections[0].id, type: "SHELF", positionMm: 0 } }] },
      { text: "Added a shelf." },
    ]);
    const added = await runWardrobeAgent({ client: addClient, model, message: "Add a shelf." });
    const shelfId = added.model.sections[0].components[0].id;

    const moveXClient = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "component_move", input: { componentId: shelfId, axis: "x", deltaMm: 50 } }] },
      { text: "Sideways movement isn't supported yet." },
    ]);
    const result = await runWardrobeAgent({ client: moveXClient, model: added.model, message: "Move that shelf sideways." });
    expect(result.toolCalls[0].result).toMatchObject({ success: false, error: "NOT_IMPLEMENTED" });
  });

  test("a fractional millimetre width is rejected, not silently rounded", async () => {
    const model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_resize", input: { widthMm: 2400.5 } }] },
      { text: "I need a whole millimetre value." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Make it 2400.5mm wide." });
    expect(result.toolCalls[0].result).toMatchObject({ success: false, error: "INVALID_DIMENSION" });
    expect(result.model).toEqual(model);
  });

  test("a section wider than the space available in the wardrobe is rejected, not clamped", async () => {
    const model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "section_resize", input: { sectionId: model.sections[0].id, widthMm: 5000 } }] },
      { text: "That's wider than the wardrobe itself." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Make this section 5000mm wide." });
    expect(result.toolCalls[0].result.success).toBe(false);
    expect(result.model).toEqual(model);
  });

  test("a drawer bank with an out-of-range row count is rejected", async () => {
    const model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "component_add", input: { sectionId: model.sections[0].id, type: "DRAWER_BANK", rows: 20 } }] },
      { text: "20 rows of drawers doesn't fit any reasonable wardrobe — the max is 8." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Add a drawer bank with 20 rows." });
    expect(result.toolCalls[0].result).toMatchObject({ success: false, error: "OUT_OF_RANGE" });
    expect(result.model).toEqual(model);
  });

  test("removing a component that does not exist fails cleanly rather than silently succeeding", async () => {
    const model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "component_remove", input: { componentId: "shelf-99" } }] },
      { text: "I couldn't find that component." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Remove shelf 99." });
    expect(result.toolCalls[0].result.success).toBe(false);
    expect(result.model).toEqual(model);
  });

  test("adding a shelf at a position that overlaps an existing shelf is rejected, not stacked on top", async () => {
    let model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    model = addComponent(model, { sectionId: model.sections[0].id, type: "SHELF", positionMm: 500 });
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "component_add", input: { sectionId: model.sections[0].id, type: "SHELF", positionMm: 505 } }] },
      { text: "That would overlap the existing shelf." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Add another shelf right there at 505mm." });
    expect(result.toolCalls[0].result).toMatchObject({ success: false, error: "COMPONENT_OVERLAP" });
    expect(result.model.sections[0].components).toHaveLength(1);
  });
});

describe("eval: unsupported components", () => {
  test("'add a wine rack' is refused, not mapped onto the closest existing type", async () => {
    const model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    const client = createFakeWardrobeAgentProvider([
      { text: "A wine rack isn't a component I can add — I support shelves, drawer banks, hanging rails, and doors." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Add a built-in wine rack." });
    expect(result.toolCalls).toHaveLength(0);
    expect(result.model).toEqual(model);
  });

  test("'make it L-shaped' is refused — corner/L-shaped carcasses are not modelled in Phase 1", async () => {
    const model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    const client = createFakeWardrobeAgentProvider([
      { text: "L-shaped and corner wardrobes aren't supported yet — I can only build a straight run of sections." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Turn this into an L-shaped corner wardrobe." });
    expect(result.toolCalls).toHaveLength(0);
    expect(result.model).toEqual(model);
  });

  test("'add a sliding door' is refused — only hinged doors (leaves/hingeSide) exist in Phase 1", async () => {
    const model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    const client = createFakeWardrobeAgentProvider([
      { text: "Sliding doors aren't modelled yet — I can add a hinged door instead." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Give it a sliding door." });
    expect(result.toolCalls).toHaveLength(0);
    expect(result.model).toEqual(model);
  });

  test("'add a plinth/base' is refused — no plinth concept exists in the model", async () => {
    const model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    const client = createFakeWardrobeAgentProvider([
      { text: "This model doesn't represent a plinth or base separately from the carcass yet." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Add a 100mm plinth at the base." });
    expect(result.toolCalls).toHaveLength(0);
    expect(result.model).toEqual(model);
  });
});

describe("eval: hallucination traps", () => {
  test("asking to move a shelf when none exist yet does not fabricate a component ID", async () => {
    const model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    const client = createFakeWardrobeAgentProvider([
      { text: "There aren't any shelves in this wardrobe yet — would you like me to add one first?" },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Move the shelf up 100mm." });
    expect(result.toolCalls).toHaveLength(0);
    expect(result.model).toEqual(model);
  });

  test("asking about a third section when only one exists does not silently invent it", async () => {
    const model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    const client = createFakeWardrobeAgentProvider([
      { text: "There's only one section right now — do you want me to split it into three?" },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Make the third section narrower." });
    expect(result.toolCalls).toHaveLength(0);
    expect(result.model.sections).toHaveLength(1);
  });

  test("the assistant claiming success in text without a successful tool call does not change the returned model", async () => {
    const model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    // A misbehaving provider that narrates a change but never calls a tool —
    // the model returned to the caller must be the untouched input model,
    // proving the UI can't be fooled by assistant text alone.
    const client = createFakeWardrobeAgentProvider([
      { text: "Done! I've added a shelf and two drawers for you." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Add a shelf and two drawers." });
    expect(result.toolCalls).toHaveLength(0);
    expect(result.model).toEqual(model);
    expect(result.model.sections[0].components).toHaveLength(0);
  });

  test("ambiguous reference ('the shelf' with three shelves present) is not silently resolved to an arbitrary one", async () => {
    let model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    model = addComponent(model, { sectionId: model.sections[0].id, type: "SHELF", positionMm: 100 });
    model = addComponent(model, { sectionId: model.sections[0].id, type: "SHELF", positionMm: 500 });
    model = addComponent(model, { sectionId: model.sections[0].id, type: "SHELF", positionMm: 900 });
    const client = createFakeWardrobeAgentProvider([
      { text: "There are three shelves — which one do you mean: the first, second, or third?" },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Move the shelf up." });
    expect(result.toolCalls).toHaveLength(0);
    expect(result.model).toEqual(model);
  });

  test("a wardrobe_create call mid-conversation on an existing model does not overwrite it silently as a hallucinated 'fresh start'", async () => {
    const model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    let modified = addComponent(model, { sectionId: model.sections[0].id, type: "SHELF", positionMm: 100 });
    // The provider hallucinates a brand-new wardrobe_create call instead of editing the existing one.
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_create", input: { widthMm: 1200, heightMm: 2600, depthMm: 600 } }] },
      { text: "Created a new wardrobe." },
    ]);
    const result = await runWardrobeAgent({ client, model: modified, message: "Also make the whole thing look nicer." });
    // The tool call executed for real (this is a legitimate tool, not a fabricated one) —
    // but it necessarily produced a FRESH model, not a mutation of the existing one.
    // Note: id allocation is per-model (idCounters starts fresh for every wardrobe_create),
    // so the new model's id string ("wardrobe-01") collides with the original's — id
    // equality alone can't be used to detect this. Structural evidence (dimensions and
    // lost components) is what actually proves it's a different model, not a mutation.
    expect(result.toolCalls[0].result.success).toBe(true);
    expect(result.model.widthMm).toBe(1200); // reflects the hallucinated create call's args, not the original 900mm
    expect(result.model.sections[0].components).toHaveLength(0); // the shelf from the prior turn did not carry over
  });
});
