import type { Course } from './Course';
import type { PublisherDetectionResult } from './Publisher';
import type { PreviewTree } from './PreviewTree';
import type { ValidationReport } from './ValidationReport';
import type { VirtualFileSystem } from '../types/VirtualFileSystem';

/**
 * Full result of Sprint 1 inspection — understanding only, no conversion.
 */
export interface PackageInspectionResult {
  detection: PublisherDetectionResult;
  vfs: VirtualFileSystem;
  /** Parsed course object model; null when publisher unsupported or fatal parse failure */
  course: Course | null;
  tree: PreviewTree | null;
  validation: ValidationReport;
  /** Structured log entries produced during the pipeline */
  logs: ImportLogEntry[];
  /** All JSON documents loaded keyed by relative path */
  loadedJson: Record<string, unknown>;
}

export type ImportLogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface ImportLogEntry {
  timestamp: string;
  level: ImportLogLevel;
  event:
    | 'package_uploaded'
    | 'package_extracted'
    | 'publisher_detected'
    | 'json_loaded'
    | 'object_model_built'
    | 'assets_indexed'
    | 'validation_complete'
    | 'tree_built'
    | 'pipeline_error';
  message: string;
  data?: Record<string, unknown>;
}
