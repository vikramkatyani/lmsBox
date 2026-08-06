import { EVOLVE_REQUIRED_MARKERS } from '../config/evolveDetection';
import { Publisher } from '../models/Publisher';
import {
  findFileBySuffix,
  getFile,
  type VirtualFileSystem,
} from '../types/VirtualFileSystem';
import type { EvolveRawPackage, IPackageParser } from './IPackageParser';

/**
 * Reads Evolve / Adapt published JSON into memory.
 * Does not render, modify, or convert — load only.
 *
 * Single responsibility: VFS → EvolveRawPackage.
 */
export class EvolveParser implements IPackageParser {
  readonly publisher = Publisher.EVOLVE;

  parse(vfs: VirtualFileSystem): EvolveRawPackage {
    const contentRoot = this.resolveContentRoot(vfs);
    const allJsonByPath: Record<string, unknown> = {};

    const config = this.readJsonObject(vfs, contentRoot, 'config.json', allJsonByPath);
    const course = this.readJsonObject(vfs, contentRoot, 'course.json', allJsonByPath, true);
    const contentObjects = this.readJsonArray(
      vfs,
      contentRoot,
      'contentObjects.json',
      allJsonByPath
    );
    const articles = this.readJsonArray(vfs, contentRoot, 'articles.json', allJsonByPath);
    const blocks = this.readJsonArray(vfs, contentRoot, 'blocks.json', allJsonByPath);
    const components = this.readJsonArray(vfs, contentRoot, 'components.json', allJsonByPath);

    // Also index any other JSON under the package for the debug inspector
    for (const path of vfs.paths) {
      if (!path.toLowerCase().endsWith('.json')) continue;
      if (allJsonByPath[path] !== undefined) continue;
      const file = getFile(vfs, path);
      if (!file?.text) continue;
      try {
        allJsonByPath[path] = JSON.parse(file.text);
      } catch {
        // Leave unparseable JSON out of the map; ValidationEngine reports separately if needed
      }
    }

    return {
      publisher: Publisher.EVOLVE,
      contentRoot,
      config,
      course,
      contentObjects,
      articles,
      blocks,
      components,
      allJsonByPath,
    };
  }

  /**
   * Locate the folder that holds the Evolve JSON set.
   * Typical layouts: course/, course/en/, or package root.
   */
  private resolveContentRoot(vfs: VirtualFileSystem): string {
    const config = findFileBySuffix(vfs, 'config.json');
    if (config) {
      const idx = config.path.toLowerCase().lastIndexOf('/config.json');
      if (idx >= 0) {
        return config.path.slice(0, idx);
      }
      return '';
    }

    // Fallback: derive from any required marker
    for (const marker of EVOLVE_REQUIRED_MARKERS) {
      const hit = findFileBySuffix(vfs, marker);
      if (hit) {
        const lower = hit.path.toLowerCase();
        const idx = lower.lastIndexOf(`/${marker.toLowerCase()}`);
        if (idx >= 0) {
          return hit.path.slice(0, idx);
        }
        return '';
      }
    }

    return 'course';
  }

  private resolvePath(contentRoot: string, filename: string): string {
    return contentRoot ? `${contentRoot}/${filename}` : filename;
  }

  private readJsonObject(
    vfs: VirtualFileSystem,
    contentRoot: string,
    filename: string,
    allJsonByPath: Record<string, unknown>,
    optional = false
  ): Record<string, unknown> {
    const primary = this.resolvePath(contentRoot, filename);
    let file = getFile(vfs, primary) ?? findFileBySuffix(vfs, filename);

    if (!file?.text) {
      if (optional) return {};
      throw new Error(`Missing or empty JSON file: ${filename}`);
    }

    const parsed = this.safeParse(file.text, file.path);
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
      if (optional) return {};
      throw new Error(`Expected JSON object in ${file.path}`);
    }

    allJsonByPath[file.path] = parsed;
    return parsed as Record<string, unknown>;
  }

  private readJsonArray(
    vfs: VirtualFileSystem,
    contentRoot: string,
    filename: string,
    allJsonByPath: Record<string, unknown>
  ): Record<string, unknown>[] {
    const primary = this.resolvePath(contentRoot, filename);
    const file = getFile(vfs, primary) ?? findFileBySuffix(vfs, filename);

    if (!file?.text) {
      throw new Error(`Missing or empty JSON file: ${filename}`);
    }

    const parsed = this.safeParse(file.text, file.path);
    if (!Array.isArray(parsed)) {
      throw new Error(`Expected JSON array in ${file.path}`);
    }

    allJsonByPath[file.path] = parsed;
    return parsed as Record<string, unknown>[];
  }

  private safeParse(text: string, path: string): unknown {
    try {
      return JSON.parse(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to parse JSON at ${path}: ${message}`);
    }
  }
}
