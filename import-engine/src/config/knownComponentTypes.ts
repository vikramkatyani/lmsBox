/**
 * Known Evolve / Adapt component types.
 * Prefer extending this list (or loading from JSON later) over hardcoding
 * mappings inside parsers or validators.
 *
 * Unknown types are still imported — they are flagged in validation only.
 */
export const KNOWN_EVOLVE_COMPONENT_TYPES: readonly string[] = [
  'text',
  'graphic',
  'accordion',
  'media',
  'video',
  'audio',
  'narrative',
  'hotgraphic',
  'hotspot',
  'mcq',
  'gmcq',
  'matching',
  'textInput',
  'slider',
  'ranking',
  'confidenceSlider',
  'openTextInput',
  'assessmentResults',
  'blank',
  'trickle',
  'carousel',
  'stacklist',
  'reveal',
  'flipcard',
  'tutor',
  'quicknav',
] as const;

/** Deduplicated set for O(1) lookups */
export const KNOWN_EVOLVE_COMPONENT_TYPE_SET: ReadonlySet<string> = new Set(
  KNOWN_EVOLVE_COMPONENT_TYPES
);

/**
 * Extension → media type hints used by AssetIndexer when MIME is not available.
 * Configuration over code — extend without touching indexer logic.
 */
export const MEDIA_TYPE_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.vtt': 'text/vtt',
  '.json': 'application/json',
};
