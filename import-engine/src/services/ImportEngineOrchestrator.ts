import { PublisherDetector } from '../detectors/PublisherDetector';
import type { PackageInspectionResult } from '../models/PackageInspection';
import { Publisher } from '../models/Publisher';
import { EvolveParser } from '../parsers/EvolveParser';
import type { EvolveRawPackage } from '../parsers/IPackageParser';
import { ValidationEngine } from '../validators/ValidationEngine';
import { AssetIndexer } from './AssetIndexer';
import { ObjectModelBuilder } from './ObjectModelBuilder';
import { PreviewTreeBuilder } from './PreviewTreeBuilder';
import { StructuredLogger } from './StructuredLogger';
import { ZipExtractor } from './ZipExtractor';

export interface InspectPackageOptions {
  /** Original filename for logging / temp root labelling */
  filename?: string;
  /** Optional injected collaborators (tests / DI) */
  zipExtractor?: ZipExtractor;
  publisherDetector?: PublisherDetector;
  evolveParser?: EvolveParser;
  assetIndexer?: AssetIndexer;
  objectModelBuilder?: ObjectModelBuilder;
  validationEngine?: ValidationEngine;
  previewTreeBuilder?: PreviewTreeBuilder;
  logger?: StructuredLogger;
}

/**
 * Orchestrates the Sprint 1 Evolve Package Inspector pipeline:
 *
 * Upload ZIP → Extract → Detect Evolve → Read JSON →
 * Object Model → Asset Index → Validation → Preview Tree
 *
 * No HTML rendering. No LMS lesson creation. No AI.
 */
export class ImportEngineOrchestrator {
  private readonly zipExtractor: ZipExtractor;
  private readonly publisherDetector: PublisherDetector;
  private readonly evolveParser: EvolveParser;
  private readonly assetIndexer: AssetIndexer;
  private readonly objectModelBuilder: ObjectModelBuilder;
  private readonly validationEngine: ValidationEngine;
  private readonly previewTreeBuilder: PreviewTreeBuilder;

  constructor(options: InspectPackageOptions = {}) {
    this.zipExtractor = options.zipExtractor ?? new ZipExtractor();
    this.publisherDetector = options.publisherDetector ?? new PublisherDetector();
    this.evolveParser = options.evolveParser ?? new EvolveParser();
    this.assetIndexer = options.assetIndexer ?? new AssetIndexer();
    this.objectModelBuilder =
      options.objectModelBuilder ?? new ObjectModelBuilder(this.assetIndexer);
    this.validationEngine = options.validationEngine ?? new ValidationEngine();
    this.previewTreeBuilder = options.previewTreeBuilder ?? new PreviewTreeBuilder();
  }

  /**
   * Inspect an uploaded ZIP (browser File/Blob or ArrayBuffer).
   */
  async inspectPackage(
    source: ArrayBuffer | Blob | Uint8Array,
    options: InspectPackageOptions = {}
  ): Promise<PackageInspectionResult> {
    const logger = options.logger ?? new StructuredLogger();
    const filename = options.filename ?? 'package.zip';

    logger.info('package_uploaded', 'Package uploaded', { filename });

    try {
      const { vfs, fileCount, totalBytes } = await this.zipExtractor.extract(source, {
        originalName: filename,
      });

      logger.info('package_extracted', 'Package extracted', {
        fileCount,
        totalBytes,
        rootPath: vfs.rootPath,
      });

      return this.inspectVirtualFileSystem(vfs, logger);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('pipeline_error', `Pipeline failed: ${message}`);
      throw err;
    }
  }

  /**
   * Inspect an already-extracted VirtualFileSystem (fixtures / tests / backend temp folder).
   */
  inspectVirtualFileSystem(
    vfs: Parameters<PublisherDetector['detect']>[0],
    logger: StructuredLogger = new StructuredLogger()
  ): PackageInspectionResult {
    const detection = this.publisherDetector.detect(vfs);
    logger.info('publisher_detected', `Publisher detected: ${detection.publisher}`, {
      publisher: detection.publisher,
      reason: detection.reason,
      matchedMarkers: detection.matchedMarkers,
      missingMarkers: detection.missingMarkers,
    });

    let raw: EvolveRawPackage | null = null;
    let course = null;
    let tree = null;
    let loadedJson: Record<string, unknown> = {};

    if (detection.publisher === Publisher.EVOLVE) {
      raw = this.evolveParser.parse(vfs);
      loadedJson = raw.allJsonByPath;
      logger.info('json_loaded', 'Evolve JSON loaded into memory', {
        contentRoot: raw.contentRoot,
        contentObjects: raw.contentObjects.length,
        articles: raw.articles.length,
        blocks: raw.blocks.length,
        components: raw.components.length,
        jsonFileCount: Object.keys(loadedJson).length,
      });

      course = this.objectModelBuilder.build(raw, vfs);
      logger.info('object_model_built', 'Object model built', {
        courseId: course.id,
        title: course.title,
        pages: course.pages.length,
        lessons: course.lessons.length,
        blocks: course.blocks.length,
        components: course.components.length,
      });

      logger.info('assets_indexed', 'Assets indexed', {
        assetCount: course.assets.length,
        missingCount: course.assets.filter((a) => !a.exists).length,
      });

      tree = this.previewTreeBuilder.build(course);
      logger.info('tree_built', 'Preview tree built', {
        rootKey: tree.root.key,
        nodeCount: Object.keys(tree.nodeIndex).length,
      });
    }

    const validation = this.validationEngine.validate({
      detection,
      vfs,
      raw,
      course,
    });
    logger.info('validation_complete', 'Validation complete', {
      isValid: validation.isValid,
      issueCount: validation.issueCount,
      errorCount: validation.errorCount,
      warningCount: validation.warningCount,
    });

    return {
      detection,
      vfs,
      course,
      tree,
      validation,
      logs: logger.snapshot(),
      loadedJson,
    };
  }
}
