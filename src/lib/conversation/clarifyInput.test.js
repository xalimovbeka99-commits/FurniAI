import { describe, expect, it } from "vitest";
import {
  parseDimension,
  parseAndValidateClarifyInput,
  ACCEPTED_DIMENSION_UNITS,
} from "./clarifyInput.js";

describe("clarifyInput — parseDimension", () => {
  describe("1. Every accepted unit spelling maps explicitly", () => {
    // mm variants: factor 1
    const mmSpellings = ["", "mm", "millimetre", "millimetres", "millimeter", "millimeters"];
    for (const u of mmSpellings) {
      const input = u ? `1800 ${u}` : "1800";
      it(`accepts '${input}' as 1800 mm`, () => {
        const res = parseDimension(input);
        expect(res.ok).toBe(true);
        expect(res.value).toBe(1800);
        if (u === "" || u === "mm") {
          expect(res.convertedText).toBeNull();
        } else {
          expect(res.convertedText).toBe("1800 mm");
        }
      });
    }

    // cm variants: factor 10
    const cmSpellings = ["cm", "centimetre", "centimetres", "centimeter", "centimeters"];
    for (const u of cmSpellings) {
      const input = `180 ${u}`;
      it(`accepts '${input}' as 1800 mm (x10)`, () => {
        const res = parseDimension(input);
        expect(res.ok).toBe(true);
        expect(res.value).toBe(1800);
        expect(res.convertedText).toBe("1800 mm");
      });
    }

    // m variants: factor 1000
    const mSpellings = ["m", "metre", "metres", "meter", "meters"];
    for (const u of mSpellings) {
      const input = `1.8 ${u}`;
      it(`accepts '${input}' as 1800 mm (x1000)`, () => {
        const res = parseDimension(input);
        expect(res.ok).toBe(true);
        expect(res.value).toBe(1800);
        expect(res.convertedText).toBe("1800 mm");
      });
    }

    it("handles case insensitivity for unit spellings", () => {
      expect(parseDimension("180 CENTIMETRES")).toEqual({ ok: true, value: 1800, convertedText: "1800 mm" });
      expect(parseDimension("180 Centimeters")).toEqual({ ok: true, value: 1800, convertedText: "1800 mm" });
      expect(parseDimension("1.8 METRES")).toEqual({ ok: true, value: 1800, convertedText: "1800 mm" });
      expect(parseDimension("1800 MM")).toEqual({ ok: true, value: 1800, convertedText: null });
      expect(parseDimension("1800 Millimeters")).toEqual({ ok: true, value: 1800, convertedText: "1800 mm" });
    });
  });

  describe("2. Exact decimal precision boundaries (0.1mm / integer deci-mm)", () => {
    it("1800.00000mm → accepts 1800mm without precision loss", () => {
      const res = parseDimension("1800.00000mm");
      expect(res.ok).toBe(true);
      expect(res.value).toBe(1800);
    });

    it("1800.00001mm → rejects (finer than 0.1mm)", () => {
      const res = parseDimension("1800.00001mm");
      expect(res.ok).toBe(false);
      expect(res.error).toContain("Precision finer than 0.1mm is not supported");
    });

    it("1.8001m → accepts 1800.1mm (18001 dmm integer)", () => {
      const res = parseDimension("1.8001m");
      expect(res.ok).toBe(true);
      expect(res.value).toBe(1800.1);
      expect(res.convertedText).toBe("1800.1 mm");
    });

    it("1.80001m → rejects (1800.01mm, finer than 0.1mm)", () => {
      const res = parseDimension("1.80001m");
      expect(res.ok).toBe(false);
      expect(res.error).toContain("Precision finer than 0.1mm is not supported");
    });

    it("180.05cm → accepts 1800.5mm (18005 dmm integer)", () => {
      const res = parseDimension("180.05cm");
      expect(res.ok).toBe(true);
      expect(res.value).toBe(1800.5);
      expect(res.convertedText).toBe("1800.5 mm");
    });

    it("180.005cm → rejects (1800.05mm, finer than 0.1mm)", () => {
      const res = parseDimension("180.005cm");
      expect(res.ok).toBe(false);
      expect(res.error).toContain("Precision finer than 0.1mm is not supported");
    });

    it("1800.1mm → accepts 1800.1mm", () => {
      const res = parseDimension("1800.1mm");
      expect(res.ok).toBe(true);
      expect(res.value).toBe(1800.1);
    });

    it("1800.09mm → rejects (finer than 0.1mm)", () => {
      const res = parseDimension("1800.09mm");
      expect(res.ok).toBe(false);
      expect(res.error).toContain("Precision finer than 0.1mm is not supported");
    });
  });

  describe("3. Signs, hedges, zero, and malformed inputs", () => {
    it("rejects negative dimensions with dedicated message", () => {
      const res = parseDimension("-1800");
      expect(res.ok).toBe(false);
      expect(res.error).toContain("Negative dimensions are not permitted");
    });

    it("rejects negative unit-bearing dimensions", () => {
      const res = parseDimension("-1.8m");
      expect(res.ok).toBe(false);
      expect(res.error).toContain("Negative dimensions are not permitted");
    });

    it("accepts explicit plus sign (+1800mm)", () => {
      const res = parseDimension("+1800mm");
      expect(res.ok).toBe(true);
      expect(res.value).toBe(1800);
    });

    it("rejects hedged inputs (about, roughly, approx, ~)", () => {
      expect(parseDimension("about 1800mm").error).toContain("Measurements must be exact");
      expect(parseDimension("roughly 2m").error).toContain("Measurements must be exact");
      expect(parseDimension("approx 1800").error).toContain("Measurements must be exact");
      expect(parseDimension("~600mm").error).toContain("Measurements must be exact");
      expect(parseDimension("1800 or so").error).toContain("Measurements must be exact");
    });

    it("rejects zero or negative resolved magnitude", () => {
      const res = parseDimension("0mm");
      expect(res.ok).toBe(false);
      expect(res.error).toContain("greater than zero");
    });

    it("rejects unsupported units (inches, feet, kg)", () => {
      expect(parseDimension("1800 inches").ok).toBe(false);
      expect(parseDimension("6 ft").ok).toBe(false);
      expect(parseDimension("50 kg").ok).toBe(false);
    });

    it("rejects malformed non-numeric strings", () => {
      expect(parseDimension("abc").ok).toBe(false);
      expect(parseDimension("1.2.3").ok).toBe(false);
      expect(parseDimension("").ok).toBe(false);
    });
  });
});

