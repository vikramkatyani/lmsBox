import type { Lesson } from './Lesson';

/**
 * A navigable page within a course (Evolve: contentObject with _type "page").
 * Menus may also appear as contentObjects; pages hang under the course or a menu.
 */
export interface Page {
  id: string;
  parentId: string | null;
  title: string;
  displayTitle?: string;
  description?: string;
  body?: string;
  /** Source type string, e.g. "page" | "menu" */
  type: string;
  /** Lessons (articles) that belong directly to this page */
  lessons: Lesson[];
  /** Child pages when this node is a menu */
  childPages: Page[];
  /** Original contentObject JSON */
  raw: Record<string, unknown>;
}
