import type { Block } from './Block';

/**
 * A lesson-level content unit.
 * In Evolve this maps to an Article. Kept as "Lesson" so Rise/Storyline/etc.
 * can reuse the same interface without Evolve terminology leaking into consumers.
 */
export interface Lesson {
  id: string;
  parentId: string | null;
  title: string;
  displayTitle?: string;
  description?: string;
  body?: string;
  /** Blocks contained in this lesson */
  blocks: Block[];
  /** Original article JSON */
  raw: Record<string, unknown>;
}
