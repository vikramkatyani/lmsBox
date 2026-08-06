/**
 * In-memory representation of an extracted package.
 * Used instead of (or alongside) a physical temp folder so the inspector
 * can run in the browser and in Node unit tests with the same contracts.
 */
export interface VirtualFileEntry {
  /** Relative path using forward slashes, e.g. "course/config.json" */
  path: string;
  /** File name only */
  filename: string;
  /** Raw bytes */
  data: Uint8Array;
  /** UTF-8 text when the file is text/json; null for binary */
  text: string | null;
  /** Byte size */
  size: number;
}

export interface VirtualFileSystem {
  /** Absolute or logical root of the extraction (temp folder path or "memory://...") */
  rootPath: string;
  /** All files keyed by normalised relative path (lowercase for lookup) */
  files: Map<string, VirtualFileEntry>;
  /** Original relative paths in discovery order */
  paths: string[];
}

/**
 * Normalise package-relative paths for consistent lookups across OS / ZIP entries.
 */
export function normalisePackagePath(input: string): string {
  return input.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
}

/**
 * Case-insensitive file lookup by relative path.
 */
export function getFile(
  vfs: VirtualFileSystem,
  relativePath: string
): VirtualFileEntry | undefined {
  const key = normalisePackagePath(relativePath).toLowerCase();
  return vfs.files.get(key);
}

/**
 * Find the first file whose path ends with the given suffix (case-insensitive).
 * Useful when Evolve JSON may live under course/, course/en/, or package root.
 */
export function findFileBySuffix(
  vfs: VirtualFileSystem,
  suffix: string
): VirtualFileEntry | undefined {
  const needle = normalisePackagePath(suffix).toLowerCase();
  for (const path of vfs.paths) {
    if (path.toLowerCase().endsWith(needle) || path.toLowerCase() === needle) {
      return getFile(vfs, path);
    }
  }
  return undefined;
}
