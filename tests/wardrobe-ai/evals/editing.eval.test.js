import { describe, expect, test } from "vitest";
import { runWardrobeAgent } from "@/lib/wardrobe-agent/runWardrobeAgent";
import { createFakeWardrobeAgentProvider } from "@/lib/wardrobe-agent/fakeWardrobeAgentProvider";
import { createWardrobe, addSection, addComponent } from "@/lib/wardrobe-model/kernel";

/**
 * Wardrobe AI evaluation suite — resizing, reference-based edits, and
 * multi-edit-in-one-message prompts, on an EXISTING model, not a freshly
 * created one (creation itself is covered by creation.eval.test.js).
 */
function threeShelfWardrobe() {
  let model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
  const sectionId = model.sections[0].id;
  model = addComponent(model, { sectionId, type: "SHELF" });
  model = addComponent(model, { sectionId, type: "SHELF" });
  model = addComponent(model, { sectionId, type: "SHELF" });
  return model;
}

function twoSectionWardrobe() {
  let model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
  model = addSection(model, { widthMm: 900 });
  return model;
}

describe("eval: resizing", () => {
  test("'make the left section 700mm' resizes exactly that section, on an existing multi-section wardrobe", async () => {
    const model = twoSectionWardrobe();
    const leftId = model.sections[0].id;

    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "section_resize", input: { sectionId: leftId, widthMm: 700 } }] },
      { text: "Left section is now 700mm." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Make the left section 700mm." });

    expect(result.model.sections.find((s) => s.id === leftId).widthMm).toBe(700);
    expect(result.model.id).toBe(model.id); // same wardrobe
  });

  test("'make the right section 500mm' resizes the OTHER section, left is untouched by identity", async () => {
    const model = twoSectionWardrobe();
    const rightId = model.sections[1].id;
    const leftId = model.sections[0].id;

    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "section_resize", input: { sectionId: rightId, widthMm: 500 } }] },
      { text: "Right section is now 500mm." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Make the right section 500mm." });

    expect(result.model.sections.find((s) => s.id === rightId).widthMm).toBe(500);
    expect(result.model.sections.map((s) => s.id)).toEqual([leftId, rightId]); // no section was added/removed
  });

  test("wardrobe_resize changes overall dimensions without inventing a new wardrobe identity", async () => {
    const model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_resize", input: { heightMm: 2400 } }] },
      { text: "Lowered the height to 2400mm." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Make it 2400mm tall instead." });
    expect(result.model.heightMm).toBe(2400);
    expect(result.model.id).toBe(model.id);
  });

  test("resizing the wardrobe deeper does not change its width or height", async () => {
    const model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "wardrobe_resize", input: { depthMm: 650 } }] },
      { text: "Made it 650mm deep." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Make it deeper, 650mm." });
    expect(result.model).toMatchObject({ widthMm: 2400, heightMm: 2600, depthMm: 650 });
  });

  test("shrinking a section by an exact amount ('50mm narrower')", async () => {
    const model = twoSectionWardrobe();
    const leftId = model.sections[0].id;
    const currentWidth = model.sections[0].widthMm;
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "section_resize", input: { sectionId: leftId, widthMm: currentWidth - 50 } }] },
      { text: "Made the left section 50mm narrower." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Make the left section 50mm narrower." });
    expect(result.model.sections.find((s) => s.id === leftId).widthMm).toBe(currentWidth - 50);
  });
});

