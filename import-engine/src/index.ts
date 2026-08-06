/**
 * @lmsbox/import-engine
 *
 * Sprint 1 — Evolve Package Inspector
 * Parse and understand published Evolve packages. No HTML. No AI. No LMS import.
 */

export * from './models';
export * from './types/VirtualFileSystem';

export { EVOLVE_REQUIRED_MARKERS, EVOLVE_OPTIONAL_MARKERS } from './config/evolveDetection';
export {
  KNOWN_EVOLVE_COMPONENT_TYPES,
  KNOWN_EVOLVE_COMPONENT_TYPE_SET,
  MEDIA_TYPE_BY_EXTENSION,
} from './config/knownComponentTypes';

export { PublisherDetector } from './detectors/PublisherDetector';
export { EvolveParser } from './parsers/EvolveParser';
export type { IPackageParser, EvolveRawPackage } from './parsers/IPackageParser';

export { ZipExtractor } from './services/ZipExtractor';
export { ObjectModelBuilder } from './services/ObjectModelBuilder';
export { AssetIndexer } from './services/AssetIndexer';
export { PreviewTreeBuilder } from './services/PreviewTreeBuilder';
export { StructuredLogger } from './services/StructuredLogger';
export {
  ImportEngineOrchestrator,
  type InspectPackageOptions,
} from './services/ImportEngineOrchestrator';

export { ValidationEngine } from './validators/ValidationEngine';
