/**
 * M3.3 â€” Machine profile schema + signature verification
 * =====================================================================
 * Fail-closed authorization for CAM export. A profile without a valid
 * HMAC signature cannot authorize machine-file emission.
 *
 * Signature: HMAC-SHA256 over canonical JSON of the unsigned profile body,
 * hex-encoded in profile.signature. Verification key via options.signingSecret.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { UNAUTHENTICATED_MACHINE_PROFILE } from "./neutralOperations.js";

export const MANUFACTURERS = Object.freeze(["HOMAG", "BIESSE", "GENERIC_ISO"]);

export const MACHINE_PROFILE_SCHEMA_VERSION = "machine-profile/0.1";

/**
 * Canonical JSON for signing (stable key order, no signature field).
 * @param {object} profile
 * @returns {string}
 */
export function canonicalizeProfileForSigning(profile) {
  if (!profile || typeof profile !== "object") return "";
  const { signature, signed, ...rest } = profile;
  return JSON.stringify(sortKeysDeep(rest));
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeysDeep(value[key]);
    }
    return out;
  }
  return value;
}

/**
 * @param {object} profileBody â€” without signature
 * @param {string} signingSecret
 * @returns {string} hex HMAC
 */
export function signMachineProfile(profileBody, signingSecret) {
  if (!signingSecret || typeof signingSecret !== "string") {
    throw new Error("signMachineProfile requires a signingSecret string.");
  }
  const payload = canonicalizeProfileForSigning(profileBody);
  return createHmac("sha256", signingSecret).update(payload, "utf8").digest("hex");
}

/**
 * Attach signature to a profile body.
 * @param {object} profileBody
 * @param {string} signingSecret
 */
export function createSignedMachineProfile(profileBody, signingSecret) {
  const body = { ...profileBody, schemaVersion: profileBody.schemaVersion || MACHINE_PROFILE_SCHEMA_VERSION };
  const signature = signMachineProfile(body, signingSecret);
  return { ...body, signature, signed: true };
}

/**
 * Structural schema check (no crypto).
 * @param {object} profile
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateMachineProfileSchema(profile) {
  const errors = [];
  if (!profile || typeof profile !== "object") {
    return { ok: false, errors: ["profile must be an object"] };
  }
  if (!MANUFACTURERS.includes(profile.manufacturer)) {
    errors.push(`manufacturer must be one of ${MANUFACTURERS.join("|")}`);
  }
  if (typeof profile.model !== "string" || !profile.model.trim()) {
    errors.push("model must be a non-empty string");
  }
  if (typeof profile.controller !== "string" || !profile.controller.trim()) {
    errors.push("controller must be a non-empty string");
  }
  const kin = profile.kinematics;
  if (!kin || typeof kin !== "object") {
    errors.push("kinematics is required");
  } else {
    if (!(Number(kin.maxSpindleRpm) > 0)) errors.push("kinematics.maxSpindleRpm must be > 0");
    if (!(Number(kin.maxFeedrateMmMin) > 0)) errors.push("kinematics.maxFeedrateMmMin must be > 0");
    const t = kin.travelLimits;
    if (!t || !(Number(t.x) > 0) || !(Number(t.y) > 0) || !(Number(t.z) > 0)) {
      errors.push("kinematics.travelLimits.{x,y,z} must all be > 0");
    }
  }
  if (!Array.isArray(profile.toolTable) || profile.toolTable.length === 0) {
    errors.push("toolTable must be a non-empty array");
  } else {
    profile.toolTable.forEach((tool, i) => {
      if (!tool || typeof tool !== "object") {
        errors.push(`toolTable[${i}] must be an object`);
        return;
      }
      if (typeof tool.toolId !== "string" || !tool.toolId.trim()) {
        errors.push(`toolTable[${i}].toolId required`);
      }
      if (!(Number(tool.diameterMm) > 0)) errors.push(`toolTable[${i}].diameterMm must be > 0`);
      if (!(Number(tool.fluteCount) >= 1)) errors.push(`toolTable[${i}].fluteCount must be >= 1`);
      if (!(Number(tool.maxPlungeRate) > 0)) errors.push(`toolTable[${i}].maxPlungeRate must be > 0`);
    });
  }
  return { ok: errors.length === 0, errors };
}

function safeEqualHex(a, b) {
  try {
    const ba = Buffer.from(String(a), "hex");
    const bb = Buffer.from(String(b), "hex");
    if (ba.length === 0 || ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Full validation: schema + signature.
 *
 * @param {object} profile
 * @param {{ signingSecret?: string, requireSignature?: boolean }} [options]
 * @returns {{ ok: true, profile: object } | never}
 */
export function validateMachineProfile(profile, options = {}) {
  const schema = validateMachineProfileSchema(profile);
  if (!schema.ok) {
    const err = new Error(`Invalid machine profile: ${schema.errors.join("; ")}`);
    err.code = "INVALID_MACHINE_PROFILE";
    err.errors = schema.errors;
    throw err;
  }

  const requireSignature = options.requireSignature !== false;
  if (requireSignature) {
    const secret = options.signingSecret;
    if (!secret) {
      const err = new Error("validateMachineProfile requires options.signingSecret when requireSignature is true.");
      err.code = UNAUTHENTICATED_MACHINE_PROFILE;
      throw err;
    }
    if (!profile.signature || typeof profile.signature !== "string") {
      const err = new Error("Machine profile missing signature â€” export refused.");
      err.code = UNAUTHENTICATED_MACHINE_PROFILE;
      throw err;
    }
    const expected = signMachineProfile(profile, secret);
    if (!safeEqualHex(expected, profile.signature)) {
      const err = new Error("Machine profile signature verification failed â€” export refused.");
      err.code = UNAUTHENTICATED_MACHINE_PROFILE;
      throw err;
    }
  }

  return { ok: true, profile };
}

/**
 * Assert profile is valid+signed or throw UNAUTHENTICATED_MACHINE_PROFILE.
 */
export function assertValidSignedMachineProfile(profile, options = {}) {
  try {
    return validateMachineProfile(profile, { requireSignature: true, ...options });
  } catch (err) {
    if (err.code === "INVALID_MACHINE_PROFILE") {
      const wrapped = new Error(err.message);
      wrapped.code = UNAUTHENTICATED_MACHINE_PROFILE;
      wrapped.cause = err;
      throw wrapped;
    }
    throw err;
  }
}
