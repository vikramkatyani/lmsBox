import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZipExtractor } from '../../src/services/ZipExtractor';
import type { VirtualFileSystem } from '../../src/types/VirtualFileSystem';

const fixturesRoot = fileURLToPath(new URL('../fixtures', import.meta.url));

/**
 * Load a fixture directory into a VirtualFileSystem for unit tests.
 */
export function loadFixtureVfs(name: string): VirtualFileSystem {
  const root = join(fixturesRoot, name);
  const entries: Record<string, string | Uint8Array> = {};

  const walk = (dir: string): void => {
    for (const item of readdirSync(dir)) {
      const full = join(dir, item);
      const rel = relative(root, full).replace(/\\/g, '/');
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (item.toLowerCase().endsWith('.json') || item.toLowerCase().endsWith('.txt') || item.toLowerCase().endsWith('.mp4')) {
        entries[rel] = readFileSync(full, 'utf8');
      } else {
        entries[rel] = new Uint8Array(readFileSync(full));
      }
    }
  };

  walk(root);
  return ZipExtractor.fromMap(entries, `memory://fixture/${name}`);
}

export { fixturesRoot };
