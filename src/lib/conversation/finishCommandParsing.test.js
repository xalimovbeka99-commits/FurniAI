/**
 * Finish commands — what the parser must recognise, and what it must refuse.
 *
 * Two separate risks live in one sentence pattern:
 *
 *   - A phrasing the parser misses spends a model call on a trivial edit,
 *     which is slower, costlier and less predictable than a branch.
 *   - A phrasing the parser over-claims repaints a whole wardrobe when the
 *     customer asked about one door. That is the worse of the two: a
 *     confident, fluent, wrong answer.
 *
 * Expected results here are written from the customer's intent, not from the
 * regex — each case says what a person meant, and asserts we did that.
 */
import { describe, it, expect } from "vitest";
import { parseConversationalCommand } from "./pipeline.js";

const parse = (text) => parseConversationalCommand(text, {});

describe("phrasings that mean 'change the wardrobe finish'", () => {
  const cases = [
    ["Make it walnut", "walnut"],
    ["Make it white", "white"],
    ["Change the finish to walnut", "walnut"],
    ["Use walnut finish", "walnut"],
    ["I want it in oak", "oak"],
    ["switch to navy", "navy"],
    ["Can we try sage?", "sage"],
    ["change the colour to grey", "grey"],
  ];

  for (const [text, expected] of cases) {
    it(`"${text}" changes the finish to ${expected}`, () => {
      const result = parse(text);
      expect(result, "fell through to the model unnecessarily").toBeTruthy();
      expect(result.error).toBeUndefined();
      expect(result.changes).toEqual({ materialKey: expected });
    });
  }
});

describe("a finish scoped to one part is refused, not applied to everything", () => {
  const cases = [
    ["Make the doors walnut", "doors"],
    ["Paint the interior white", "interior"],
    ["Can the shelves be oak?", "shelves"],
    ["I'd like the plinth black", "plinth"],
  ];

  for (const [text, part] of cases) {
    it(`"${text}" refuses rather than repainting the whole wardrobe`, () => {
      const result = parse(text);
      expect(result).toBeTruthy();
      expect(result.changes, "a per-part finish must not become a global one").toBeUndefined();
      expect(result.error).toContain(part);
      expect(result.error).toMatch(/unchanged/i);
      // The refusal offers the supported alternative in the customer's words.
      expect(result.error).toMatch(/make it /i);
    });
  }
});

describe("a request to add a part is answered as a part request", () => {
  // "Add black handles" is a request for handles. Answering it as a finish
  // problem would be fluent and wrong.
  const cases = ["Add black handles", "Fit walnut handles", "Give it black handles", "Install white handles"];

  for (const text of cases) {
    it(`"${text}" says handles cannot be added yet`, () => {
      const result = parse(text);
      expect(result).toBeTruthy();
      expect(result.changes).toBeUndefined();
      expect(result.error).toMatch(/handles/i);
      expect(result.error).toMatch(/can't add|cannot add/i);
      expect(result.error).toMatch(/unchanged/i);
      // It must NOT claim this is a finish limitation.
      expect(result.error).not.toMatch(/finish of the whole wardrobe/i);
    });
  }
});

describe("colours that are not commands stay out of the parser's way", () => {
  it("does not treat an aside about oak as an instruction", () => {
    expect(parse("The oak one in your showroom looks nice")).toBeNull();
  });

  it("does not hijack a dimension command that happens to contain no colour", () => {
    const result = parse("Make it 2000 mm wide");
    expect(result.changes).toEqual({ "envelope.widthMm": 2000 });
  });
});
