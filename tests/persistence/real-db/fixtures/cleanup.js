/**
 * Narrow cleanup helpers for harness-created designs.
 * Simulated: drop tracked rows. Real-db: record ids for manual §7 teardown.
 * NOT production code.
 */

export function createCleanupTracker(prefix = "harness-db-") {
  const ids = [];
  return {
    prefix,
    track(designId) {
      if (designId) ids.push(designId);
    },
    ids: () => [...ids],
    async cleanupSimulated(world) {
      if (world?.cleanup) await world.cleanup();
      ids.length = 0;
    },
    realDbTeardownNotes() {
      return [
        `Manual teardown (procedure §7): delete designs with prefix "${prefix}"`,
        `Tracked designIds (${ids.length}): ${ids.join(", ") || "(none)"}`,
        "Then delete throwaway auth users A/B and unset TOKEN_A TOKEN_B",
      ];
    },
  };
}
