/**
 * Sprint 2/3 — mapped draft course payload ready for the LMSBox import API.
 * Produced by EvolveToLmsboxMapper; consumed by AdminEvolveImportController.
 */

export type MappingStatus = 'mapped' | 'skipped' | 'stubbed';

/** Why an item was skipped (or extra context for admins). */
export type MappingSkipReason =
  | 'empty_article'
  | 'assessment_page'
  | 'assessment_article'
  | 'assessment_component'
  | 'unsupported_type'
  | 'map_failed';

export interface MappingReportItem {
  sourceComponentId: string;
  sourceType: string;
  sourceTitle: string;
  status: MappingStatus;
  targetBlockType?: string;
  message: string;
  /** Set for skipped items so the UI can group / highlight them. */
  reasonCode?: MappingSkipReason;
  /** Optional Evolve page path for context, e.g. "Module 1 › Welcome". */
  pagePath?: string;
}

/** Package-local media to upload after draft blocks are created. */
export interface PendingMediaAttachment {
  sourcePath: string;
  fileName: string;
  /** Payload field to patch after upload, e.g. audioUrl, videoUrl, imageUrl, bodyHtml, slides.0.imageUrl */
  targetField: string;
  alt?: string;
  contentType?: string;
}

export interface MappedBlock {
  title: string;
  blockType: string;
  formPayload: Record<string, unknown>;
  mediaAssets: PendingMediaAttachment[];
  sourceComponentId: string;
  sourceType: string;
  /** 1-based order within the mapped lesson (Evolve presentation order). */
  sourceOrder?: number;
}

export interface MappedLesson {
  title: string;
  description?: string;
  sourcePageId?: string;
  sourceLessonId: string;
  blocks: MappedBlock[];
  /** 1-based course lesson order after flattening Evolve hierarchy. */
  sourceOrder?: number;
}

export interface ImportDraftPlan {
  title: string;
  description?: string;
  shortDescription?: string;
  tags: string[];
  requireSequentialLessons: boolean;
  showLessonNavigation: boolean;
  lessons: MappedLesson[];
  report: MappingReportItem[];
  stats: {
    pageCount: number;
    lessonCount: number;
    blockCount: number;
    mappedCount: number;
    skippedCount: number;
    stubbedCount: number;
    pendingMediaCount: number;
    /** Articles with no mappable components (empty or only excluded content). */
    emptyArticleCount: number;
    /** Skipped because Evolve assessment filter. */
    assessmentSkippedCount: number;
    /** Skipped unknown/unsupported component types. */
    unsupportedSkippedCount: number;
  };
}
