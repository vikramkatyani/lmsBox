import { EVOLVE_REQUIRED_MARKERS } from '../config/evolveDetection';
import { KNOWN_EVOLVE_COMPONENT_TYPE_SET } from '../config/knownComponentTypes';
import type { Course } from '../models/Course';
import { Publisher, type PublisherDetectionResult } from '../models/Publisher';
import type {
  ValidationIssue,
  ValidationReport,
} from '../models/ValidationReport';
import type { EvolveRawPackage } from '../parsers/IPackageParser';
import {
  findFileBySuffix,
  type VirtualFileSystem,
} from '../types/VirtualFileSystem';

export interface ValidationInput {
  detection: PublisherDetectionResult;
  vfs: VirtualFileSystem;
  raw?: EvolveRawPackage | null;
  course?: Course | null;
}

/**
 * Validates package integrity: missing JSON, missing assets, broken references,
 * duplicate IDs, and unknown component types.
 *
 * Single responsibility: produce ValidationReport.
 */
export class ValidationEngine {
  validate(input: ValidationInput): ValidationReport {
    const issues: ValidationIssue[] = [];

    if (input.vfs.paths.length === 0) {
      issues.push({
        code: 'EMPTY_PACKAGE',
        severity: 'error',
        message: 'Extracted package contains no files.',
      });
    }

    if (input.detection.publisher === Publisher.UNSUPPORTED) {
      issues.push({
        code: 'UNSUPPORTED_PUBLISHER',
        severity: 'error',
        message: input.detection.reason,
        details: {
          missingMarkers: input.detection.missingMarkers,
          matchedMarkers: input.detection.matchedMarkers,
        },
      });

      for (const marker of input.detection.missingMarkers) {
        issues.push({
          code: 'MISSING_JSON',
          severity: 'error',
          message: `Required JSON file not found: ${marker}`,
          path: marker,
        });
      }

      return this.toReport(issues);
    }

    // Missing JSON markers (should be empty for EVOLVE, but double-check)
    for (const marker of EVOLVE_REQUIRED_MARKERS) {
      if (!findFileBySuffix(input.vfs, marker)) {
        issues.push({
          code: 'MISSING_JSON',
          severity: 'error',
          message: `Required JSON file not found: ${marker}`,
          path: marker,
        });
      }
    }

    if (!input.raw || !input.course) {
      issues.push({
        code: 'PARSE_ERROR',
        severity: 'error',
        message: 'Object model was not built — parsing may have failed.',
      });
      return this.toReport(issues);
    }

    this.checkDuplicateIds(input.raw, input.course, issues);
    this.checkBrokenReferences(input.raw, input.course, issues);
    this.checkMissingAssets(input.course, issues);
    this.checkUnknownComponents(input.course, issues);

    return this.toReport(issues);
  }

  private checkDuplicateIds(
    raw: EvolveRawPackage,
    course: Course,
    issues: ValidationIssue[]
  ): void {
    const seen = new Map<string, string>();

    const track = (id: unknown, kind: string): void => {
      if (typeof id !== 'string' || !id) return;
      const previous = seen.get(id);
      if (previous) {
        issues.push({
          code: 'DUPLICATE_ID',
          severity: 'error',
          message: `Duplicate id "${id}" found on ${kind} (also used by ${previous}).`,
          entityId: id,
          entityKind: kind,
        });
        return;
      }
      seen.set(id, kind);
    };

    track(course.id, 'course');
    for (const row of raw.contentObjects) track(row._id, 'page');
    for (const row of raw.articles) track(row._id, 'lesson');
    for (const row of raw.blocks) track(row._id, 'block');
    for (const row of raw.components) track(row._id, 'component');
  }

  private checkBrokenReferences(
    raw: EvolveRawPackage,
    course: Course,
    issues: ValidationIssue[]
  ): void {
    const knownIds = new Set<string>();
    knownIds.add(course.id);
    for (const co of raw.contentObjects) {
      const id = co._id;
      if (typeof id === 'string') knownIds.add(id);
    }
    for (const row of [...raw.articles, ...raw.blocks, ...raw.components]) {
      const id = row._id;
      if (typeof id === 'string') knownIds.add(id);
    }

    const checkParent = (
      row: Record<string, unknown>,
      kind: string
    ): void => {
      const id = typeof row._id === 'string' ? row._id : undefined;
      const parentId = row._parentId;
      if (parentId === null || parentId === undefined || parentId === '') return;
      const parent = String(parentId);
      // Articles may parent to contentObjects; blocks to articles; components to blocks.
      // Course id and content object ids are valid parents.
      if (!knownIds.has(parent) && parent !== 'course') {
        issues.push({
          code: 'BROKEN_REFERENCE',
          severity: 'error',
          message: `${kind} "${id ?? '?'}" references missing parent "${parent}".`,
          entityId: id,
          entityKind: kind,
          details: { parentId: parent },
        });
      }
    };

    for (const row of raw.contentObjects) checkParent(row, 'page');
    for (const row of raw.articles) checkParent(row, 'lesson');
    for (const row of raw.blocks) checkParent(row, 'block');
    for (const row of raw.components) checkParent(row, 'component');
  }

  private checkMissingAssets(course: Course, issues: ValidationIssue[]): void {
    for (const asset of course.assets) {
      if (!asset.exists) {
        issues.push({
          code: 'MISSING_ASSET',
          severity: 'warning',
          message: `Asset not found in package: ${asset.path}`,
          entityId: asset.id,
          entityKind: 'asset',
          path: asset.path,
          details: { parentComponentId: asset.parentComponentId },
        });
      }
    }
  }

  private checkUnknownComponents(course: Course, issues: ValidationIssue[]): void {
    for (const component of course.components) {
      if (!KNOWN_EVOLVE_COMPONENT_TYPE_SET.has(component.type)) {
        issues.push({
          code: 'UNKNOWN_COMPONENT_TYPE',
          severity: 'warning',
          message: `Unknown component type "${component.type}" on component "${component.id}".`,
          entityId: component.id,
          entityKind: 'component',
          details: { type: component.type },
        });
      }
    }
  }

  private toReport(issues: ValidationIssue[]): ValidationReport {
    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;
    return {
      isValid: errorCount === 0,
      issueCount: issues.length,
      errorCount,
      warningCount,
      issues,
      generatedAt: new Date().toISOString(),
    };
  }
}
