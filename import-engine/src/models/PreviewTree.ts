/**
 * File-explorer style tree used by the Developer Debug View.
 * Nodes are pure data — UI is responsible only for expand/collapse/selection.
 */
export type PreviewNodeKind =
  | 'course'
  | 'page'
  | 'lesson'
  | 'block'
  | 'component'
  | 'asset'
  | 'assets-folder'
  | 'menu';

export interface PreviewTreeNode {
  /** Unique tree key (may combine kind + source id) */
  key: string;
  /** Source entity id when available */
  id: string | null;
  kind: PreviewNodeKind;
  /** Label shown in the tree (file-explorer style) */
  label: string;
  /** Secondary badge text, e.g. component type */
  badge?: string;
  children: PreviewTreeNode[];
  /** Raw JSON for the inspector pane */
  raw: Record<string, unknown> | null;
  /** Extra inspector metadata */
  meta?: Record<string, unknown>;
}

export interface PreviewTree {
  root: PreviewTreeNode;
  /** Flat map of key → node for selection lookups */
  nodeIndex: Record<string, PreviewTreeNode>;
}
