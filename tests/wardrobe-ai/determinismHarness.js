import { isDeepStrictEqual } from "node:util";

export const DEFAULT_DETERMINISM_RUNS = 100;

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

export function canonicalSerialize(value) {
  return JSON.stringify(canonicalize(value));
}

export async function runDeterminismHarness({ execute, command, runs = DEFAULT_DETERMINISM_RUNS }) {
  if (typeof execute !== "function") throw new TypeError("execute must be a function");
  if (!Number.isInteger(runs) || runs < 2) throw new RangeError("runs must be an integer >= 2");

  const outputs = [];
  for (let run = 0; run < runs; run += 1) {
    outputs.push(canonicalSerialize(await execute(structuredClone(command))));
  }

  const baseline = outputs[0];
  const mismatchIndex = outputs.findIndex((output) => !isDeepStrictEqual(output, baseline));
  return {
    deterministic: mismatchIndex === -1,
    runs,
    mismatchRun: mismatchIndex === -1 ? null : mismatchIndex + 1,
    canonicalOutput: baseline
  };
}