describe("clarifyInput — parseAndValidateClarifyInput", () => {
  it("dispatches dimension keys (envelope.*Mm, plinth.*Mm) through parseDimension", () => {
    const resW = parseAndValidateClarifyInput("envelope.widthMm", "180 centimetres");
    expect(resW).toEqual({ ok: true, value: 1800, convertedText: "1800 mm" });

    const resD = parseAndValidateClarifyInput("envelope.depthMm", "0.6m");
    expect(resD).toEqual({ ok: true, value: 600, convertedText: "600 mm" });

    const resH = parseAndValidateClarifyInput("envelope.heightMm", "1800.00001mm");
    expect(resH.ok).toBe(false);
  });

  describe("bayCount and doorCount validation", () => {
    it("accepts positive integers as digits", () => {
      expect(parseAndValidateClarifyInput("bayCount", "2")).toEqual({ ok: true, value: 2 });
      expect(parseAndValidateClarifyInput("doorCount", "4")).toEqual({ ok: true, value: 4 });
    });

    it("accepts word numbers", () => {
      expect(parseAndValidateClarifyInput("bayCount", "two")).toEqual({ ok: true, value: 2 });
      expect(parseAndValidateClarifyInput("doorCount", "four")).toEqual({ ok: true, value: 4 });
    });

    it("rejects fractional bay and door counts", () => {
      const resBay = parseAndValidateClarifyInput("bayCount", "2.5");
      expect(resBay.ok).toBe(false);
      expect(resBay.error).toContain("positive whole number");

      const resDoor = parseAndValidateClarifyInput("doorCount", "3.14");
      expect(resDoor.ok).toBe(false);
      expect(resDoor.error).toContain("positive whole number");
    });

    it("rejects zero and negative counts", () => {
      expect(parseAndValidateClarifyInput("bayCount", "0").ok).toBe(false);
      expect(parseAndValidateClarifyInput("bayCount", "-2").ok).toBe(false);
    });

    it("rejects hedged counts", () => {
      expect(parseAndValidateClarifyInput("bayCount", "about 2").ok).toBe(false);
      expect(parseAndValidateClarifyInput("doorCount", "roughly 4").ok).toBe(false);
    });
  });

  describe("finishType validation", () => {
    it("recognizes standard finishes", () => {
      expect(parseAndValidateClarifyInput("finishType", "white melamine").value).toBe("melamine");
      expect(parseAndValidateClarifyInput("finishType", "painted white").value).toBe("painted");
      expect(parseAndValidateClarifyInput("finishType", "oak veneer").value).toBe("veneer");
    });
  });

  describe("bayLayouts validation", () => {
    it("accepts valid array of layouts", () => {
      const layouts = ["LONG_HANGING", "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES"];
      const res = parseAndValidateClarifyInput("bayLayouts", layouts);
      expect(res.ok).toBe(true);
      expect(res.value).toEqual(layouts);
    });

    it("accepts valid JSON string array of layouts", () => {
      const json = JSON.stringify(["LONG_HANGING", "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES"]);
      const res = parseAndValidateClarifyInput("bayLayouts", json);
      expect(res.ok).toBe(true);
      expect(res.value).toEqual(["LONG_HANGING", "SHORT_HANGING_WITH_TWO_ADJUSTABLE_SHELVES"]);
    });

    it("rejects if any bay layout is missing or empty string", () => {
      const res = parseAndValidateClarifyInput("bayLayouts", ["LONG_HANGING", ""]);
      expect(res.ok).toBe(false);
      expect(res.error).toContain("Bay 2");
    });

    it("rejects ordinary text or invalid JSON", () => {
      const res = parseAndValidateClarifyInput("bayLayouts", "shelves and hanging");
      expect(res.ok).toBe(false);
      expect(res.error).toContain("Please use the bay selectors below");
    });
  });
});
