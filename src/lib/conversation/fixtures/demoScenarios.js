/**
 * FurniAI — AI-Alpha conversation fixtures (Gate G4)
 * ---------------------------------------------------------------------
 * Shared by `npm run demo:ai-wardrobe` and the unit suite so the demo and
 * the tests provably exercise the same text.
 */

export const COMPLETE_DESCRIPTION =
  "I need a straight hinged wardrobe for the master bedroom. It should be 1800mm wide, " +
  "2400mm tall and 600mm deep, standing on a 100mm plinth. Split it into two bays with " +
  "four hinged doors in white melamine. The left bay is full-height hanging with a shelf " +
  "over the top. The right bay is short hanging over two adjustable shelves, also with a top shelf.";

export const INCOMPLETE_DESCRIPTION =
  "I need a wardrobe for my bedroom, about 2 metres tall.";

export const OUT_OF_SLICE_DESCRIPTION =
  "Can you do a 3000mm wide, 2400mm high, 650mm deep sliding-door wardrobe on a 100mm plinth?";

/** Answers a customer gives to the questions raised by INCOMPLETE_DESCRIPTION. */
export const INCOMPLETE_ANSWERS = Object.freeze({
  "envelope.widthMm": 1800.0,
  "envelope.heightMm": 2400.0,
  "envelope.depthMm": 600.0,
  "plinth.heightMm": 100.0,
  bayCount: 2,
  doorCount: 4,
  finishType: "melamine",
  bayLayouts: ["LONG_HANGING", "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES"],
});
