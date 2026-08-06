/**
 * Evolve package detection — configuration, not hardcoded detector logic.
 * Marker files may appear at package root, under course/, or under course/{locale}/.
 */
export const EVOLVE_REQUIRED_MARKERS = [
  'config.json',
  'contentObjects.json',
  'articles.json',
  'blocks.json',
  'components.json',
] as const;

/** Optional but commonly present Evolve / Adapt JSON files */
export const EVOLVE_OPTIONAL_MARKERS = ['course.json'] as const;

export type EvolveRequiredMarker = (typeof EVOLVE_REQUIRED_MARKERS)[number];
