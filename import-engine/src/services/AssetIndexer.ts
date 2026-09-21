import { MEDIA_TYPE_BY_EXTENSION } from '../config/knownComponentTypes';
import type { Asset } from '../models/Asset';
import type { Component } from '../models/Component';
import {
  getFile,
  normalisePackagePath,
  type VirtualFileSystem,
} from '../types/VirtualFileSystem';
import { looksLikeAssetId, looksLikeMediaPath } from '../utils/evolveMedia';

export interface AssetIndexInput {
  /** Assets already harvested from component JSON */
  vfsAssets: Asset[];
  components: Component[];
  contentRoot: string;
  /** Optional VFS to verify existence and discover loose files under assets/ */
  vfs?: VirtualFileSystem;
}

/**
 * Indexes all assets referenced by components and present under the package assets folder.
 *
 * Stores: filename, path, media type, dimensions (when available), parent component.
 *
 * Single responsibility: discover & normalise Asset records.
 */
export class AssetIndexer {
  index(input: AssetIndexInput): Asset[] {
    const byPath = new Map<string, Asset>();

    for (const asset of input.vfsAssets) {
      this.merge(byPath, asset);
    }

    if (input.vfs) {
      for (const path of input.vfs.paths) {
        const normalised = normalisePackagePath(path);
        if (!this.looksLikeAssetPath(normalised, input.contentRoot)) continue;

        const file = getFile(input.vfs, normalised);
        if (!file) continue;

        this.merge(byPath, {
          id: this.idFromPath(normalised),
          filename: file.filename,
          path: normalised,
          mediaType: this.mediaTypeFromFilename(file.filename),
          size: file.size,
          exists: true,
        });
      }

      // Mark existence for referenced assets
      for (const asset of byPath.values()) {
        const resolved = this.resolveAgainstVfs(input.vfs, asset.path, input.contentRoot);
        if (resolved) {
          asset.path = resolved.path;
          asset.filename = resolved.filename;
          asset.size = resolved.size;
          asset.exists = true;
          if (asset.mediaType === 'application/octet-stream') {
            asset.mediaType = this.mediaTypeFromFilename(resolved.filename);
          }
        } else if (asset.exists !== true) {
          asset.exists = getFile(input.vfs, asset.path) !== undefined;
        }
      }
    }

    return Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path));
  }

  /**
   * Walk component raw JSON and harvest src / path-like strings that look like media.
   * Prefer configuration-driven extension checks over hardcoded component field names.
   */
  extractFromComponentRaw(
    raw: Record<string, unknown>,
    parentComponentId: string
  ): Asset[] {
    const found: Asset[] = [];
    const seen = new Set<string>();

    const visit = (node: unknown, trail: string[]): void => {
      if (node === null || node === undefined) return;

      if (typeof node === 'string') {
        if (this.looksLikeMediaRef(node)) {
          const path = normalisePackagePath(node);
          if (seen.has(path.toLowerCase())) return;
          seen.add(path.toLowerCase());

          const dims = this.readDimensionsNear(raw, trail);
          found.push({
            id: this.idFromPath(path),
            filename: path.split('/').pop() ?? path,
            path,
            mediaType: this.mediaTypeFromFilename(path),
            width: dims?.width,
            height: dims?.height,
            parentComponentId,
            exists: false,
          });
        }
        return;
      }

      if (Array.isArray(node)) {
        node.forEach((item, index) => visit(item, [...trail, String(index)]));
        return;
      }

      if (typeof node === 'object') {
        const obj = node as Record<string, unknown>;
        // Prefer explicit graphic / media objects with src/large/small + dimensions
        const mediaSrc =
          (typeof obj.src === 'string' && obj.src) ||
          (typeof obj._src === 'string' && obj._src) ||
          (typeof obj.large === 'string' && obj.large) ||
          (typeof obj.small === 'string' && obj.small) ||
          (typeof obj.path === 'string' && obj.path) ||
          (typeof obj._path === 'string' && obj._path) ||
          '';
        if (mediaSrc && this.looksLikeMediaRef(mediaSrc)) {
          const path = normalisePackagePath(mediaSrc);
          if (!seen.has(path.toLowerCase())) {
            seen.add(path.toLowerCase());
            found.push({
              id: this.idFromPath(path),
              filename: path.split('/').pop() ?? path,
              path,
              mediaType: this.mediaTypeFromFilename(path),
              width: typeof obj.width === 'number' ? obj.width : undefined,
              height: typeof obj.height === 'number' ? obj.height : undefined,
              parentComponentId,
              exists: false,
            });
          }
        }
        const SKIP_REF_KEYS = new Set([
          '_id',
          'id',
          '_parentId',
          '_type',
          '_component',
          '_classes',
          '_layout',
          '_trackingId',
          'title',
          'displayTitle',
          'body',
          'alt',
        ]);
        for (const [key, value] of Object.entries(obj)) {
          if (SKIP_REF_KEYS.has(key) && trail.length === 0) continue;
          if (key === '_parentId' || key === '_type' || key === '_component') continue;
          visit(value, [...trail, key]);
        }
      }
    };

    visit(raw, []);
    return found;
  }

  private merge(byPath: Map<string, Asset>, asset: Asset): void {
    const key = asset.path.toLowerCase();
    const existing = byPath.get(key);
    if (!existing) {
      byPath.set(key, { ...asset });
      return;
    }

    byPath.set(key, {
      ...existing,
      ...asset,
      // Prefer existing parent when new one is missing
      parentComponentId: asset.parentComponentId ?? existing.parentComponentId,
      width: asset.width ?? existing.width,
      height: asset.height ?? existing.height,
      size: asset.size ?? existing.size,
      exists: asset.exists || existing.exists,
      mediaType:
        asset.mediaType !== 'application/octet-stream'
          ? asset.mediaType
          : existing.mediaType,
    });
  }

  private looksLikeAssetPath(path: string, contentRoot: string): boolean {
    const lower = path.toLowerCase();
    if (/(^|\/)(libraries|node_modules|core|fonts|css)\//.test(lower)) return false;
    if (this.isMediaFolderPath(lower)) return true;
    if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|mp4|webm|mp3|wav|ogg)$/i.test(lower)) return true;
    if (contentRoot) {
      const prefix = `${contentRoot.toLowerCase()}/`;
      if (lower.startsWith(prefix) && this.isMediaFolderPath(lower.slice(prefix.length))) {
        return true;
      }
    }
    return false;
  }

  private isMediaFolderPath(path: string): boolean {
    return (
      /(^|\/)(assets|images|media|video|videos|audio|posters)\//.test(path) ||
      /^(assets|images|media|video|videos|audio|posters)(\/|$)/.test(path)
    );
  }

  private looksLikeMediaRef(value: string): boolean {
    if (!value) return false;
    if (looksLikeAssetId(value)) return true;
    return looksLikeMediaPath(value);
  }

  private mediaTypeFromFilename(filename: string): string {
    const lower = filename.toLowerCase();
    const dot = lower.lastIndexOf('.');
    if (dot < 0) return 'application/octet-stream';
    const ext = lower.slice(dot);
    return MEDIA_TYPE_BY_EXTENSION[ext] ?? 'application/octet-stream';
  }

  private idFromPath(path: string): string {
    // Deterministic, source-derived id — not a random UUID
    return `asset:${normalisePackagePath(path)}`;
  }

  private readDimensionsNear(
    _raw: Record<string, unknown>,
    _trail: string[]
  ): { width?: number; height?: number } | null {
    return null;
  }

  private resolveAgainstVfs(
    vfs: VirtualFileSystem,
    path: string,
    contentRoot: string
  ): ReturnType<typeof getFile> {
    const candidates = [
      path,
      path.replace(/^\.\//, ''),
      contentRoot ? `${contentRoot}/${path}` : path,
      path.startsWith('course/') ? path : `course/${path}`,
    ];

    for (const candidate of candidates) {
      const hit = getFile(vfs, normalisePackagePath(candidate));
      if (hit) return hit;
    }

    // Suffix match on filename, or ObjectId prefix (Evolve Asset:image ids)
    const filename = path.split('/').pop()?.toLowerCase();
    if (!filename) return undefined;
    for (const p of vfs.paths) {
      const lower = p.toLowerCase();
      const base = lower.split('/').pop() ?? '';
      if (lower.endsWith(`/${filename}`) || lower === filename) {
        return getFile(vfs, p);
      }
      if (
        looksLikeAssetId(filename) &&
        (base.startsWith(filename) || lower.includes(`/${filename}`)) &&
        /\.(jpg|jpeg|png|gif|webp|svg|bmp|mp4|webm|mp3)$/i.test(base)
      ) {
        return getFile(vfs, p);
      }
    }
    return undefined;
  }
}