describe("eval: reference-based edits", () => {
  test("'move shelf 3 up exactly 125mm' resolves to the correct component and exact delta", async () => {
    const model = threeShelfWardrobe();
    const thirdShelf = model.sections[0].components[2];
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "component_move", input: { componentId: thirdShelf.id, axis: "z", deltaMm: 125 } }] },
      { text: "Moved the third shelf up 125mm." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Move shelf 3 up exactly 125mm." });

    const moved = result.model.sections[0].components.find((c) => c.id === thirdShelf.id);
    expect(moved.positionMm).toBe(thirdShelf.positionMm + 125);
    // the other two shelves are untouched
    const others = result.model.sections[0].components.filter((c) => c.id !== thirdShelf.id);
    const othersBefore = model.sections[0].components.filter((c) => c.id !== thirdShelf.id);
    expect(others.map((c) => c.positionMm)).toEqual(othersBefore.map((c) => c.positionMm));
  });

  test("'move shelf 1 down 30mm' resolves to the FIRST shelf, not the third", async () => {
    // Explicit, widely spaced positions so moving down 30mm neither goes
    // negative nor collides with a neighbouring shelf's zone.
    let model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    const sectionId = model.sections[0].id;
    model = addComponent(model, { sectionId, type: "SHELF", positionMm: 200 });
    model = addComponent(model, { sectionId, type: "SHELF", positionMm: 600 });
    model = addComponent(model, { sectionId, type: "SHELF", positionMm: 1000 });
    const [firstShelf, , thirdShelf] = model.sections[0].components;

    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "component_move", input: { componentId: firstShelf.id, axis: "z", deltaMm: -30 } }] },
      { text: "Moved the first shelf down 30mm." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Move shelf 1 down 30mm." });
    const moved = result.model.sections[0].components.find((c) => c.id === firstShelf.id);
    expect(moved.positionMm).toBe(firstShelf.positionMm - 30);
    // the third shelf's identity/position is untouched by an edit aimed at the first
    const untouched = result.model.sections[0].components.find((c) => c.id === thirdShelf.id);
    expect(untouched.positionMm).toBe(thirdShelf.positionMm);
  });

  test("'delete the first shelf' removes exactly one component, the other two survive", async () => {
    const model = threeShelfWardrobe();
    const firstShelf = model.sections[0].components[0];
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "component_remove", input: { componentId: firstShelf.id } }] },
      { text: "Removed the first shelf." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Delete the first shelf." });
    expect(result.model.sections[0].components).toHaveLength(2);
    expect(result.model.sections[0].components.some((c) => c.id === firstShelf.id)).toBe(false);
  });

  test("'the drawer bank' resolves by component type when there's only one", async () => {
    let model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    model = addComponent(model, { sectionId: model.sections[0].id, type: "DRAWER_BANK", rows: 3, positionMm: 0 });
    // explicit position, well clear of even the 5-row (900mm) size this test resizes up to
    model = addComponent(model, { sectionId: model.sections[0].id, type: "HANGING_RAIL", positionMm: 1200 });
    const drawerBank = model.sections[0].components.find((c) => c.type === "DRAWER_BANK");

    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "component_update", input: { componentId: drawerBank.id, properties: { rows: 5 } } }] },
      { text: "Changed the drawer bank to 5 rows." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Make the drawer bank have 5 rows instead." });
    expect(result.model.sections[0].components.find((c) => c.id === drawerBank.id).rows).toBe(5);
  });

  test("'the second rail' resolves to the correct one of two hanging rails", async () => {
    let model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    model = addComponent(model, { sectionId: model.sections[0].id, type: "HANGING_RAIL", positionMm: 100 });
    model = addComponent(model, { sectionId: model.sections[0].id, type: "HANGING_RAIL", positionMm: 1300 });
    const secondRail = model.sections[0].components[1];

    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "component_remove", input: { componentId: secondRail.id } }] },
      { text: "Removed the second rail." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Remove the second hanging rail." });
    expect(result.model.sections[0].components).toHaveLength(1);
    expect(result.model.sections[0].components[0].positionMm).toBe(100); // the first rail survived
  });
});

