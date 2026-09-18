import { KNOWN_EVOLVE_COMPONENT_TYPE_SET } from '../config/knownComponentTypes';
import type { Asset } from '../models/Asset';
import type { Block } from '../models/Block';
import type { Component, ComponentRelationships } from '../models/Component';
import type { Course } from '../models/Course';
import type { Lesson } from '../models/Lesson';
import type { Page } from '../models/Page';
import { Publisher } from '../models/Publisher';
import type { EvolveRawPackage } from '../parsers/IPackageParser';
import type { VirtualFileSystem } from '../types/VirtualFileSystem';
import type { AssetIndexer } from './AssetIndexer';

/**
 * Builds the reusable Course object model from Evolve raw JSON.
 * Preserves all source IDs — never generates new ones.
 *
 * Hierarchy: Course → Pages → Lessons (Articles) → Blocks → Components
 *
 * Single responsibility: EvolveRawPackage → Course (+ asset index via AssetIndexer).
 */
export class ObjectModelBuilder {
  constructor(private readonly assetIndexer: AssetIndexer) {}

  build(raw: EvolveRawPackage, vfs?: VirtualFileSystem): Course {
    const courseId = this.readId(raw.course, 'course');
    const title = this.readString(raw.course, 'title') || this.readString(raw.course, 'displayTitle') || 'Untitled Course';

    const articlesByParent = this.groupByParentId(raw.articles);
    const blocksByParent = this.groupByParentId(raw.blocks);
    const componentsByParent = this.groupByParentId(raw.components);

    const allLessons: Lesson[] = [];
    const allBlocks: Block[] = [];
    const allComponents: Component[] = [];
    const assetAccumulator: Asset[] = [];

    const contentObjects = raw.contentObjects;
    const pagesById = new Map<string, Page>();

    // First pass: create page shells
    for (const co of contentObjects) {
      const id = this.readId(co);
      const page: Page = {
        id,
        parentId: this.readParentId(co),
        title: this.readString(co, 'title') || this.readString(co, 'displayTitle') || id,
        displayTitle: this.readString(co, 'displayTitle') || undefined,
        description: this.readString(co, 'description') || undefined,
        body: this.readString(co, 'body') || undefined,
        type: this.readString(co, '_type') || 'page',
        lessons: [],
        childPages: [],
        raw: co,
      };
      pagesById.set(id, page);
    }

    // Attach lessons (articles) to pages — already sorted in groupByParentId
    for (const page of pagesById.values()) {
      const articleRows = articlesByParent.get(page.id) ?? [];
      for (const article of articleRows) {
        const lesson = this.buildLesson(
          article,
          blocksByParent,
          componentsByParent,
          courseId,
          page.id,
          allBlocks,
          allComponents,
          assetAccumulator
        );
        page.lessons.push(lesson);
        allLessons.push(lesson);
      }
    }

    // Nest menus → child pages
    const rootPages: Page[] = [];
    for (const page of pagesById.values()) {
      const parentId = page.parentId;
      if (parentId && pagesById.has(parentId)) {
        pagesById.get(parentId)!.childPages.push(page);
      } else {
        // Parent is course id or missing → treat as root page/menu
        rootPages.push(page);
      }
    }

    // Order child pages and roots by Evolve presentation order (_sortOrder / source index)
    for (const page of pagesById.values()) {
      page.childPages = sortPagesByPresentationOrder(page.childPages, contentObjects);
    }

    const orderedRoots = sortPagesByPresentationOrder(
      contentObjects
        .map((co) => pagesById.get(this.readId(co)))
        .filter((p): p is Page => !!p && rootPages.includes(p)),
      contentObjects
    );

    // Assets referenced from components + files under assets/
    const assets = this.assetIndexer.index({
      vfsAssets: assetAccumulator,
      components: allComponents,
      contentRoot: raw.contentRoot,
      vfs,
    });

    // Re-attach indexed assets onto components by parentComponentId
    const assetsByComponent = new Map<string, Asset[]>();
    for (const asset of assets) {
      if (!asset.parentComponentId) continue;
      const list = assetsByComponent.get(asset.parentComponentId) ?? [];
      list.push(asset);
      assetsByComponent.set(asset.parentComponentId, list);
    }
    for (const component of allComponents) {
      component.assets = assetsByComponent.get(component.id) ?? component.assets;
      component.relationships.assetIds = component.assets.map((a) => a.id);
    }

    return {
      id: courseId,
      title,
      displayTitle: this.readString(raw.course, 'displayTitle') || undefined,
      description: this.readString(raw.course, 'description') || undefined,
      body: this.readString(raw.course, 'body') || undefined,
      publisher: Publisher.EVOLVE,
      pages: orderedRoots.length > 0 ? orderedRoots : rootPages,
      lessons: allLessons,
      blocks: allBlocks,
      components: allComponents,
      assets,
      raw: raw.course,
      contentRoot: raw.contentRoot,
    };
  }

  private buildLesson(
    article: Record<string, unknown>,
    blocksByParent: Map<string, Record<string, unknown>[]>,
    componentsByParent: Map<string, Record<string, unknown>[]>,
    courseId: string,
    pageId: string,
    allBlocks: Block[],
    allComponents: Component[],
    assetAccumulator: Asset[]
  ): Lesson {
    const lessonId = this.readId(article);
    const blockRows = blocksByParent.get(lessonId) ?? [];
    const blocks: Block[] = [];

    for (const blockRow of blockRows) {
      const block = this.buildBlock(
        blockRow,
        componentsByParent,
        courseId,
        pageId,
        lessonId,
        allComponents,
        assetAccumulator
      );
      blocks.push(block);
      allBlocks.push(block);
    }

    return {
      id: lessonId,
      parentId: this.readParentId(article),
      title: this.readString(article, 'title') || this.readString(article, 'displayTitle') || lessonId,
      displayTitle: this.readString(article, 'displayTitle') || undefined,
      description: this.readString(article, 'description') || undefined,
      body: this.readString(article, 'body') || undefined,
      blocks,
      raw: article,
    };
  }

