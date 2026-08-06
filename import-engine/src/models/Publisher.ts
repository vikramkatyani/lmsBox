/**
 * Supported content publishers for the Import Engine.
 * Sprint 1 only implements EVOLVE. Future parsers register additional values.
 */
export enum Publisher {
  EVOLVE = 'EVOLVE',
  RISE = 'RISE',
  STORYLINE = 'STORYLINE',
  ADAPT = 'ADAPT',
  WORD = 'WORD',
  PDF = 'PDF',
  UNSUPPORTED = 'UNSUPPORTED',
}

export interface PublisherDetectionResult {
  publisher: Publisher;
  /** Human-readable reason for the detection outcome */
  reason: string;
  /** Relative paths of marker files that were found */
  matchedMarkers: string[];
  /** Relative paths of required markers that were missing */
  missingMarkers: string[];
}
