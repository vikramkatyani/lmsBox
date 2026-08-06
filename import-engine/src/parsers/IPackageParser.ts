import type { Publisher } from '../models/Publisher';
import type { VirtualFileSystem } from '../types/VirtualFileSystem';

/**
 * Raw JSON documents loaded from a package before object-model construction.
 * Keys are logical names (config, contentObjects, …) independent of folder layout.
 */
export interface EvolveRawPackage {
  publisher: Publisher;
  /** Directory containing the JSON set, e.g. "course" or "course/en" */
  contentRoot: string;
  config: Record<string, unknown>;
  course: Record<string, unknown>;
  contentObjects: Record<string, unknown>[];
  articles: Record<string, unknown>[];
  blocks: Record<string, unknown>[];
  components: Record<string, unknown>[];
  /** Every JSON file loaded from the package, keyed by relative path */
  allJsonByPath: Record<string, unknown>;
}

/**
 * Contract for publisher-specific parsers.
 * Future Rise / Storyline / Adapt parsers implement the same surface
 * and feed ObjectModelBuilder (or their own builder that yields Course).
 */
export interface IPackageParser {
  readonly publisher: Publisher;
  parse(vfs: VirtualFileSystem): EvolveRawPackage | Promise<EvolveRawPackage>;
}
