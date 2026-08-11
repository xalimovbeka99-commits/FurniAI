/**
 * ids — the stable-identity allocator for a WardrobeModel.
 * ---------------------------------------------------------------------
 * Type-prefixed, human-legible, kernel-allocated IDs: `wardrobe-01`,
 * `section-01`, `shelf-01`, `drawer-bank-01`, `hanging-rail-01`, `door-01`.
 * Each type has its own monotonic counter (`model.idCounters`), never
 * reused, never reassigned — allocated once at creation and carried
 * forward on every subsequent model unchanged.
 *
 * Deliberately NOT derived from render/geometry order (Three.js never
 * enters this file) and NOT a single shared counter across every entity
 * type (that would make "the 7th thing created" the identity, coupling
 * unrelated entities' IDs to each other's creation order for no reason).
 *
 * Deliberately NOT caller-supplied either: the kernel is the sole
 * allocator, so uniqueness and the naming scheme are guaranteed by
 * construction rather than by validating whatever string an LLM proposes.
 * See docs/KNOWN_LIMITATIONS.md for the explicit trade-off record of this
 * decision against Codex's caller-supplied-ID contract suggestion.
 */
const TYPE_SLUGS = Object.freeze({
  wardrobe: "wardrobe",
  section: "section",
  SHELF: "shelf",
  DRAWER_BANK: "drawer-bank",
  HANGING_RAIL: "hanging-rail",
  DOOR: "door",
});

export function slugFor(kind) {
  return TYPE_SLUGS[kind] || String(kind).toLowerCase().replace(/_/g, "-");
}

/**
 * @param {{ idCounters?: Record<string, number> }} model
 * @param {string} kind one of the keys above, or a raw COMPONENT_TYPES value
 * @returns {{ id: string, idCounters: Record<string, number> }}
 */
export function allocate(model, kind) {
  const slug = slugFor(kind);
  const counters = { ...(model.idCounters || {}) };
  const next = (counters[slug] || 0) + 1;
  counters[slug] = next;
  return { id: `${slug}-${String(next).padStart(2, "0")}`, idCounters: counters };
}

/** Deterministic ID for the divider between two adjacent sections — derived
 * from the two section IDs, not the counter, since it is fully determined by
 * adjacency and needs no allocation of its own. */
export function dividerId(leftSectionId, rightSectionId) {
  return `divider-${leftSectionId}-${rightSectionId}`;
}
