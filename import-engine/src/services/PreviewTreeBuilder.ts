import type { Course } from '../models/Course';
import type { Page } from '../models/Page';
import type {
  PreviewTree,
  PreviewTreeNode,
} from '../models/PreviewTree';

/**
 * Builds a file-explorer style collapsible tree for the Developer Debug View.
 *
 * Course → Pages → Lessons → Blocks → Components (+ Assets folder)
 *
 * Single responsibility: Course → PreviewTree.
 */
export class PreviewTreeBuilder {
  build(course: Course): PreviewTree {
    const nodeIndex: Record<string, PreviewTreeNode> = {};

    const root: PreviewTreeNode = {
      key: `course:${course.id}`,
      id: course.id,
      kind: 'course',
      label: course.title || course.id,
      badge: course.publisher,
      children: [],
      raw: course.raw,
      meta: {
        contentRoot: course.contentRoot,
        pageCount: course.pages.length,
        lessonCount: course.lessons.length,
        blockCount: course.blocks.length,
        componentCount: course.components.length,
        assetCount: course.assets.length,
      },
    };
    nodeIndex[root.key] = root;

    for (const page of course.pages) {
      root.children.push(this.buildPageNode(page, nodeIndex));
    }

    // Course-level assets folder
    if (course.assets.length > 0) {
      const assetsFolder = this.buildAssetsFolder(course, nodeIndex);
      root.children.push(assetsFolder);
    }

    return { root, nodeIndex };
  }

  private buildPageNode(
    page: Page,
    nodeIndex: Record<string, PreviewTreeNode>
  ): PreviewTreeNode {
    const isMenu = page.type === 'menu' || page.childPages.length > 0;
    const node: PreviewTreeNode = {
      key: `page:${page.id}`,
      id: page.id,
      kind: isMenu && page.type === 'menu' ? 'menu' : 'page',
      label: page.displayTitle || page.title || page.id,
      badge: page.type,
      children: [],
      raw: page.raw,
      meta: {
        lessonCount: page.lessons.length,
        childPageCount: page.childPages.length,
      },
    };
    nodeIndex[node.key] = node;

    for (const child of page.childPages) {
      node.children.push(this.buildPageNode(child, nodeIndex));
    }

    for (const lesson of page.lessons) {
      const lessonNode: PreviewTreeNode = {
        key: `lesson:${lesson.id}`,
        id: lesson.id,
        kind: 'lesson',
        label: lesson.displayTitle || lesson.title || 'Lesson',
        badge: 'lesson',
        children: [],
        raw: lesson.raw,
      };
      nodeIndex[lessonNode.key] = lessonNode;

      for (const block of lesson.blocks) {
        const blockNode: PreviewTreeNode = {
          key: `block:${block.id}`,
          id: block.id,
          kind: 'block',
          label: block.displayTitle || block.title || block.id,
          badge: 'block',
          children: [],
          raw: block.raw,
        };
        nodeIndex[blockNode.key] = blockNode;

        for (const component of block.components) {
          // Tree preview shows component type as the primary label (file-explorer style)
          const componentNode: PreviewTreeNode = {
            key: `component:${component.id}`,
            id: component.id,
            kind: 'component',
            label: this.formatComponentLabel(component.type),
            badge: component.type,
            children: [],
            raw: component.raw,
            meta: {
              title: component.title,
              layout: component.layout,
              isKnownType: component.isKnownType,
              relationships: component.relationships,
              assets: component.assets,
              properties: this.pickProperties(component.raw),
            },
          };
          nodeIndex[componentNode.key] = componentNode;

          for (const asset of component.assets) {
            const assetNode: PreviewTreeNode = {
              key: `asset:${component.id}:${asset.id}`,
              id: asset.id,
              kind: 'asset',
              label: asset.filename,
              badge: asset.mediaType,
              children: [],
              raw: { ...asset } as unknown as Record<string, unknown>,
              meta: { ...asset },
            };
            nodeIndex[assetNode.key] = assetNode;
            componentNode.children.push(assetNode);
          }

          blockNode.children.push(componentNode);
        }

        lessonNode.children.push(blockNode);
      }

      node.children.push(lessonNode);
    }

    return node;
  }

  private buildAssetsFolder(
    course: Course,
    nodeIndex: Record<string, PreviewTreeNode>
  ): PreviewTreeNode {
    const folder: PreviewTreeNode = {
      key: `assets-folder:${course.id}`,
      id: null,
      kind: 'assets-folder',
      label: `Assets (${course.assets.length})`,
      children: [],
      raw: null,
    };
    nodeIndex[folder.key] = folder;

    for (const asset of course.assets) {
      const assetNode: PreviewTreeNode = {
        key: `asset-index:${asset.id}`,
        id: asset.id,
        kind: 'asset',
        label: asset.filename,
        badge: asset.exists ? asset.mediaType : 'missing',
        children: [],
        raw: { ...asset } as unknown as Record<string, unknown>,
        meta: { ...asset },
      };
      nodeIndex[assetNode.key] = assetNode;
      folder.children.push(assetNode);
    }

    return folder;
  }

  private formatComponentLabel(type: string): string {
    if (!type) return 'Component';
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  private pickProperties(raw: Record<string, unknown>): Record<string, unknown> {
    const skip = new Set(['_id', '_parentId', '_type', '_component', '_classes']);
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (skip.has(key)) continue;
      props[key] = value;
    }
    return props;
  }
}
