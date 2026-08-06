import JSZip from 'jszip';
import {
  normalisePackagePath,
  type VirtualFileEntry,
  type VirtualFileSystem,
} from '../types/VirtualFileSystem';

export interface ZipExtractResult {
  vfs: VirtualFileSystem;
  fileCount: number;
  totalBytes: number;
}

/**
 * Extracts a ZIP package into an in-memory VirtualFileSystem while preserving
 * directory structure. In the browser this is the temp working folder equivalent;
 * Node consumers may later persist vfs to disk without changing callers.
 *
 * Single responsibility: ZIP → VirtualFileSystem.
 */
export class ZipExtractor {
  /**
   * Extract from a browser File / Blob or raw ArrayBuffer.
   */
  async extract(
    source: ArrayBuffer | Blob | Uint8Array,
    options?: { rootPath?: string; originalName?: string }
  ): Promise<ZipExtractResult> {
    const buffer =
      source instanceof Uint8Array
        ? source
        : source instanceof ArrayBuffer
          ? new Uint8Array(source)
          : new Uint8Array(await source.arrayBuffer());

    const zip = await JSZip.loadAsync(buffer);
    const files = new Map<string, VirtualFileEntry>();
    const paths: string[] = [];
    let totalBytes = 0;

    const rootPath =
      options?.rootPath ??
      `memory://${options?.originalName ?? 'package'}/${Date.now()}`;

    const entries = Object.keys(zip.files).sort((a, b) => a.localeCompare(b));

    for (const rawPath of entries) {
      const zipEntry = zip.files[rawPath];
      if (!zipEntry || zipEntry.dir) {
        continue;
      }

      const path = normalisePackagePath(rawPath);
      if (!path || path.endsWith('/')) {
        continue;
      }

      // Skip macOS / Windows junk that pollutes package trees
      if (path.startsWith('__MACOSX/') || path.includes('/.DS_Store') || path.endsWith('/.DS_Store')) {
        continue;
      }

      const data = await zipEntry.async('uint8array');
      const filename = path.split('/').pop() ?? path;
      const isText = this.isLikelyText(filename);
      const text = isText ? this.decodeUtf8(data) : null;

      const entry: VirtualFileEntry = {
        path,
        filename,
        data,
        text,
        size: data.byteLength,
      };

      files.set(path.toLowerCase(), entry);
      paths.push(path);
      totalBytes += data.byteLength;
    }

    return {
      vfs: { rootPath, files, paths },
      fileCount: paths.length,
      totalBytes,
    };
  }

  /**
   * Build a VFS from a plain path→content map (unit tests / fixtures).
   */
  static fromMap(
    entries: Record<string, string | Uint8Array>,
    rootPath = 'memory://fixture'
  ): VirtualFileSystem {
    const files = new Map<string, VirtualFileEntry>();
    const paths: string[] = [];

    for (const [rawPath, content] of Object.entries(entries)) {
      const path = normalisePackagePath(rawPath);
      const data =
        typeof content === 'string' ? new TextEncoder().encode(content) : content;
      const filename = path.split('/').pop() ?? path;
      const text = typeof content === 'string' ? content : null;

      files.set(path.toLowerCase(), {
        path,
        filename,
        data,
        text,
        size: data.byteLength,
      });
      paths.push(path);
    }

    paths.sort((a, b) => a.localeCompare(b));
    return { rootPath, files, paths };
  }

  private isLikelyText(filename: string): boolean {
    const lower = filename.toLowerCase();
    return (
      lower.endsWith('.json') ||
      lower.endsWith('.xml') ||
      lower.endsWith('.txt') ||
      lower.endsWith('.html') ||
      lower.endsWith('.htm') ||
      lower.endsWith('.css') ||
      lower.endsWith('.js') ||
      lower.endsWith('.md') ||
      lower.endsWith('.vtt') ||
      lower.endsWith('.csv')
    );
  }

  private decodeUtf8(data: Uint8Array): string {
    try {
      return new TextDecoder('utf-8', { fatal: false }).decode(data);
    } catch {
      return '';
    }
  }
}
