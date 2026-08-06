import type { Component } from './Component';

/**
 * A block groups one or more components (Evolve: blocks.json entry).
 */
export interface Block {
  id: string;
  parentId: string | null;
  title: string;
  displayTitle?: string;
  body?: string;
  components: Component[];
  /** Original block JSON */
  raw: Record<string, unknown>;
}
