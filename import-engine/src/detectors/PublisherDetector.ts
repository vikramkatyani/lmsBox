import { EVOLVE_REQUIRED_MARKERS } from '../config/evolveDetection';
import { Publisher, type PublisherDetectionResult } from '../models/Publisher';
import {
  findFileBySuffix,
  type VirtualFileSystem,
} from '../types/VirtualFileSystem';

/**
 * Determines which publisher produced an uploaded package.
 *
 * Sprint 1: Evolve only. Future detectors (Rise, Storyline, …) should be
 * composed here or injected — detection rules stay in config modules.
 *
 * Single responsibility: VFS → PublisherDetectionResult.
 */
export class PublisherDetector {
  detect(vfs: VirtualFileSystem): PublisherDetectionResult {
    if (vfs.paths.length === 0) {
      return {
        publisher: Publisher.UNSUPPORTED,
        reason: 'Package is empty — no files extracted.',
        matchedMarkers: [],
        missingMarkers: [...EVOLVE_REQUIRED_MARKERS],
      };
    }

    const evolve = this.detectEvolve(vfs);
    if (evolve.publisher === Publisher.EVOLVE) {
      return evolve;
    }

    return {
      publisher: Publisher.UNSUPPORTED,
      reason:
        'Unsupported package. Evolve requires config.json, contentObjects.json, articles.json, blocks.json, and components.json.',
      matchedMarkers: evolve.matchedMarkers,
      missingMarkers: evolve.missingMarkers,
    };
  }

  private detectEvolve(vfs: VirtualFileSystem): PublisherDetectionResult {
    const matchedMarkers: string[] = [];
    const missingMarkers: string[] = [];

    for (const marker of EVOLVE_REQUIRED_MARKERS) {
      const found = findFileBySuffix(vfs, marker);
      if (found) {
        matchedMarkers.push(found.path);
      } else {
        missingMarkers.push(marker);
      }
    }

    if (missingMarkers.length === 0) {
      return {
        publisher: Publisher.EVOLVE,
        reason: 'All required Evolve marker JSON files were found.',
        matchedMarkers,
        missingMarkers: [],
      };
    }

    return {
      publisher: Publisher.UNSUPPORTED,
      reason: `Missing Evolve marker files: ${missingMarkers.join(', ')}`,
      matchedMarkers,
      missingMarkers,
    };
  }
}
