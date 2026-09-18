import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  createSignedMachineProfile,
  validateMachineProfile,
  validateMachineProfileSchema,
  assertValidSignedMachineProfile,
  MANUFACTURERS,
} from "../../src/lib/cam/machineProfileValidator.js";
import { UNAUTHENTICATED_MACHINE_PROFILE } from "../../src/lib/cam/neutralOperations.js";
import {
  emitDryRunWoodwopMprFromOperations,
  WOODWOP_DRY_RUN_MARKER,
} from "../../src/lib/cam/emitters/woodwopMprEmitter.js";
import {
  emitDryRunBiesseCixFromOperations,
  BIESSE_DRY_RUN_ATTR,
} from "../../src/lib/cam/emitters/biesseCixEmitter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures");

function load(name) {
  return readFileSync(path.join(fixturesDir, name), "utf8");
}

function normalizeDialect(text) {
  return String(text)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .trimEnd() + "\n";
}

/** Extract block hierarchy tokens for structural comparison. */
function woodwopHierarchy(text) {
  return text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("[") || l.startsWith("$P ") || l.startsWith("<100"))
    .join("\n");
}

function biesseHierarchy(text) {
  return text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => /^(BEGIN|END) ID=/.test(l) || l.includes('DRY_RUN="1"'))
    .join("\n");
}

const FORBIDDEN_LIVE = [/\bM03\b/i, /\bM04\b/i, /\bG81\b/, /\bG83\b/, /SPINDLE\s*=\s*ON/i];

const baseProfile = {
  id: "lab-homag-01",
  manufacturer: "HOMAG",
  model: "CENTATEQ-N-500",
  controller: "POWER_CONTROL",
  kinematics: {
    maxSpindleRpm: 24000,
    maxFeedrateMmMin: 25000,
    travelLimits: { x: 3200, y: 1600, z: 100 },
  },
  toolTable: [
    { toolId: "T1_COMP_6", diameterMm: 6, fluteCount: 2, maxPlungeRate: 800 },
    { toolId: "T2_PIN_5", diameterMm: 5, fluteCount: 2, maxPlungeRate: 400 },
  ],
};

describe("machineProfileValidator", () => {
  it("accepts manufacturers HOMAG | BIESSE | GENERIC_ISO", () => {
    expect(MANUFACTURERS).toEqual(["HOMAG", "BIESSE", "GENERIC_ISO"]);
  });

  it("rejects incomplete schema", () => {
    const r = validateMachineProfileSchema({ manufacturer: "HOMAG" });
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("signs and verifies with HMAC; fails closed without / bad signature", () => {
    const secret = "furniai-lab-signing-secret-v0";
    const signed = createSignedMachineProfile(baseProfile, secret);
    expect(signed.signature).toMatch(/^[0-9a-f]{64}$/);
    expect(validateMachineProfile(signed, { signingSecret: secret }).ok).toBe(true);

    try {
      validateMachineProfile({ ...baseProfile, signed: true }, { signingSecret: secret });
      expect.unreachable();
    } catch (err) {
      expect(err.code).toBe(UNAUTHENTICATED_MACHINE_PROFILE);
    }

    try {
      validateMachineProfile(
        { ...signed, signature: "00".repeat(32) },
        { signingSecret: secret }
      );
      expect.unreachable();
    } catch (err) {
      expect(err.code).toBe(UNAUTHENTICATED_MACHINE_PROFILE);
    }

    expect(() =>
      assertValidSignedMachineProfile(signed, { signingSecret: "wrong-secret" })
    ).toThrowError();
  });
});

describe("dialect golden round-trip fixtures", () => {
  const ops = JSON.parse(load("reference_box.operations.json"));

  it("Homag .mpr emitter matches reference_homag_box.mpr hierarchy + dry-run marker", () => {
    const golden = normalizeDialect(load("reference_homag_box.mpr"));
    const emitted = normalizeDialect(
      emitDryRunWoodwopMprFromOperations(ops, { programName: "REFERENCE_HOMAG_BOX" })
    );
    expect(emitted).toBe(golden);
    expect(emitted).toContain("[HEADER]");
    expect(emitted).toContain("$P ");
    expect(emitted).toContain(WOODWOP_DRY_RUN_MARKER);
    expect(woodwopHierarchy(emitted)).toBe(woodwopHierarchy(golden));
    expect(emitted).toContain("FAIL-CLOSED STUB: no WoodWOP boring");
    for (const re of FORBIDDEN_LIVE) expect(emitted).not.toMatch(re);
  });

  it("Biesse .cix emitter matches reference_biesse_box.cix hierarchy + DRY_RUN", () => {
    const golden = normalizeDialect(load("reference_biesse_box.cix"));
    const emitted = normalizeDialect(
      emitDryRunBiesseCixFromOperations(ops, { programName: "REFERENCE_BIESSE_BOX" })
    );
    expect(emitted).toBe(golden);
    expect(emitted).toContain('BEGIN ID="MACRO"');
    expect(emitted).toContain('END ID="MACRO"');
    expect(emitted).toContain(BIESSE_DRY_RUN_ATTR);
    expect(biesseHierarchy(emitted)).toBe(biesseHierarchy(golden));
    expect(emitted).toContain("FAIL-CLOSED STUB: no Biesse boring");
    for (const re of FORBIDDEN_LIVE) expect(emitted).not.toMatch(re);
  });

  it("reference fixtures themselves carry dry-run tags and no live spindle", () => {
    const mpr = load("reference_homag_box.mpr");
    const cix = load("reference_biesse_box.cix");
    expect(mpr).toContain(WOODWOP_DRY_RUN_MARKER);
    expect(cix).toContain(BIESSE_DRY_RUN_ATTR);
    for (const re of FORBIDDEN_LIVE) {
      expect(mpr).not.toMatch(re);
      expect(cix).not.toMatch(re);
    }
  });
});