  private buildBlock(
    blockRow: Record<string, unknown>,
    componentsByParent: Map<string, Record<string, unknown>[]>,
    courseId: string,
    pageId: string,
    lessonId: string,
    allComponents: Component[],
    assetAccumulator: Asset[]
  ): Block {
    const blockId = this.readId(blockRow);
    const componentRows = componentsByParent.get(blockId) ?? [];
    const components: Component[] = [];

    for (const row of componentRows) {
      const component = this.buildComponent(row, courseId, pageId, lessonId, blockId, assetAccumulator);
      components.push(component);
      allComponents.push(component);
    }

    return {
      id: blockId,
      parentId: this.readParentId(blockRow),
      title: this.readString(blockRow, 'title') || this.readString(blockRow, 'displayTitle') || blockId,
      displayTitle: this.readString(blockRow, 'displayTitle') || undefined,
      body: this.readString(blockRow, 'body') || undefined,
      components,
      raw: blockRow,
    };
  }

  private buildComponent(
    row: Record<string, unknown>,
    courseId: string,
    pageId: string,
    lessonId: string,
    blockId: string,
    assetAccumulator: Asset[]
  ): Component {
    const id = this.readId(row);
    const type = this.readString(row, '_component') || 'unknown';
    const relationships: ComponentRelationships = {
      parentBlockId: blockId,
      parentLessonId: lessonId,
      parentPageId: pageId,
      courseId,
      assetIds: [],
    };

    const extracted = this.assetIndexer.extractFromComponentRaw(row, id);
    assetAccumulator.push(...extracted);

    return {
      id,
      parentId: this.readParentId(row),
      type,
      title: this.readString(row, 'title') || this.readString(row, 'displayTitle') || '',
      displayTitle: this.readString(row, 'displayTitle') || undefined,
      body: this.readString(row, 'body') || undefined,
      layout: this.readString(row, '_layout') || undefined,
      assets: extracted,
      relationships,
      isKnownType: KNOWN_EVOLVE_COMPONENT_TYPE_SET.has(type),
      raw: row,
    };
  }

  private groupByParentId(
    rows: Record<string, unknown>[]
  ): Map<string, Record<string, unknown>[]> {
    const sourceIndex = new WeakMap<object, number>();
    const map = new Map<string, Record<string, unknown>[]>();
    rows.forEach((row, index) => {
      sourceIndex.set(row, index);
      const parentId = this.readParentId(row) ?? '';
      const list = map.get(parentId) ?? [];
      list.push(row);
      map.set(parentId, list);
    });

    for (const [parentId, list] of map) {
      map.set(parentId, sortByPresentationOrder(list, sourceIndex));
    }
    return map;
  }

  private readId(row: Record<string, unknown>, fallback = ''): string {
    const id = row._id ?? row.id;
    if (typeof id === 'string' && id.length > 0) return id;
    if (typeof id === 'number') return String(id);
    return fallback;
  }

  private readParentId(row: Record<string, unknown>): string | null {
    const parent = row._parentId ?? row.parentId;
    if (parent === null || parent === undefined || parent === '') return null;
    return String(parent);
  }

  private readString(row: Record<string, unknown>, key: string): string {
    const value = row[key];
    return typeof value === 'string' ? value : '';
  }
}

/**
 * Evolve/Adapt presentation order: prefer numeric `_sortOrder`, then JSON array index.
 */
function sortByPresentationOrder(
  rows: Record<string, unknown>[],
  sourceIndex: WeakMap<object, number>
): Record<string, unknown>[] {
  return [...rows].sort((a, b) => {
    const sortA = readSortOrder(a);
    const sortB = readSortOrder(b);
    if (sortA !== null && sortB !== null && sortA !== sortB) {
      return sortA - sortB;
    }
    if (sortA !== null && sortB === null) return -1;
    if (sortA === null && sortB !== null) return 1;

    const indexA = sourceIndex.get(a) ?? 0;
    const indexB = sourceIndex.get(b) ?? 0;
    return indexA - indexB;
  });
}

function sortPagesByPresentationOrder(
  pages: Page[],
  contentObjects: Record<string, unknown>[]
): Page[] {
  const indexById = new Map<string, number>();
  contentObjects.forEach((co, index) => {
    const id = co._id ?? co.id;
    if (id !== undefined && id !== null) {
      indexById.set(String(id), index);
    }
  });

  return [...pages].sort((a, b) => {
    const sortA = readSortOrder(a.raw);
    const sortB = readSortOrder(b.raw);
    if (sortA !== null && sortB !== null && sortA !== sortB) {
      return sortA - sortB;
    }
    if (sortA !== null && sortB === null) return -1;
    if (sortA === null && sortB !== null) return 1;

    const indexA = indexById.get(a.id) ?? 0;
    const indexB = indexById.get(b.id) ?? 0;
    return indexA - indexB;
  });
}

function readSortOrder(row: Record<string, unknown> | undefined): number | null {
  if (!row) return null;
  const value = row._sortOrder ?? row.sortOrder;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}