describe("eval: multi-edit prompts (one message, multiple tool calls in one turn)", () => {
  test("'move shelf 3 up 125mm and remove the first shelf' — two edits, one turn, one committed model", async () => {
    const model = threeShelfWardrobe();
    const [first, , third] = model.sections[0].components;
    const client = createFakeWardrobeAgentProvider([
      {
        toolCalls: [
          { name: "component_move", input: { componentId: third.id, axis: "z", deltaMm: 125 } },
          { name: "component_remove", input: { componentId: first.id } },
        ],
      },
      { text: "Moved shelf 3 up and removed shelf 1." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Move shelf 3 up 125mm and remove the first shelf." });

    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls.every((c) => c.result.success)).toBe(true);
    expect(result.model.sections[0].components).toHaveLength(2);
    expect(result.model.sections[0].components.find((c) => c.id === third.id).positionMm).toBe(third.positionMm + 125);
    expect(result.model.sections[0].components.some((c) => c.id === first.id)).toBe(false);
  });

  test("'resize the left section to 700mm and add three shelves there' — resize then add, same turn", async () => {
    const model = twoSectionWardrobe();
    const leftId = model.sections[0].id;
    const client = createFakeWardrobeAgentProvider([
      { toolCalls: [{ name: "section_resize", input: { sectionId: leftId, widthMm: 700 } }] },
      {
        toolCalls: [
          { name: "component_add", input: { sectionId: leftId, type: "SHELF" } },
          { name: "component_add", input: { sectionId: leftId, type: "SHELF" } },
          { name: "component_add", input: { sectionId: leftId, type: "SHELF" } },
        ],
      },
      { text: "Resized and added three shelves." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Resize the left section to 700mm and add three shelves there." });

    expect(result.model.sections.find((s) => s.id === leftId).widthMm).toBe(700);
    expect(result.model.sections.find((s) => s.id === leftId).components).toHaveLength(3);
  });

  test("a multi-edit turn where the SECOND edit fails leaves the first edit committed (partial success is real, not all-or-nothing)", async () => {
    const model = twoSectionWardrobe();
    const leftId = model.sections[0].id;
    const client = createFakeWardrobeAgentProvider([
      {
        toolCalls: [
          { name: "section_resize", input: { sectionId: leftId, widthMm: 700 } },
          { name: "component_add", input: { sectionId: "section-not-real", type: "SHELF" } },
        ],
      },
      { text: "Resized the left section; couldn't find the other section you meant." },
    ]);
    const result = await runWardrobeAgent({ client, model, message: "Resize the left section to 700mm and add a shelf to the other one." });

    expect(result.toolCalls[0].result.success).toBe(true);
    expect(result.toolCalls[1].result.success).toBe(false);
    expect(result.model.sections.find((s) => s.id === leftId).widthMm).toBe(700); // first edit's effect survives
  });
});

describe("eval: multi-turn continuity", () => {
  test("a sequence of edits all land on the SAME model, never a regenerated one", async () => {
    let model = createWardrobe({ widthMm: 2400, heightMm: 2600, depthMm: 600 });
    const wardrobeId = model.id;

    const turn1 = await runWardrobeAgent({
      client: createFakeWardrobeAgentProvider([
        { toolCalls: [{ name: "section_add", input: { widthMm: 900 } }] },
        { text: "Added a section." },
      ]),
      model,
      message: "Add a 900mm section.",
    });
    expect(turn1.model.id).toBe(wardrobeId);

    const shelfSectionId = turn1.model.sections[0].id;
    const turn2 = await runWardrobeAgent({
      client: createFakeWardrobeAgentProvider([
        { toolCalls: [{ name: "component_add", input: { sectionId: shelfSectionId, type: "SHELF" } }] },
        { text: "Added a shelf." },
      ]),
      model: turn1.model,
      conversation: turn1.conversation,
      message: "Add a shelf to the first section.",
    });
    expect(turn2.model.id).toBe(wardrobeId);
    expect(turn2.model.sections).toHaveLength(2); // the section from turn 1 persisted
    expect(turn2.model.sections[0].components).toHaveLength(1);
    expect(turn2.model.revision).toBe(turn1.model.revision + 1);
  });

  test("three sequential turns preserve every id from every prior turn", async () => {
    let model = createWardrobe({ widthMm: 900, heightMm: 2600, depthMm: 600 });
    let conversation = [];
    const wardrobeId = model.id;

    const turn1 = await runWardrobeAgent({
      client: createFakeWardrobeAgentProvider([
        { toolCalls: [{ name: "component_add", input: { sectionId: model.sections[0].id, type: "SHELF" } }] },
        { text: "Added a shelf." },
      ]),
      model, conversation, message: "Add a shelf.",
    });
    model = turn1.model; conversation = turn1.conversation;
    const shelfId = model.sections[0].components[0].id;

    const turn2 = await runWardrobeAgent({
      client: createFakeWardrobeAgentProvider([
        { toolCalls: [{ name: "component_add", input: { sectionId: model.sections[0].id, type: "HANGING_RAIL" } }] },
        { text: "Added a rail." },
      ]),
      model, conversation, message: "Add a hanging rail too.",
    });
    model = turn2.model; conversation = turn2.conversation;
    const railId = model.sections[0].components.find((c) => c.type === "HANGING_RAIL").id;

    const turn3 = await runWardrobeAgent({
      client: createFakeWardrobeAgentProvider([
        { toolCalls: [{ name: "component_move", input: { componentId: shelfId, axis: "z", deltaMm: 50 } }] },
        { text: "Moved the shelf up 50mm." },
      ]),
      model, conversation, message: "Move the shelf up 50mm.",
    });

    expect(turn3.model.id).toBe(wardrobeId);
    expect(turn3.model.sections[0].components.map((c) => c.id).sort()).toEqual([shelfId, railId].sort());
  });
});
