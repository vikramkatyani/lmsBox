/**
 * @lmsbox/import-engine
 *
 * Sprint 1 — Evolve Package Inspector (parse & understand)
 * Sprint 2 — Evolve → Draft LMSBox course (map + import; no AI / publish)
 */

export * from './models';
export * from './types/VirtualFileSystem';

export { EVOLVE_REQUIRED_MARKERS, EVOLVE_OPTIONAL_MARKERS } from './config/evolveDetection';
export {
  KNOWN_EVOLVE_COMPONENT_TYPES,
  KNOWN_EVOLVE_COMPONENT_TYPE_SET,
  MEDIA_TYPE_BY_EXTENSION,
} from './config/knownComponentTypes';
export {
  EVOLVE_ASSESSMENT_COMPONENT_TYPES,
  EVOLVE_ASSESSMENT_COMPONENT_TYPE_SET,
  EVOLVE_ASSESSMENT_TITLE_PATTERNS,
  EVOLVE_KNOWLEDGE_CHECK_TITLE_PATTERNS,
  isEvolveAssessmentComponentType,
  isEvolveAssessmentNode,
  isEvolveKnowledgeCheckNode,
  titleLooksLikeEvolveKnowledgeCheck,
  evolveAssessmentSkipMessage,
} from './config/assessmentSkip';

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

export {
  EvolveToLmsboxMapper,
  MAX_BLOCKS_PER_LESSON,
  EVOLVE_TO_LMSBOX_BLOCK_TYPE,
  type MapEvolveOptions,
} from './mappers/EvolveToLmsboxMapper';
export type {
  ImportDraftPlan,
  MappedLesson,
  MappedBlock,
  MappingReportItem,
  MappingStatus,
  MappingSkipReason,
  PendingMediaAttachment,
} from './mappers/ImportDraftPlan';
