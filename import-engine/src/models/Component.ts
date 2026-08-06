import type { Asset } from './Asset';

/**
 * Leaf interactive / content unit (Evolve: components.json entry).
 * Component type comes from source (_component) — never invented by LMSBox.
 */
export interface Component {
  id: string;
  parentId: string | null;
  /** Evolve _component value, e.g. "text", "graphic", "accordion", "media" */
  type: string;
  title: string;
  displayTitle?: string;
  body?: string;
  layout?: string;
  /** Assets referenced by this component */
  assets: Asset[];
  /** IDs of related entities (parent block, sibling refs, etc.) */
  relationships: ComponentRelationships;
  /** Whether this type is listed in known-component configuration */
  isKnownType: boolean;
  /** Original component JSON — shown in the Component Inspector */
  raw: Record<string, unknown>;
}

export interface ComponentRelationships {
  parentBlockId: string | null;
  parentLessonId: string | null;
  parentPageId: string | null;
  courseId: string | null;
  /** Asset ids attached to this component */
  assetIds: string[];
}
